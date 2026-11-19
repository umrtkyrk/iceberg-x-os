/**
 * Scoring v2 disciplines: the list for forms, and admin management and
 * assignment. See services/discipline.service.ts.
 */
import { Router } from 'express';
import { requireAuth, isAdmin } from '../middlewares/auth.middleware';
import { sendError } from '../utils/http';
import {
  applyAssignments,
  createDiscipline,
  listDisciplines,
  loadAssignments,
  updateDiscipline,
} from '../services/discipline.service';

const router = Router();

/** Active disciplines, for pickers such as the mission form. */
router.get('/disciplines', requireAuth, async (_req, res) => {
  try {
    return res.json(await listDisciplines());
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/admin/disciplines', requireAuth, isAdmin, async (_req, res) => {
  try {
    return res.json(await listDisciplines({ includeInactive: true }));
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/admin/disciplines', requireAuth, isAdmin, async (req, res) => {
  try {
    return res.status(201).json(await createDiscipline(req.body || {}));
  } catch (error) {
    return sendError(res, error);
  }
});

router.patch('/admin/disciplines/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    return res.json(await updateDiscipline(req.params.id, req.body || {}));
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/admin/disciplines/assignments', requireAuth, isAdmin, async (_req, res) => {
  try {
    return res.json(await loadAssignments());
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/admin/disciplines/assignments', requireAuth, isAdmin, async (req, res) => {
  try {
    return res.json(await applyAssignments(req.body || {}));
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
