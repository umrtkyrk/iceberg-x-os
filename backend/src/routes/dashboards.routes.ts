/**
 * Role-specific dashboard aggregates.
 */
import { Router } from 'express';
import prisma from '../services/prisma';
import { requireAuth, isAdmin, isMentorOrAdmin, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { IN_PROGRAMME_CUBE_LEVELS } from '../config/constants';
import { loadAdminDashboard } from '../services/adminDashboard.service';
import { getAdminBriefing } from '../services/adminBriefing.service';
import { sendError } from '../utils/http';

const router = Router();

router.get('/admin/dashboard', requireAuth, isAdmin, async (req, res) => {
  try {
    return res.json(await loadAdminDashboard());
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/admin/dashboard/briefing', requireAuth, isAdmin, async (req, res) => {
  try {
    return res.json(await getAdminBriefing());
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/mentor/dashboard', requireAuth, isMentorOrAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    // Cubes assigned to this mentor. Someone who has left the programme is no
    // longer part of the mentor's workspace; the assignment itself is kept as
    // history and still shows on their profile.
    const assignedCubes = await prisma.cubeProfile.findMany({
      where: {
        assigned_mentor_id: req.user.id,
        current_level: { in: IN_PROGRAMME_CUBE_LEVELS }
      },
      include: { user: { select: { name: true, email: true, id: true } } }
    });

    // Missions assigned to this mentor
    const assignedMissions = await prisma.mission.findMany({
      where: { mentor_id: req.user.id },
      include: {
        teams: { include: { members: { include: { cube: { include: { user: { select: { name: true } } } } } } } }
      }
    });

    // Recent updates for missions assigned to this mentor
    const assignedMissionIds = assignedMissions.map(m => m.id);
    const recentUpdates = await prisma.update.findMany({
      where: { mission_id: { in: assignedMissionIds } },
      include: {
        cube: { select: { name: true } },
        mission: { select: { title: true } }
      },
      orderBy: { created_at: 'desc' },
      take: 10
    });

    // Pending demo reviews (Demos submitted for their missions that don't have feedback from them yet)
    const submittedDemos = await prisma.demoSubmission.findMany({
      where: { mission_id: { in: assignedMissionIds } },
      include: {
        mission: true,
        submitted_by: { select: { name: true, id: true } }
      }
    });

    const feedbacksByMe = await prisma.mentorFeedback.findMany({
      where: { mentor_id: req.user.id, mission_id: { in: assignedMissionIds } }
    });

    const feedbackKeys = new Set(feedbacksByMe.map(f => `${f.cube_id}-${f.mission_id}`));
    const pendingReviews = submittedDemos.filter(d => !feedbackKeys.has(`${d.submitted_by_id}-${d.mission_id}`));

    // Cubes needing feedback (Assigned cubes with updates/demos but no feedback in current mission)
    const cubesNeedingFeedback = [];
    for (const cube of assignedCubes) {
      // Find what missions this cube is in
      const memberships = await prisma.missionTeamMember.findMany({
        where: { cube_id: cube.id },
        include: { team: true }
      });
      const cubeMissions = memberships.map(m => m.team.mission_id).filter(Boolean) as string[];

      // Check if they have feedback on these missions from this mentor
      const cubeFeedbacks = await prisma.mentorFeedback.findMany({
        where: {
          cube_id: cube.user_id,
          mission_id: { in: cubeMissions },
          mentor_id: req.user.id
        }
      });
      const reviewedMissionIds = new Set(cubeFeedbacks.map(f => f.mission_id));

      const unreviewedMissionIds = cubeMissions.filter(mId => !reviewedMissionIds.has(mId));
      if (unreviewedMissionIds.length > 0) {
        // Get mission names
        const missionsInfo = await prisma.mission.findMany({
          where: { id: { in: unreviewedMissionIds } },
          select: { id: true, title: true }
        });
        cubesNeedingFeedback.push({
          cubeProfileId: cube.id,
          name: cube.user.name,
          cubeNumber: cube.cube_number,
          missions: missionsInfo
        });
      }
    }

    return res.json({
      assignedCubes,
      assignedMissions,
      pendingReviews,
      recentUpdates,
      cubesNeedingFeedback
    });
  } catch (error: any) {
    return sendError(res, error);
  }
});

router.get('/cube/dashboard', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user || req.user.role !== 'CUBE') {
      return res.status(403).json({ error: 'Only Cubes can access this dashboard' });
    }

    const profile = await prisma.cubeProfile.findUnique({
      where: { id: req.user.cubeProfileId },
      include: {
        assigned_mentor: { select: { id: true, name: true, email: true } },
        cube_badges: { include: { badge: true } }
      }
    });

    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    // Current mission & team memberships
    const memberships = await prisma.missionTeamMember.findMany({
      where: { cube_id: profile.id },
      include: {
        team: {
          include: {
            mission: true,
            members: {
              include: {
                cube: { include: { user: { select: { name: true } } } }
              }
            }
          }
        }
      }
    });

    const activeMemberships = memberships.filter(
      m => m.team?.mission && !['completed', 'reviewed', 'promoted_to_product_backlog', 'archived', 'cancelled'].includes(m.team.mission.status)
    );

    // Group memberships by unique mission so Cubes with multiple active missions see all of them
    const missionMap = new Map<string, { mission: any; team: any; teams: any[]; role: string }>();
    for (const m of activeMemberships) {
      if (!m.team?.mission) continue;
      const missionId = m.team.mission.id;
      if (!missionMap.has(missionId)) {
        missionMap.set(missionId, {
          mission: m.team.mission,
          team: m.team,
          teams: [m.team],
          role: m.role
        });
      } else {
        const existing = missionMap.get(missionId)!;
        existing.teams.push(m.team);
      }
    }

    const activeMissions = Array.from(missionMap.values());
    const activeMission = activeMissions[0]?.mission || null;
    const activeTeam = activeMissions[0]?.team || null;

    // Upcoming Demo Day
    const upcomingDemoDay = await prisma.demoDay.findFirst({
      where: { date: { gte: new Date() } },
      orderBy: { date: 'asc' }
    });

    // Recent feedback (strip private notes)
    const fb = await prisma.mentorFeedback.findMany({
      where: { cube_id: req.user.id, visible_to_cube: true },
      include: {
        mentor: { select: { name: true } },
        mission: { select: { title: true } }
      },
      orderBy: { created_at: 'desc' },
      take: 3
    });
    const recentFeedback = fb.map(item => {
      const { private_notes, ...rest } = item;
      return rest;
    });

    return res.json({
      profile,
      activeMission,
      activeTeam,
      activeMissions,
      upcomingDemoDay,
      recentFeedback
    });
  } catch (error: any) {
    return sendError(res, error);
  }
});

export default router;
