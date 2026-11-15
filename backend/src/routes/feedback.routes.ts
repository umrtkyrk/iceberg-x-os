/**
 * Mentor feedback scorecards.
 */
import { Router } from 'express';
import prisma from '../services/prisma';
import { requireAuth, isAdmin, isMentorOrAdmin, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { MIN_SCORE, MAX_SCORE } from '../config/constants';
import { badRequest, conflict, forbidden, sendError, parseScore } from '../utils/http';
import { createSingleNotification } from '../services/notification.service';
import { recalculateAllQuestsForCube } from '../services/quest.service';
import { CubeLevel, Prisma, RecommendedNextStep } from '@prisma/client';
import { criteriaForDiscipline } from '../services/rubric.service';
import { legacyColumns, normalizeRatings, type NormalizedRating } from '../services/scorecard.service';

const router = Router();

// Add Mentor Feedback / Review (Mentor or Admin)
router.post('/feedback', requireAuth, isMentorOrAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      cube_id, // User ID of Cube
      mission_id,
      technical_ability_score,
      research_ability_score,
      demo_output_score,
      ownership_score,
      communication_score,
      leadership_score,
      product_thinking_score,
      reliability_score,
      self_reflection_score,
      strengths,
      areas_to_improve,
      private_notes,
      visible_to_cube,
      recommended_next_step
    } = req.body;

    if (!cube_id || !recommended_next_step || !strengths || !areas_to_improve) {
      throw badRequest('Missing feedback fields');
    }

    // Alumni have graduated, so there is nothing left to assess. A Former Cube
    // is only paused and may return, so their record stays open for a final
    // assessment.
    const target = await prisma.user.findUnique({
      where: { id: cube_id },
      select: { name: true, cube_profile: { select: { current_level: true, discipline_id: true } } }
    });
    if (target?.cube_profile?.current_level === CubeLevel.Alumni) {
      throw conflict(
        `${target.name} has graduated as Alumni. Scorecards are only for Cubes still in the programme.`
      );
    }

    if (!req.user) throw forbidden('Unauthorized');
    const mentorId = req.user.id;
    const targetMissionId = mission_id ? String(mission_id) : null;

    // Two shapes are accepted. Scoring v2 sends `ratings` (one per criterion
    // of the mission's or Cube's discipline); the legacy form sends the nine
    // fixed columns. v2 ratings are mirrored into the legacy columns that map
    // to them, so the current score, radar chart and quests keep working.
    let scores: Record<string, number | null>;
    let ratings: NormalizedRating[] | null = null;
    if (req.body.ratings !== undefined) {
      const mission = targetMissionId
        ? await prisma.mission.findUnique({ where: { id: targetMissionId }, select: { discipline_id: true } })
        : null;
      const disciplineId = mission?.discipline_id ?? target?.cube_profile?.discipline_id ?? null;
      const applicable = await criteriaForDiscipline(disciplineId);
      ratings = normalizeRatings(req.body.ratings, applicable);
      scores = legacyColumns(ratings, applicable);
    } else {
      // The radar chart renders score / 5, so anything outside 1..5 (or NaN from
      // an empty field) corrupted the chart. Validate before writing.
      const rawScores: Record<string, any> = {
        technical_ability_score,
        research_ability_score,
        demo_output_score,
        ownership_score,
        communication_score,
        leadership_score,
        product_thinking_score,
        reliability_score,
        self_reflection_score
      };

      const legacyScores: Record<string, number> = {};
      const invalidScores: string[] = [];
      for (const [key, value] of Object.entries(rawScores)) {
        const parsed = parseScore(value);
        if (parsed === null) {
          invalidScores.push(key);
        } else {
          legacyScores[key] = parsed;
        }
      }

      if (invalidScores.length > 0) {
        throw badRequest(
          `Scores must be whole numbers between ${MIN_SCORE} and ${MAX_SCORE}.`,
          { invalidScores }
        );
      }
      scores = legacyScores;
    }

    const feedbackData = {
      ...(scores as any),
      strengths,
      areas_to_improve,
      private_notes,
      visible_to_cube: !!visible_to_cube,
      recommended_next_step: recommended_next_step as RecommendedNextStep
    };

    const feedback = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      let saved;
      if (!targetMissionId) {
        // Postgres treats NULLs as distinct, so the composite unique constraint
        // does not cover general (mission-less) feedback; look it up explicitly.
        const existing = await tx.mentorFeedback.findFirst({
          where: {
            cube_id,
            mission_id: null,
            mentor_id: mentorId
          }
        });

        saved = existing
          ? await tx.mentorFeedback.update({ where: { id: existing.id }, data: feedbackData })
          : await tx.mentorFeedback.create({
              data: { cube_id, mission_id: null, mentor_id: mentorId, ...feedbackData }
            });
      } else {
        // Upsert feedback for mission-based feedback
        saved = await tx.mentorFeedback.upsert({
          where: {
            cube_id_mission_id_mentor_id: {
              cube_id,
              mission_id: targetMissionId,
              mentor_id: mentorId
            }
          },
          update: feedbackData,
          create: {
            cube_id,
            mission_id: targetMissionId,
            mentor_id: mentorId,
            ...feedbackData
          }
        });
      }

      // Re-scoring replaces the ratings; a legacy-form save clears them so the
      // legacy columns are the only source for that scorecard.
      await tx.scorecardRating.deleteMany({ where: { feedback_id: saved.id } });
      if (ratings) {
        await tx.scorecardRating.createMany({
          data: ratings.map(r => ({ feedback_id: saved.id, criterion_id: r.criterion_id, value: r.value }))
        });
      }
      return saved;
    });

    await createSingleNotification(cube_id, "A mentor graded your scorecard.");

    // A new or updated score may now satisfy an "average_score" quest.
    // cube_id here is the User id; quest tracking runs against CubeProfile.id.
    if (target?.cube_profile) {
      const profile = await prisma.cubeProfile.findUnique({
        where: { user_id: cube_id },
        select: { id: true }
      });
      if (profile) {
        recalculateAllQuestsForCube(profile.id).catch(err =>
          console.error(`Quest recalculation failed for cube ${profile.id}:`, err)
        );
      }
    }

    return res.status(201).json(feedback);
  } catch (error: any) {
    return sendError(res, error);
  }
});

router.delete('/feedback/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.mentorFeedback.delete({ where: { id } });
    return res.json({ success: true, message: 'Feedback deleted successfully' });
  } catch (error: any) {
    return sendError(res, error);
  }
});

export default router;
