/**
 * Quests and gamification endpoints.
 */
import { Router } from 'express';
import prisma from '../services/prisma';
import { requireAuth, isAdmin, isMentorOrAdmin, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { badRequest, conflict, notFound, sendError, forbidden } from '../utils/http';
import { assignQuestToCubes, verifyQuestProgress, autoAssignQuestToEligibleCubes } from '../services/quest.service';
import {
  PEER_CRITERIA,
  PEER_COUNT_CRITERIA,
  PEER_RATE_CRITERIA,
  isPeerCriteria
} from '../services/peerQuests.service';
import { BadgeRarity } from '@prisma/client';
import { IN_PROGRAMME_CUBE_LEVELS } from '../config/constants';

const router = Router();

// Create Quest (Admin only)
router.post('/admin/quests', requireAuth, isAdmin, async (req, res) => {
  try {
    const { title, description, difficulty, criteria_type, criteria_value, min_sample_size, is_timed, expires_at, reward_badge_ids, dependency_quest_id, auto_assign } = req.body;

    if (!title || !description || !criteria_type || criteria_value === undefined) {
      throw badRequest('Missing required quest fields: title, description, criteria_type, and criteria_value are required.');
    }

    const trimmedTitle = String(title).trim();
    const existing = await prisma.quest.findFirst({ where: { title: trimmedTitle } });
    if (existing) {
      throw conflict(`A quest with the title "${trimmedTitle}" already exists.`);
    }

    // Validate criteria_type
    const validCriteriaTypes = [
      'missions_completed',
      'missions_assigned',
      'average_score',
      'login_streak',
      'meeting_attendance',
      'custom',
      'profile_completion',
      'write_testimonial',
      'mission_updates_count',
      'mission_updates',
      'daily_update_streak',
      'weekly_update_streak',
      'nda_signed',
      'profile_picture',
      'avatar_upload',
      'quiz_score',
      'quiz_completed',
      ...PEER_CRITERIA
    ];
    if (!validCriteriaTypes.includes(criteria_type)) {
      throw badRequest(`Criteria type must be one of: ${validCriteriaTypes.join(', ')}.`);
    }

    // Validate binary criteria
    const BINARY_CRITERIA = ['nda_signed', 'profile_picture', 'avatar_upload', 'quiz_completed'];
    if (BINARY_CRITERIA.includes(criteria_type)) {
      const parsed = Number(criteria_value);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw badRequest(`For "${criteria_type}" quests, Goal Target Value must be a positive whole number (typically 1).`);
      }
    }

    // Validate count and streak criteria
    const COUNT_OR_STREAK_CRITERIA = ['mission_updates_count', 'mission_updates', 'daily_update_streak', 'weekly_update_streak'];
    if (COUNT_OR_STREAK_CRITERIA.includes(criteria_type)) {
      const parsed = Number(criteria_value);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw badRequest(`For "${criteria_type}" quests, Goal Target Value must be a positive whole number of at least 1.`);
      }
    }

    // Peer criteria. Counts must be whole numbers >= 1; the title tier is
    // 1 (Common) to 3 (Epic); calibration is a percentage.
    if (isPeerCriteria(criteria_type)) {
      const parsed = Number(criteria_value);
      if (PEER_COUNT_CRITERIA.includes(criteria_type)) {
        if (!Number.isInteger(parsed) || parsed < 1) {
          throw badRequest(`For "${criteria_type}" quests, Goal Target Value must be a whole number of at least 1.`);
        }
      } else if (criteria_type === 'peer_title_tier') {
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3) {
          throw badRequest('For "peer_title_tier" quests, Goal Target Value must be 1 (Common), 2 (Rare) or 3 (Epic).');
        }
      } else if (PEER_RATE_CRITERIA.includes(criteria_type)) {
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
          throw badRequest(`For "${criteria_type}" quests, Goal Target Value must be a whole percentage from 1 to 100.`);
        }
      }
    }

    // Validate difficulty
    const rarity = difficulty ? (difficulty as BadgeRarity) : BadgeRarity.Common;
    if (!Object.values(BadgeRarity).includes(rarity)) {
      throw badRequest(`Difficulty/Rarity must be one of: ${Object.values(BadgeRarity).join(', ')}.`);
    }

    // The service only ever tracks 3 parts for this criteria (GitHub URL,
    // LinkedIn URL, 3+ skills — see quest.service.ts). Two authoring styles
    // are both valid: a target of 1-3 ("require this many parts"), or a
    // target above 3 up to 100 ("require this % complete", e.g. 100 for "all
    // 3 parts"). Anything outside 1-100, or a non-whole number, can never be
    // satisfied and was previously accepted silently.
    if (criteria_type === 'profile_completion') {
      const parsedTarget = Number(criteria_value);
      if (!Number.isInteger(parsedTarget) || parsedTarget < 1 || parsedTarget > 100) {
        throw badRequest(
          'For "profile_completion" quests, Goal Target Value must be a whole number: either 1-3 ' +
          '(require that many of GitHub URL / LinkedIn URL / 3+ skills), or a percentage up to 100 ' +
          '(e.g. 100 to require all 3 parts).'
        );
      }
    }

    // Only meaningful for "rate" criteria — a count-based quest's target IS the
    // count, it has no separate sample size. Reject it elsewhere so a typo in
    // the admin form can't silently do nothing.
    const RATE_CRITERIA_TYPES = ['average_score', 'meeting_attendance', ...PEER_RATE_CRITERIA];
    let minSampleSize: number | null = null;
    if (min_sample_size !== undefined && min_sample_size !== null && min_sample_size !== '') {
      if (!RATE_CRITERIA_TYPES.includes(criteria_type)) {
        throw badRequest(
          `min_sample_size only applies to rate-based criteria (${RATE_CRITERIA_TYPES.join(', ')}).`
        );
      }
      const parsed = Number(min_sample_size);
      if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
        throw badRequest('min_sample_size must be a whole number of at least 1.');
      }
      minSampleSize = parsed;
    }

    const badgeIds: string[] = Array.isArray(reward_badge_ids) ? reward_badge_ids : [];

    const quest = await prisma.quest.create({
      data: {
        title: trimmedTitle,
        description: String(description).trim(),
        difficulty: rarity,
        criteria_type,
        criteria_value: Number(criteria_value),
        min_sample_size: minSampleSize,
        auto_assign: auto_assign === true,
        is_timed: is_timed === true,
        expires_at: expires_at ? new Date(expires_at) : null,
        dependency_quest_id: dependency_quest_id || null,
        rewards: {
          connect: badgeIds.map(id => ({ id }))
        }
      },
      include: { rewards: true }
    });

    // Auto-assign quests go straight to every eligible Cube. Best-effort: the
    // quest exists either way, and the login hook picks up anyone missed.
    let autoAssigned: { newlyAssigned: number; skipped: number } | null = null;
    if (quest.auto_assign) {
      try {
        autoAssigned = await autoAssignQuestToEligibleCubes(quest.id);
      } catch (err) {
        console.error(`Auto-assign after creating quest ${quest.id} failed:`, err);
      }
    }

    return res.status(201).json({ ...quest, auto_assigned: autoAssigned });
  } catch (error: any) {
    return sendError(res, error);
  }
});

