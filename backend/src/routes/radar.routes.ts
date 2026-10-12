/**
 * Radar: Hidden Gems and Needs Attention (Mentor / Admin).
 * Aggregates only; see services/radar.service.ts.
 */
import { Router } from 'express';
import { requireAuth, isMentorOrAdmin, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { sendError } from '../utils/http';
import {
  listHiddenGems,
  listNeedsAttention,
  updateSignalState
} from '../services/radar.service';

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

router.post('/radar/signals/:id/state', requireAuth, isMentorOrAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await updateSignalState(req.params.id, req.user!.id, req.body || {});
    return res.json(result);
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
