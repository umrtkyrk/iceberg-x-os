/**
 * Scoring v2 reads (shadow, calibration, a Cube's score), check-ins, and the
 * admin operations page (/admin/ops).
 */
import { Router } from 'express';
import prisma from '../services/prisma';
import { requireAuth, isAdmin, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { forbidden, notFound, sendError } from '../utils/http';
import { calibrationReport, createCheckIn, isScoringV2Live, listCheckIns, liveScore, shadowReport } from '../services/scoreV2.data';
import { listOperations, runOperation } from '../services/ops.service';

const router = Router();

router.get('/admin/scoring/shadow', requireAuth, isAdmin, async (_req, res) => {
  try {
    return res.json(await shadowReport());
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/admin/scoring/calibration', requireAuth, isAdmin, async (_req, res) => {
  try {
    return res.json(await calibrationReport());
  } catch (error) {
    return sendError(res, error);
  }
});

/**
 * A Cube's v2 score. Staff can always read it; the Cube only once the v2 score
 * is live. Private note content is never part of it, only its effect.
 */
router.get('/cubes/:id/score-v2', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const isStaff = user.role === 'ADMIN' || user.role === 'MENTOR';
    const isOwner = user.role === 'CUBE' && user.cubeProfileId === req.params.id;
    if (!isStaff && !(isOwner && isScoringV2Live())) throw forbidden('This score is not available.');
    if (!(await prisma.cubeProfile.findUnique({ where: { id: req.params.id }, select: { id: true } }))) throw notFound('Cube not found.');
    return res.json({ live: isScoringV2Live(), ...(await liveScore(req.params.id)) });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/check-ins', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    return res.status(201).json(await createCheckIn(req.user!, req.body || {}));
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/cubes/:id/check-ins', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    return res.json(await listCheckIns(req.user!, req.params.id));
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/admin/ops', requireAuth, isAdmin, async (_req, res) => {
  try {
    return res.json(await listOperations());
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/admin/ops/:key/run', requireAuth, isAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    return res.json(await runOperation(req.params.key, req.user!.id));
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