// List Quests (Cube list progress, Admin/Mentor list definitions)
router.get('/quests', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) throw forbidden('Unauthorized');

    if (req.user.role === 'CUBE') {
      const cubeProfileId = req.user.cubeProfileId;
      if (!cubeProfileId) {
        return res.json([]);
      }

      // Fetch assigned quests with progress
      const cubeQuests = await prisma.cubeQuest.findMany({
        where: { cube_id: cubeProfileId },
        include: {
          quest: {
            include: { rewards: true }
          }
        },
        orderBy: { assigned_at: 'desc' }
      });

      return res.json(cubeQuests);
    } 
    else {
      // Admins/Mentors view all quest definitions
      const quests = await prisma.quest.findMany({
        include: {
          rewards: true,
          cube_quests: {
            include: {
              cube: { include: { user: { select: { name: true } } } }
            }
          }
        },
        orderBy: { created_at: 'desc' }
      });

      return res.json(quests);
    }
  } catch (error: any) {
    return sendError(res, error);
  }
});

// Assign Quest to Cubes (Admin only)
router.post('/admin/quests/assign', requireAuth, isAdmin, async (req, res) => {
  try {
    const { questId, target, cubeProfileIds } = req.body;

    if (!questId) {
      throw badRequest('questId is required.');
    }

    const quest = await prisma.quest.findUnique({ where: { id: questId } });
    if (!quest) throw notFound('Quest not found');

    let idsToAssign: string[] = [];

    if (target === 'all') {
      const cubes = await prisma.cubeProfile.findMany({
        where: { current_level: { in: IN_PROGRAMME_CUBE_LEVELS } },
        select: { id: true }
      });
      idsToAssign = cubes.map(c => c.id);
    } else if (Array.isArray(cubeProfileIds)) {
      idsToAssign = cubeProfileIds;
    } else {
      throw badRequest('Specify target as "all" or supply an array of cubeProfileIds.');
    }

    if (idsToAssign.length === 0) {
      return res.json({ success: true, message: 'No active Cubes found to assign.' });
    }

    const result = await assignQuestToCubes(questId, idsToAssign);

    // Assignment evaluates progress immediately, so a Cube whose profile /
    // mission history / scorecards already satisfy the quest completes right
    // here — no separate "verify" step needed for that case. The message
    // says so explicitly instead of just "assigned to N", which previously
    // gave no visibility into how many completed on the spot or failed.
    const parts = [`${result.newlyAssigned} newly assigned`];
    if (result.completedImmediately > 0) {
      parts.push(`${result.completedImmediately} completed immediately (badge awarded)`);
    }
    if (result.alreadyAssigned > 0) {
      parts.push(`${result.alreadyAssigned} already had this quest (skipped)`);
    }
    if (result.failed.length > 0) {
      parts.push(`${result.failed.length} failed to evaluate — use "Force calculation" to retry`);
    }

    return res.json({
      success: true,
      message: `Quest assignment complete: ${parts.join(', ')}.`,
      ...result
    });
  } catch (error: any) {
    return sendError(res, error);
  }
});

