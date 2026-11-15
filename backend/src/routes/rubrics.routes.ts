/**
 * Scoring v2 criteria and rubrics. Staff read them (the scorecard form);
 * admins edit them. See services/rubric.service.ts.
 */
import { Router } from 'express';
import { requireAuth, isAdmin, isMentorOrAdmin, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { badRequest, sendError } from '../utils/http';
import {
  createCriterion,
  criteriaForDiscipline,
  listAllCriteria,
  saveLevels,
  updateCriterion,
} from '../services/rubric.service';

const router = Router();

/** Criteria and rubric for one discipline (core + its own); `?discipline_id=` optional. */
router.get('/scoring/criteria', requireAuth, isMentorOrAdmin, async (req, res) => {
  try {
    const disciplineId = req.query.discipline_id;
    if (disciplineId !== undefined && typeof disciplineId !== 'string') throw badRequest('discipline_id must be an id.');
    return res.json(await criteriaForDiscipline(disciplineId || null));
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/admin/criteria', requireAuth, isAdmin, async (_req, res) => {
  try {
    return res.json(await listAllCriteria());
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/admin/criteria', requireAuth, isAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    return res.status(201).json(await createCriterion(req.body || {}, req.user!.id));
  } catch (error) {
    return sendError(res, error);
  }
});

router.patch('/admin/criteria/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    return res.json(await updateCriterion(req.params.id, req.body || {}));
  } catch (error) {
    return sendError(res, error);
  }
});

router.put('/admin/criteria/:id/levels', requireAuth, isAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    return res.json(await saveLevels(req.params.id, req.body?.levels, req.user!.id));
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
