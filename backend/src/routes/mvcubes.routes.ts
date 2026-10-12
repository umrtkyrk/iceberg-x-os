/**
 * MVCubes: monthly category winners. Winners only, never a full ranking.
 */
import { Router } from 'express';
import { requireAuth, isAdmin } from '../middlewares/auth.middleware';
import { badRequest, sendError } from '../utils/http';
import { computeMvcubes, getMvcubes } from '../services/mvcubes.service';

const router = Router();

router.get('/mvcubes', requireAuth, async (req, res) => {
  try {
    const period = typeof req.query.period === 'string' ? req.query.period : undefined;
    return res.json(await getMvcubes(period));
  } catch (error) {
    return sendError(res, error);
  }
});

// Idempotent: a category already awarded for the period is left untouched.
router.post('/mvcubes/compute', requireAuth, isAdmin, async (req, res) => {
  try {
    const period = req.body?.period;
    if (typeof period !== 'string') throw badRequest('period is required, for example 2026-10.');
    return res.json(await computeMvcubes(period));
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
