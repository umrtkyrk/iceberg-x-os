import { Router } from 'express';

import authRoutes from './auth.routes';
import cubesRoutes from './cubes.routes';
import missionsRoutes from './missions.routes';
import teamsRoutes from './teams.routes';
import updatesRoutes from './updates.routes';
import demosRoutes from './demos.routes';
import feedbackRoutes from './feedback.routes';
import badgesRoutes from './badges.routes';
import demodaysRoutes from './demodays.routes';
import meetingsRoutes from './meetings.routes';
import offboardingRoutes from './offboarding.routes';
import aiRoutes from './ai.routes';
import dashboardsRoutes from './dashboards.routes';
import adminUsersRoutes from './adminUsers.routes';
import applicationsRoutes from './applications.routes';
import invitesRoutes from './invites.routes';
import notificationsRoutes from './notifications.routes';
import testimonialsRoutes from './testimonials.routes';
import questsRoutes from './quests.routes';
import documentsRoutes from './documents.routes';
import quizRoutes from './quiz.routes';
import peerFeedbackRoutes from './peerFeedback.routes';
import radarRoutes from './radar.routes';
import mvcubesRoutes from './mvcubes.routes';
import hallOfFameRoutes from './hallOfFame.routes';

const router = Router();

/**
 * Every module declares full paths (`/cubes/...`, `/missions/...`), so they all
 * mount at the root and Express resolves them exactly as the single-file
 * router did.
 *
 * Order matters only where a literal segment could be captured by a parameter
 * in another module. `teams` is mounted before `missions` so that
 * `POST /missions/:id/teams` is matched by the teams module first.
 */
router.use(authRoutes);
router.use(cubesRoutes);
router.use(teamsRoutes);
router.use(missionsRoutes);
router.use(updatesRoutes);
router.use(demosRoutes);
router.use(feedbackRoutes);
router.use(badgesRoutes);
router.use(demodaysRoutes);
router.use(meetingsRoutes);
router.use(offboardingRoutes);
router.use(aiRoutes);
router.use(dashboardsRoutes);
router.use(adminUsersRoutes);
router.use(applicationsRoutes);
router.use(invitesRoutes);
router.use(notificationsRoutes);
router.use(testimonialsRoutes);
router.use(questsRoutes);
router.use(documentsRoutes);
router.use(quizRoutes);
router.use(peerFeedbackRoutes);
router.use(radarRoutes);
router.use(mvcubesRoutes);
router.use(hallOfFameRoutes);

export default router;
