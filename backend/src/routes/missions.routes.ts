/**
 * Missions, reflections and lifecycle transitions.
 */
import { Router } from 'express';
import prisma from '../services/prisma';
import { requireAuth, isAdmin, isMentorOrAdmin, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { TERMINAL_MISSION_STATUSES } from '../config/constants';
import { badRequest, conflict, notFound, sendError } from '../utils/http';
import { createBulkNotification } from '../services/notification.service';
import { syncTeamMembers, detachTeamsFromMission } from '../services/team.service';
import { assertCubesAreActive } from '../services/cubeStatus.service';
import { reconcileMissions, listContributors } from '../services/contributor.service';
import { loadLinks, normalizeIds, setPredecessors } from '../services/missionLink.service';
import { recalculateQuestsForCubes } from '../services/quest.service';
import { TeamMemberRole } from '@prisma/client';
import { recalculateQuestsForMissionTeams } from '../services/quest.service';
import {
  allowedNextStatuses,
  assertInitialStatus,
  assertTransition
} from '../services/missionStatus.service';
import { MissionStatus, DifficultyLevel, MissionDecision } from '@prisma/client';

const router = Router();

// Finished missions that live in the Cube Vault
const VAULT_STATUSES: MissionStatus[] = [
  MissionStatus.completed,
  MissionStatus.reviewed,
  MissionStatus.promoted_to_product_backlog,
  MissionStatus.archived
];

// List missions
router.get('/missions', requireAuth, async (req, res) => {
  try {
    const { status, difficulty_level, mentor_id, vault } = req.query;
    const isVault = vault === 'true';

    const filters: any = {};
    if (status) filters.status = status as MissionStatus;
    else if (isVault) filters.status = { in: VAULT_STATUSES };
    if (difficulty_level) filters.difficulty_level = difficulty_level as DifficultyLevel;
    if (mentor_id) filters.mentor_id = mentor_id as string;

    // Apply unassigned privacy filter for Cubes
    const userRole = (req as AuthenticatedRequest).user?.role;
    if (userRole === 'CUBE') {
      filters.OR = [
        { mentor_id: { not: null } },
        { teams: { some: {} } }
      ];
    }

    const missions = await prisma.mission.findMany({
      where: filters,
      include: {
        mentor: { select: { id: true, name: true } },
        created_by: { select: { id: true, name: true } },
        teams: {
          include: {
            members: {
              include: {
                cube: {
                  // The mission cards show initials only; the Vault also needs avatars
                  select: {
                    id: true,
                    user: { select: isVault ? { name: true, avatar_url: true } : { name: true } }
                  }
                }
              }
            }
          }
        },
        ...(isVault && {
          demo_submissions: {
            orderBy: { submitted_at: 'desc' as const },
            take: 1,
            select: {
              id: true,
              what_we_built: true,
              what_we_learned: true,
              recommendation: true,
              repository_url: true,
              pull_request_url: true,
              demo_url: true,
              document_url: true,
              video_url: true,
              submitted_at: true
            }
          }
        })
      },
      orderBy: isVault ? { updated_at: 'desc' } : { created_at: 'desc' }
    });

    const ids = missions.map(m => m.id);
    const contributors = isVault ? await listContributors(ids) : null;
    const links = isVault ? await loadLinks(ids, (req as AuthenticatedRequest).user?.role) : null;

    return res.json(
      missions.map(m => ({
        ...m,
        // Lets the list offer a quick status change with only legal moves
        allowed_next_statuses: allowedNextStatuses(m.status),
        ...(contributors && { contributors: contributors.get(m.id) || [] }),
        ...(links && {
          predecessors: links.get(m.id)?.predecessors || [],
          followups: links.get(m.id)?.followups || []
        })
      }))
    );
  } catch (error: any) {
    return sendError(res, error);
  }
});

// Create mission (Admin or Mentor)
router.post('/missions', requireAuth, isMentorOrAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      title,
      description,
      context,
      problem_statement,
      expected_output,
      difficulty_level,
      status,
      category,
      mentor_id,
      slack_channel_url,
      repository_url,
      demo_url,
      notify,
      predecessor_ids
    } = req.body;

    if (!title || !description || !context || !problem_statement || !expected_output || !difficulty_level) {
      return res.status(400).json({ error: 'Missing required mission parameters' });
    }

    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const predecessorIds = normalizeIds(predecessor_ids);
    const creatorId = req.user.id;

    const newMission = await prisma.$transaction(async (tx) => {
      const created = await tx.mission.create({
      data: {
        title,
        description,
        context,
        problem_statement,
        expected_output,
        difficulty_level: difficulty_level as DifficultyLevel,
        status: assertInitialStatus(status),
        category: category || 'General',
        created_by_id: creatorId,
        mentor_id: mentor_id || null,
        slack_channel_url,
        repository_url,
        demo_url,
      }
      });
      await setPredecessors(tx, created.id, predecessorIds);
      return created;
    });

    if (notify) {
      await createBulkNotification(`A new mission has been added: ${title}`);
    }

    return res.status(201).json(newMission);
  } catch (error: any) {
    return sendError(res, error);
  }
});

