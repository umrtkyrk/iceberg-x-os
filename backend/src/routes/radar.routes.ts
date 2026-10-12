/**
 * Radar: Hidden Gems and Needs Attention (Mentor / Admin).
 * Aggregates, plus the feedback text itself (never the writer): see
 * services/radar.service.ts and services/staffFeedback.service.ts.
 */
import { Router } from 'express';
import { requireAuth, isMentorOrAdmin, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { sendError } from '../utils/http';
import {
  listHiddenGems,
  listNeedsAttention,
  updateSignalState
} from '../services/radar.service';
import { listFeedbackFeed, listFeedbackForCube } from '../services/staffFeedback.service';

const router = Router();

router.get('/radar/hidden-gems', requireAuth, isMentorOrAdmin, async (_req, res) => {
  try {
    return res.json(await listHiddenGems());
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/radar/needs-attention', requireAuth, isMentorOrAdmin, async (_req, res) => {
  try {
    return res.json(await listNeedsAttention());
  } catch (error) {
    return sendError(res, error);
  }
});

// What was written about one Cube. The note and tags, never who wrote them.
router.get('/radar/cubes/:id/feedback', requireAuth, isMentorOrAdmin, async (req, res) => {
  try {
    return res.json(await listFeedbackForCube(req.params.id));
  } catch (error) {
    return sendError(res, error);
  }
});

// A feed of everything written, newest first. Query: kind, cube_id, before, take.
router.get('/radar/feedback', requireAuth, isMentorOrAdmin, async (req, res) => {
  try {
    const q = req.query;
    return res.json(
      await listFeedbackFeed({
        kind: typeof q.kind === 'string' ? q.kind : undefined,
        cubeProfileId: typeof q.cube_id === 'string' ? q.cube_id : undefined,
        before: typeof q.before === 'string' ? q.before : undefined,
        take: typeof q.take === 'string' ? Number(q.take) : undefined
      })
    );
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/radar/signals/:id/state', requireAuth, isMentorOrAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await updateSignalState(req.params.id, req.user!.id, req.body || {});
    return res.json(result);
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
