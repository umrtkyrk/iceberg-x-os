/**
 * Peer feedback: giving, receiving, pinning and the profile summary.
 *
 * Handlers never return giver identity. See services/peer.service.ts for the
 * privacy contract.
 */
import { Router } from 'express';
import { requireAuth, isCube, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { forbidden, sendError } from '../utils/http';
import {
  createPeerFeedback,
  getBudget,
  getCatalog,
  getPeerSummary,
  listGiven,
  listReceived,
  markHelpful,
  pinFeedback,
  unpinFeedback
} from '../services/peer.service';

const router = Router();

function requireCubeProfile(req: AuthenticatedRequest): string {
  if (!req.user?.cubeProfileId) throw forbidden('A Cube profile is required for peer feedback.');
  return req.user.cubeProfileId;
}

// Tags, limits and thresholds, so the composer never mirrors server constants.
router.get('/peer-feedback/catalog', requireAuth, async (_req, res) => {
  try {
    return res.json(getCatalog());
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/peer-feedback/budget', requireAuth, isCube, async (req: AuthenticatedRequest, res) => {
  try {
    requireCubeProfile(req);
    return res.json(await getBudget(req.user!.id));
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/peer-feedback', requireAuth, isCube, async (req: AuthenticatedRequest, res) => {
  try {
    const cubeProfileId = requireCubeProfile(req);
    const result = await createPeerFeedback(req.user!.id, cubeProfileId, req.body || {});
    return res.status(201).json(result);
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/peer-feedback/received', requireAuth, isCube, async (req: AuthenticatedRequest, res) => {
  try {
    const cubeProfileId = requireCubeProfile(req);
    return res.json(await listReceived(cubeProfileId));
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/peer-feedback/given', requireAuth, isCube, async (req: AuthenticatedRequest, res) => {
  try {
    requireCubeProfile(req);
    return res.json(await listGiven(req.user!.id));
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/peer-feedback/:id/pin', requireAuth, isCube, async (req: AuthenticatedRequest, res) => {
  try {
    const cubeProfileId = requireCubeProfile(req);
    return res.json(await pinFeedback(cubeProfileId, req.params.id));
  } catch (error) {
    return sendError(res, error);
  }
});

router.delete('/peer-feedback/:id/pin', requireAuth, isCube, async (req: AuthenticatedRequest, res) => {
  try {
    const cubeProfileId = requireCubeProfile(req);
    return res.json(await unpinFeedback(cubeProfileId, req.params.id));
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/peer-feedback/:id/helpful', requireAuth, isCube, async (req: AuthenticatedRequest, res) => {
  try {
    const cubeProfileId = requireCubeProfile(req);
    return res.json(await markHelpful(cubeProfileId, req.params.id));
  } catch (error) {
    return sendError(res, error);
  }
});

// Titles, pinned quotes and awards for anyone signed in; the Cube themselves
// also get their private view (tag distribution, trend, growth indicator).
router.get('/cubes/:id/peer-summary', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const summary = await getPeerSummary(req.params.id, {
      role: req.user!.role,
      cubeProfileId: req.user!.cubeProfileId
    });
    return res.json(summary);
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