// Get mission detail
router.get('/missions/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const mission = await prisma.mission.findUnique({
      where: { id },
      include: {
        mentor: { select: { id: true, name: true, email: true } },
        created_by: { select: { id: true, name: true } },
        teams: {
          include: {
            members: {
              include: {
                cube: {
                  include: { user: { select: { id: true, name: true, email: true, avatar_url: true } } }
                }
              }
            }
          }
        },
        updates: {
          include: {
            cube: { select: { name: true } }
          },
          orderBy: { created_at: 'desc' }
        },
        demo_submissions: {
          include: {
            submitted_by: { select: { name: true } },
            team: { select: { name: true } }
          },
          orderBy: { created_at: 'desc' }
        }
      }
    });

    if (!mission) {
      return res.status(404).json({ error: 'Mission not found' });
    }

    // Check unassigned privacy filter for Cubes
    if (req.user?.role === 'CUBE') {
      const hasTeams = mission.teams.length > 0;
      if (!mission.mentor_id && !hasTeams) {
        return res.status(403).json({ error: 'Access denied. This mission is unassigned and private.' });
      }
    }

    // Get feedback related to this mission. CRITICAL check.
    let mentorFeedback = [];
    if (req.user?.role === 'ADMIN' || req.user?.role === 'MENTOR') {
      mentorFeedback = await prisma.mentorFeedback.findMany({
        where: { mission_id: id },
        include: {
          cube: { select: { name: true, id: true } },
          mentor: { select: { name: true } }
        },
        orderBy: { created_at: 'desc' }
      });
    } else {
      // Cube can only see feedback on this mission if it concerns them and is visible
      const fb = await prisma.mentorFeedback.findMany({
        where: {
          mission_id: id,
          cube_id: req.user?.id,
          visible_to_cube: true
        },
        include: {
          cube: { select: { name: true, id: true } },
          mentor: { select: { name: true } }
        },
        orderBy: { created_at: 'desc' }
      });
      mentorFeedback = fb.map(item => {
        const { private_notes, ...rest } = item;
        return rest;
      });
    }

    const contributors = (await listContributors([id])).get(id) || [];
    const links = (await loadLinks([id], req.user?.role)).get(id);

    return res.json({
      mission,
      contributors,
      predecessors: links?.predecessors || [],
      followups: links?.followups || [],
      mentorFeedback,
      // Lets the UI offer only legal next statuses instead of the full enum
      allowedNextStatuses: allowedNextStatuses(mission.status)
    });
  } catch (error: any) {
    return sendError(res, error);
  }
});

