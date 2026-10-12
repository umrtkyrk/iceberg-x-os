/**
 * Hall of Fame: the progression ladder and the Iceberger -> Mentor promotion.
 */
import { Router } from 'express';
import { requireAuth, isAdmin, isMentorOrAdmin } from '../middlewares/auth.middleware';
import { sendError } from '../utils/http';
import {
  getHallOfFame,
  promoteIcebergersToMentors,
  revertMentorPromotion,
  setSeniorCandidate
} from '../services/hallOfFame.service';

const router = Router();

// Everyone signed in can see the ladder.
router.get('/hall-of-fame', requireAuth, async (_req, res) => {
  try {
    return res.json(await getHallOfFame());
  } catch (error) {
    return sendError(res, error);
  }
});

// Promote Icebergers to Mentors (Admin only). Body: { profileIds: string[] } or { all: true }.
router.post('/hall-of-fame/promote', requireAuth, isAdmin, async (req, res) => {
  try {
    return res.json(await promoteIcebergersToMentors(req.body || {}));
  } catch (error) {
    return sendError(res, error);
  }
});

// Undo a promotion (Admin only).
router.post('/hall-of-fame/revert/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    return res.json(await revertMentorPromotion(req.params.id));
  } catch (error) {
    return sendError(res, error);
  }
});

// Mark or unmark a Cube as a Senior Cube candidate (Mentor / Admin).
router.patch('/cubes/:id/senior-candidate', requireAuth, isMentorOrAdmin, async (req, res) => {
  try {
    return res.json(await setSeniorCandidate(req.params.id, req.body?.value));
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