// Switch auto-assignment on or off for a quest (Admin only).
// Turning it on assigns to currently eligible Cubes once; turning it off never
// removes existing assignments.
router.patch('/admin/quests/:id/auto-assign', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { auto_assign } = req.body;
    if (typeof auto_assign !== 'boolean') {
      throw badRequest('auto_assign must be true or false.');
    }

    const quest = await prisma.quest.findUnique({ where: { id } });
    if (!quest) throw notFound('Quest not found');

    const updated = await prisma.quest.update({ where: { id }, data: { auto_assign } });

    let autoAssigned: { newlyAssigned: number; skipped: number } | null = null;
    if (auto_assign && !quest.auto_assign) {
      autoAssigned = await autoAssignQuestToEligibleCubes(id);
    }

    return res.json({ ...updated, auto_assigned: autoAssigned });
  } catch (error: any) {
    return sendError(res, error);
  }
});

// Force calculation of progress for all incomplete quest trackers (Admin/Mentor only)
router.post('/admin/quests/:id/verify', requireAuth, isMentorOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const quest = await prisma.quest.findUnique({ where: { id } });
    if (!quest) throw notFound('Quest not found');

    // Auto-heal corrupt or zero target value for binary criteria
    if (['profile_picture', 'avatar_upload', 'nda_signed'].includes(quest.criteria_type) && quest.criteria_value < 1) {
      await prisma.quest.update({
        where: { id },
        data: { criteria_value: 1 }
      });
      quest.criteria_value = 1;
    }

    // Recheck ALL assigned cubes (both completed and incomplete) with forceRecheck
    const cubeQuests = await prisma.cubeQuest.findMany({
      where: { quest_id: id },
      select: { cube_id: true, is_completed: true }
    });

    let newlyCompleted = 0;
    let newlyReverted = 0;
    let totalCompleted = 0;

    for (const cq of cubeQuests) {
      const result = await verifyQuestProgress(cq.cube_id, id, { forceRecheck: true });
      if (result.is_completed) {
        totalCompleted++;
        if (!cq.is_completed) newlyCompleted++;
      } else if (cq.is_completed && !result.is_completed) {
        newlyReverted++;
      }
    }

    let message = `Verified progress for ${cubeQuests.length} assigned Cube(s). ${totalCompleted} completed.`;
    if (newlyReverted > 0) {
      message += ` (${newlyReverted} reverted due to missing criteria)`;
    }

    return res.json({
      success: true,
      evaluated: cubeQuests.length,
      totalCompleted,
      newlyCompleted,
      newlyReverted,
      message
    });
  } catch (error: any) {
    return sendError(res, error);
  }
});