// Edit mission
router.put('/missions/:id', requireAuth, isMentorOrAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      context,
      problem_statement,
      expected_output,
      difficulty_level,
      status,
      category,
      mentor_id,
      slack_channel_url,
      repository_url,
      demo_url,
      decision,
      force,
      predecessor_ids
    } = req.body;

    const existing = await prisma.mission.findUnique({
      where: { id },
      select: { status: true }
    });
    if (!existing) throw notFound('Mission not found');

    const updateData: any = {};
    if (title) updateData.title = title;
    if (description) updateData.description = description;
    if (context) updateData.context = context;
    if (problem_statement) updateData.problem_statement = problem_statement;
    if (expected_output) updateData.expected_output = expected_output;
    if (difficulty_level) updateData.difficulty_level = difficulty_level as DifficultyLevel;
    if (status) {
      updateData.status = assertTransition(existing.status, status, {
        role: req.user?.role,
        force: !!force
      });
    }
    if (category) updateData.category = category;
    if (mentor_id !== undefined) updateData.mentor_id = mentor_id || null;
    if (slack_channel_url !== undefined) updateData.slack_channel_url = slack_channel_url;
    if (repository_url !== undefined) updateData.repository_url = repository_url;
    if (demo_url !== undefined) updateData.demo_url = demo_url;
    if (decision !== undefined) updateData.decision = decision ? (decision as MissionDecision) : null;

    // Only touch links when the caller sent them, so partial edits keep existing links
    const predecessorIds = Array.isArray(predecessor_ids) ? normalizeIds(predecessor_ids) : null;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.mission.update({
        where: { id },
        data: updateData
      });
      if (predecessorIds) await setPredecessors(tx, id, predecessorIds);
      return result;
    });

    // A status change may now satisfy a "missions_completed" quest for
    // everyone on the team — recompute rather than waiting for the Cube to
    // coincidentally trigger a recheck through an unrelated action.
    if (status) {
      recalculateQuestsForMissionTeams(id).catch(err =>
        console.error(`Quest recalculation failed for mission ${id}:`, err)
      );
    }

    return res.json({ ...updated, allowedNextStatuses: allowedNextStatuses(updated.status) });
  } catch (error: any) {
    return sendError(res, error);
  }
});

// Admin-only decision route
router.post('/missions/:id/decision', requireAuth, isAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { decision, force } = req.body; // MissionDecision

    if (!decision) {
      return res.status(400).json({ error: 'Decision parameter is required' });
    }

    const existing = await prisma.mission.findUnique({
      where: { id },
      select: { status: true }
    });
    if (!existing) throw notFound('Mission not found');

    // "Archive" also closes the mission, so it goes through the lifecycle check
    const nextStatus = decision === 'Archive'
      ? assertTransition(existing.status, MissionStatus.archived, {
          role: req.user?.role,
          force: !!force
        })
      : undefined;

    const updated = await prisma.mission.update({
      where: { id },
      data: {
        decision: decision as MissionDecision,
        status: nextStatus
      }
    });

    return res.json(updated);
  } catch (error: any) {
    return sendError(res, error);
  }
});

/**
 * Deleting a mission cascades into every Update, DemoSubmission,
 * MentorFeedback and DemoDayPresentation attached to it. That used to happen
 * silently. The dependent records are now counted first and the caller has to
 * opt in with ?force=true before any of that history is destroyed.
 */
