/**
 * Portal usage pings from the browser: page views and "still here" heartbeats.
 * See services/activity.service.ts for what is stored.
 */
import { Router } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { badRequest, sendError } from '../utils/http';
import { recordActivity } from '../services/activity.service';

const router = Router();

router.post('/activity/ping', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { type, path } = req.body || {};
    if (type !== 'view' && type !== 'heartbeat') throw badRequest('Unknown activity type');

    const recorded = await recordActivity(req.user!.id, type, path);
    return res.json({ ok: true, recorded });
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
