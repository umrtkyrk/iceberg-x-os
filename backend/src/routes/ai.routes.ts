/**
 * AI drafting helpers.
 */
import { Router } from 'express';
import prisma from '../services/prisma';
import { requireAuth, isMentorOrAdmin } from '../middlewares/auth.middleware';
import { sendError } from '../utils/http';
import { loadPredecessorBriefs, normalizeIds, MAX_PREDECESSORS } from '../services/missionLink.service';
import { generatePredecessorContext, generateMissionSummary, generateCubeProgressSummary, generateDemoReflectionHelper, generateMentorFeedbackDraft } from '../services/ai.service';

const router = Router();

// Mission summary generator
router.get('/ai/mission-summary/:missionId', requireAuth, isMentorOrAdmin, async (req, res) => {
  try {
    const { missionId } = req.params;
    const mission = await prisma.mission.findUnique({
      where: { id: missionId },
      include: {
        updates: { select: { content: true } },
        demo_submissions: { select: { title: true, summary: true, what_we_built: true, what_we_learned: true } },
        mentor_feedbacks: { select: { strengths: true, areas_to_improve: true } }
      }
    });

    if (!mission) return res.status(404).json({ error: 'Mission not found' });

    const updatesText = mission.updates.map(u => u.content);
    const lastDemo = mission.demo_submissions[0] || null;
    const feedbackText = mission.mentor_feedbacks.map(f => `${f.strengths}. ${f.areas_to_improve}`);

    const summary = await generateMissionSummary(
      mission.title,
      mission.description,
      updatesText,
      lastDemo,
      feedbackText
    );

    return res.json({ summary });
  } catch (error: any) {
    return sendError(res, error);
  }
});

// Background block for a follow-up mission, built from the missions it continues
router.post('/ai/mission-context', requireAuth, isMentorOrAdmin, async (req, res) => {
  try {
    const ids = normalizeIds(req.body.predecessor_ids);
    if (ids.length === 0) return res.status(400).json({ error: 'Select at least one earlier mission' });
    if (ids.length > MAX_PREDECESSORS) {
      return res.status(400).json({ error: `Select at most ${MAX_PREDECESSORS} earlier missions` });
    }

    const briefs = await loadPredecessorBriefs(ids);
    if (briefs.length === 0) return res.status(404).json({ error: 'Selected missions were not found' });

    const context = await generatePredecessorContext(
      String(req.body.title || '').slice(0, 300),
      String(req.body.description || '').slice(0, 3000),
      briefs
    );

    return res.json({ context, missions: briefs.map(b => b.title) });
  } catch (error: any) {
    return sendError(res, error);
  }
});

// Cube progress summary generator
router.get('/ai/cube-summary/:cubeId', requireAuth, isMentorOrAdmin, async (req, res) => {
  try {
    const { cubeId } = req.params; // CubeProfile ID
    const profile = await prisma.cubeProfile.findUnique({
      where: { id: cubeId },
      include: {
        user: { select: { name: true, id: true } },
        cube_badges: { include: { badge: true } }
      }
    });

    if (!profile) return res.status(404).json({ error: 'Cube profile not found' });

    // Fetch details
    const updates = await prisma.update.findMany({ where: { cube_id: profile.user_id } });
    const demos = await prisma.demoSubmission.findMany({ where: { submitted_by_id: profile.user_id } });
    const feedback = await prisma.mentorFeedback.findMany({ where: { cube_id: profile.user_id } });

    // Check if user has no activity data at all
    if (updates.length === 0 && demos.length === 0 && feedback.length === 0 && profile.cube_badges.length === 0) {
      return res.json({
        summary: JSON.stringify({
          noData: true,
          message: "No activity data recorded yet. Please submit updates, demo day projects, or receive evaluations before an AI progress summary can be generated."
        })
      });
    }

    const updatesText = updates.map(u => u.content);
    const demosText = demos.map(d => d.summary);
    const badgeNames = profile.cube_badges.map(b => b.badge.name);
    const scores = feedback.map(f => ({
      technical: f.technical_ability_score,
      research: f.research_ability_score,
      ownership: f.ownership_score,
      communication: f.communication_score
    }));
    const mentorComments = feedback.map(f => `${f.strengths}. ${f.areas_to_improve}`);

    const progressSummary = await generateCubeProgressSummary(
      profile.user.name,
      profile.cube_number,
      profile,
      updatesText,
      demosText,
      scores,
      badgeNames,
      mentorComments
    );

    return res.json({ summary: progressSummary });
  } catch (error: any) {
    return sendError(res, error);
  }
});

// Demo Day reflection helper
router.post('/ai/demo-reflection', requireAuth, async (req, res) => {
  try {
    const { title, summary, what_we_built, what_we_learned, what_worked_well, what_could_we_have_done_better } = req.body;
    if (!title || !what_could_we_have_done_better) {
      return res.status(400).json({ error: 'Demo title and what we could have done better are required' });
    }

    const reflection = await generateDemoReflectionHelper(
      title,
      summary || '',
      what_we_built || '',
      what_we_learned || '',
      what_worked_well || '',
      what_could_we_have_done_better
    );

    return res.json({ reflection });
  } catch (error: any) {
    return sendError(res, error);
  }
});

// Mentor feedback draft helper
router.post('/ai/feedback-draft', requireAuth, isMentorOrAdmin, async (req, res) => {
  try {
    const { scores, notes, cube_id } = req.body; // scores: { technical, research, ... }, notes: string
    if (!scores || !cube_id) {
      return res.status(400).json({ error: 'Scores and cube_id are required' });
    }

    // Get updates for this Cube
    const updates = await prisma.update.findMany({
      where: { cube_id },
      take: 5,
      orderBy: { created_at: 'desc' }
    });
    const updatesText = updates.map(u => u.content);

    const draft = await generateMentorFeedbackDraft(
      scores,
      notes || '',
      updatesText
    );

    return res.json({ draft });
  } catch (error: any) {
    return sendError(res, error);
  }
});

export default router;