router.delete('/missions/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const mission = await prisma.mission.findUnique({
      where: { id },
      select: { id: true, title: true }
    });
    if (!mission) throw notFound('Mission not found');

    const [updates, demoSubmissions, mentorFeedback, presentations] = await Promise.all([
      prisma.update.count({ where: { mission_id: id } }),
      prisma.demoSubmission.count({ where: { mission_id: id } }),
      prisma.mentorFeedback.count({ where: { mission_id: id } }),
      prisma.demoDayPresentation.count({ where: { mission_id: id } })
    ]);

    const dependents = { updates, demoSubmissions, mentorFeedback, presentations };
    const totalDependents = updates + demoSubmissions + mentorFeedback + presentations;
    const force = req.query.force === 'true';

    if (totalDependents > 0 && !force) {
      throw conflict(
        `"${mission.title}" has ${totalDependents} linked record(s) that would be permanently deleted ` +
        `(${updates} update(s), ${demoSubmissions} demo submission(s), ${mentorFeedback} feedback entr(ies), ` +
        `${presentations} demo day presentation(s)). Re-send with ?force=true to confirm.`,
        dependents
      );
    }

    // Detach teams so the roster and its reflections survive the deletion
    const detachedTeams = await prisma.$transaction(async (tx) => {
      const detached = await detachTeamsFromMission(tx, id);
      await tx.mission.delete({ where: { id } });
      return detached;
    });

    return res.json({
      success: true,
      message: 'Mission deleted successfully',
      deletedDependents: dependents,
      detachedTeams
    });
  } catch (error: any) {
    return sendError(res, error);
  }
});

/**
 * Quick status change. Same lifecycle rules as the full edit, without having
 * to open the edit form or resend any other field.
 */
router.patch('/missions/:id/status', requireAuth, isMentorOrAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { status, force } = req.body;
    if (!status) throw badRequest('Status is required');

    const existing = await prisma.mission.findUnique({ where: { id }, select: { status: true } });
    if (!existing) throw notFound('Mission not found');

    const next = assertTransition(existing.status, status, {
      role: req.user?.role,
      force: !!force
    });

    const updated = await prisma.mission.update({ where: { id }, data: { status: next } });

    recalculateQuestsForMissionTeams(id).catch(err =>
      console.error(`Quest recalculation failed for mission ${id}:`, err)
    );

    return res.json({ ...updated, allowed_next_statuses: allowedNextStatuses(updated.status) });
  } catch (error: any) {
    return sendError(res, error);
  }
});

/**
 * Assign a single Cube to a mission without building a team first.
 *
 * Everything downstream (updates, reflections, dashboards, demos) keys off
 * team membership, so the Cube joins the mission's team. If the mission has no
 * team yet, one is created automatically.
 */
router.post('/missions/:id/assignees', requireAuth, isMentorOrAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { cubeProfileId } = req.body;
    const role = (req.body.role as TeamMemberRole) || TeamMemberRole.Contributor;

    if (!cubeProfileId) throw badRequest('cubeProfileId is required');
    if (!Object.values(TeamMemberRole).includes(role)) throw badRequest(`Unknown role "${role}".`);

    const mission = await prisma.mission.findUnique({
      where: { id },
      select: { id: true, title: true, status: true, teams: { select: { id: true }, orderBy: { created_at: 'asc' } } }
    });
    if (!mission) throw notFound('Mission not found');
    if (['archived', 'cancelled'].includes(mission.status)) {
      throw badRequest('This mission is closed. Reopen it before assigning Cubes.');
    }

    await assertCubesAreActive([cubeProfileId], 'be assigned to a mission');

    await prisma.$transaction(async (tx) => {
      await reconcileMissions(tx, [id]);

      let teamId = mission.teams[0]?.id;
      if (!teamId) {
        const team = await tx.missionTeam.create({
          data: { name: `${mission.title}`.slice(0, 60) + ' Team', mission_id: id }
        });
        teamId = team.id;
      }

      const current = await tx.missionTeamMember.findUnique({
        where: { team_id_cube_id: { team_id: teamId, cube_id: cubeProfileId } }
      });
      if (current) {
        if (current.role !== role) {
          await tx.missionTeamMember.update({ where: { id: current.id }, data: { role } });
        }
      } else {
        await tx.missionTeamMember.create({ data: { team_id: teamId, cube_id: cubeProfileId, role } });
      }

      await reconcileMissions(tx, [id]);
    });

    recalculateQuestsForCubes([cubeProfileId]).catch(err =>
      console.error(`Quest recalculation failed for cube ${cubeProfileId}:`, err)
    );

    const contributors = (await listContributors([id])).get(id) || [];
    return res.status(201).json({ success: true, contributors });
  } catch (error: any) {
    return sendError(res, error);
  }
});