// Update manual progress for "custom" criteria type quests (Admin/Mentor only)
router.post('/admin/quests/custom-progress', requireAuth, isMentorOrAdmin, async (req, res) => {
  try {
    const { cubeProfileId, questId, value } = req.body;

    if (!cubeProfileId || !questId || value === undefined) {
      throw badRequest('Missing parameters: cubeProfileId, questId, and value are required.');
    }

    const cubeQuest = await prisma.cubeQuest.findUnique({
      where: { cube_id_quest_id: { cube_id: cubeProfileId, quest_id: questId } },
      include: { quest: true }
    });

    if (!cubeQuest) {
      throw notFound('Quest assignment not found for this Cube.');
    }

    if (cubeQuest.quest.criteria_type !== 'custom') {
      throw badRequest('Manual progress can only be updated for quests with "custom" criteria.');
    }

    // Update current value
    await prisma.cubeQuest.update({
      where: { cube_id_quest_id: { cube_id: cubeProfileId, quest_id: questId } },
      data: { current_value: Number(value) }
    });

    // Run verification immediately
    const updated = await verifyQuestProgress(cubeProfileId, questId);

    return res.json({
      success: true,
      current_value: updated.current_value,
      is_completed: updated.is_completed,
      message: updated.is_completed 
        ? 'Progress updated. Quest is now completed!' 
        : 'Progress updated successfully.'
    });
  } catch (error: any) {
    return sendError(res, error);
  }
});

// Admin Override (Force Complete or Revert) quest status (Admin/Mentor only)
router.post('/admin/quests/override', requireAuth, isMentorOrAdmin, async (req, res) => {
  try {
    const { cubeProfileId, questId, action } = req.body;

    if (!cubeProfileId || !questId || !action) {
      throw badRequest('Missing parameters: cubeProfileId, questId, and action are required.');
    }

    if (action !== 'complete' && action !== 'revert') {
      throw badRequest('Action must be either "complete" or "revert".');
    }

    const cubeQuest = await prisma.cubeQuest.findUnique({
      where: { cube_id_quest_id: { cube_id: cubeProfileId, quest_id: questId } },
      include: { quest: { include: { rewards: true } } }
    });

    if (!cubeQuest) {
      throw notFound('Quest assignment not found for this Cube.');
    }

    const systemAdmin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true }
    });
    const awardedById = systemAdmin?.id || 'system';

    const result = await prisma.$transaction(async (tx) => {
      if (action === 'complete') {
        // Force complete
        const updated = await tx.cubeQuest.update({
          where: { cube_id_quest_id: { cube_id: cubeProfileId, quest_id: questId } },
          data: {
            is_completed: true,
            completed_at: new Date(),
            current_value: cubeQuest.quest.criteria_value
          }
        });

        // Award badges
        for (const badge of cubeQuest.quest.rewards) {
          const alreadyAwarded = await tx.cubeBadge.findFirst({
            where: { cube_id: cubeProfileId, badge_id: badge.id }
          });

          if (!alreadyAwarded) {
            await tx.cubeBadge.create({
              data: {
                cube_id: cubeProfileId,
                badge_id: badge.id,
                reason: `Manually completed by Admin: ${cubeQuest.quest.title}`,
                awarded_by_id: awardedById
              }
            });
          }
        }

        // Create notification
        const profile = await tx.cubeProfile.findUnique({
          where: { id: cubeProfileId },
          select: { user_id: true }
        });
        if (profile) {
          await tx.notification.create({
            data: {
              user_id: profile.user_id,
              message: `🎉 Quest manually completed by Admin: "${cubeQuest.quest.title}"!`
            }
          });
        }

        return updated;
      } else {
        // Revert completion
        const updated = await tx.cubeQuest.update({
          where: { cube_id_quest_id: { cube_id: cubeProfileId, quest_id: questId } },
          data: {
            is_completed: false,
            completed_at: null,
            current_value: 0
          }
        });

        // Remove awarded badges
        for (const badge of cubeQuest.quest.rewards) {
          await tx.cubeBadge.deleteMany({
            where: {
              cube_id: cubeProfileId,
              badge_id: badge.id
            }
          });
        }

        // Create notification
        const profile = await tx.cubeProfile.findUnique({
          where: { id: cubeProfileId },
          select: { user_id: true }
        });
        if (profile) {
          await tx.notification.create({
            data: {
              user_id: profile.user_id,
              message: `⚠️ Quest reverted by Admin: "${cubeQuest.quest.title}". Progress reset.`
            }
          });
        }

        return updated;
      }
    });

    return res.json({
      success: true,
      cubeQuest: result,
      message: action === 'complete' ? 'Quest manually completed successfully.' : 'Quest successfully reverted to In Progress.'
    });
  } catch (error: any) {
    return sendError(res, error);
  }
});

export default router;