/**
 * Take a Cube off a mission. The contributor history keeps the record
 * (released, not erased). A Cube who already submitted a reflection can only be
 * removed with ?force=true, because the reflection lives on the team member row.
 */
router.delete('/missions/:id/assignees/:cubeId', requireAuth, isMentorOrAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id, cubeId } = req.params;
    const force = req.query.force === 'true';

    const memberships = await prisma.missionTeamMember.findMany({
      where: { cube_id: cubeId, team: { mission_id: id } },
      select: { id: true, is_submitted: true, what_gained: true, what_learned: true, what_could_be_better: true }
    });
    if (memberships.length === 0) throw notFound('This Cube is not assigned to the mission');

    const hasReflection = memberships.some(m => m.is_submitted || m.what_gained || m.what_learned || m.what_could_be_better);
    if (hasReflection && !force) {
      throw conflict(
        'This Cube has already written a reflection for this mission, which would be deleted. Re-send with ?force=true to confirm.'
      );
    }

    await prisma.$transaction(async (tx) => {
      await reconcileMissions(tx, [id]);
      await tx.missionTeamMember.deleteMany({ where: { id: { in: memberships.map(m => m.id) } } });
      await reconcileMissions(tx, [id]);
    });

    const contributors = (await listContributors([id])).get(id) || [];
    return res.json({ success: true, contributors });
  } catch (error: any) {
    return sendError(res, error);
  }
});

router.post('/missions/:missionId/reflections', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { missionId } = req.params;
    const { what_gained, what_learned, what_could_be_better } = req.body;

    if (!req.user || req.user.role !== 'CUBE' || !req.user.cubeProfileId) {
      return res.status(403).json({ error: 'Only Cubes can submit individual reflections' });
    }

    if (!what_gained || !what_learned || !what_could_be_better) {
      return res.status(400).json({ error: 'All reflection fields are required' });
    }

    // Find the MissionTeamMember record
    const memberRecord = await prisma.missionTeamMember.findFirst({
      where: {
        cube_id: req.user.cubeProfileId,
        team: { mission_id: missionId }
      }
    });

    if (!memberRecord) {
      return res.status(404).json({ error: 'You are not assigned as a team member on this mission' });
    }

    // Update reflections
    const updatedMember = await prisma.missionTeamMember.update({
      where: { id: memberRecord.id },
      data: {
        what_gained,
        what_learned,
        what_could_be_better,
        is_submitted: true,
        submitted_at: new Date()
      }
    });

    // Check if all team members have submitted reflections for this mission
    const allTeamMembers = await prisma.missionTeamMember.findMany({
      where: { team: { mission_id: missionId } }
    });

    const allSubmitted = allTeamMembers.every(m => m.is_submitted);

    // Automatic side effect, not a user action: advance to pending_approval only
    // when the lifecycle permits it, and never fail the Cube's submission if it
    // does not (e.g. the mission was archived while reflections were open).
    let missionStatusUpdated = false;
    if (allSubmitted && allTeamMembers.length > 0) {
      const mission = await prisma.mission.findUnique({
        where: { id: missionId },
        select: { status: true }
      });

      if (mission && allowedNextStatuses(mission.status).includes(MissionStatus.pending_approval)) {
        await prisma.mission.update({
          where: { id: missionId },
          data: { status: MissionStatus.pending_approval }
        });
        missionStatusUpdated = true;
      }
    }

    return res.json({
      success: true,
      member: updatedMember,
      allSubmitted,
      missionStatusUpdated
    });
  } catch (error: any) {
    return sendError(res, error);
  }
});

router.post('/missions/:missionId/approve', requireAuth, isMentorOrAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { missionId } = req.params;
    const { force } = req.body || {};

    const mission = await prisma.mission.findUnique({
      where: { id: missionId }
    });

    if (!mission) {
      return res.status(404).json({ error: 'Mission not found' });
    }

    const nextStatus = assertTransition(mission.status, MissionStatus.completed, {
      role: req.user?.role,
      force: !!force
    });

    const updatedMission = await prisma.mission.update({
      where: { id: missionId },
      data: { status: nextStatus }
    });

    recalculateQuestsForMissionTeams(missionId).catch(err =>
      console.error(`Quest recalculation failed for mission ${missionId}:`, err)
    );

    return res.json({
      success: true,
      mission: updatedMission
    });
  } catch (error: any) {
    return sendError(res, error);
  }
});

// Resolve Mission lifecycle endpoint
router.post('/missions/:id/resolve', requireAuth, isMentorOrAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { action, targetStatus, newMemberIds, force } = req.body;

    const mission = await prisma.mission.findUnique({
      where: { id },
      include: { teams: true }
    });

    if (!mission) {
      return res.status(404).json({ error: 'Mission not found' });
    }

    const transitionOptions = { role: req.user?.role, force: !!force };

    if (action === 'complete_archive') {
      // 1. Mark mission as completed
      const nextStatus = assertTransition(mission.status, MissionStatus.completed, transitionOptions);
      await prisma.mission.update({
        where: { id },
        data: { status: nextStatus }
      });
      recalculateQuestsForMissionTeams(id).catch(err =>
        console.error(`Quest recalculation failed for mission ${id}:`, err)
      );
      return res.json({ success: true, message: 'Mission completed and archived successfully.' });
    }

    if (action === 'fail_reassign') {
      const nextStatus = assertTransition(mission.status, MissionStatus.selected, transitionOptions);

      // Detach the teams instead of deleting them. Deleting cascaded into
      // MissionTeamMember and destroyed every Cube's reflections.
      const detachedTeams = await prisma.$transaction(async (tx) => {
        // Keep the roster in the contributor history before it is detached
        await reconcileMissions(tx, [id]);
        const detached = await detachTeamsFromMission(tx, id);
        await tx.mission.update({
          where: { id },
          data: { status: nextStatus }
        });
        await reconcileMissions(tx, [id]);
        return detached;
      });

      return res.json({
        success: true,
        message: 'Mission reset. Previous teams were detached and their reflections preserved.',
        detachedTeams
      });
    }

    if (action === 'continue_phase') {
      const memberIds: string[] = Array.isArray(newMemberIds) ? newMemberIds : [];
      await assertCubesAreActive(memberIds, 'continue on this mission');
      const nextStatus = targetStatus
        ? assertTransition(mission.status, targetStatus, transitionOptions)
        : null;

      const summary = await prisma.$transaction(async (tx) => {
        if (nextStatus) {
          await tx.mission.update({
            where: { id },
            data: { status: nextStatus }
          });
        }

        // Reconcile the roster instead of wiping and recreating it, so members
        // who stay on the mission keep their reflections and is_submitted flag.
        await reconcileMissions(tx, [id]);
        let synced = null;
        if (Array.isArray(newMemberIds) && mission.teams.length > 0) {
          synced = await syncTeamMembers(
            tx,
            mission.teams[0].id,
            memberIds.map(cubeProfileId => ({ cubeProfileId }))
          );
        }
        await reconcileMissions(tx, [id]);
        return synced;
      });

      // Covers both a status change (missions_completed) and a roster change
      // (missions_assigned); recalculateQuestsForMissionTeams re-reads the
      // team from the database, so it sees whichever of the two happened.
      recalculateQuestsForMissionTeams(id).catch(err =>
        console.error(`Quest recalculation failed for mission ${id}:`, err)
      );

      return res.json({
        success: true,
        message: 'Mission transitioned to next phase.',
        memberChanges: summary
      });
    }

    throw badRequest('Invalid action parameter');
  } catch (error: any) {
    return sendError(res, error);
  }
});

export default router;
