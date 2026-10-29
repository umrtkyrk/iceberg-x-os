/**
 * In-app notifications.
 */
import { Router } from 'express';
import prisma from '../services/prisma';
import { requireAuth, isMentorOrAdmin, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { sendError } from '../utils/http';
import { FORUM_ENABLED } from '../config/env';
import { forumNotificationLinks } from '../services/forumNotifications.service';
import { Role } from '@prisma/client';
import { markNotificationsRead } from '../services/notificationRead.service';

const router = Router();

// Notification Routes
router.get('/notifications', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const notifications = await prisma.notification.findMany({
      where: { user_id: req.user.id },
      orderBy: { created_at: 'desc' }
    });
    const targets = FORUM_ENABLED ? await forumNotificationLinks(notifications.map(n => n.id)) : [];
    return res.json(notifications.map(n => {
      const target = targets.find(t => t.notification_id === n.id);
      const link = target && !target.topic.deleted_at && !target.reply?.deleted_at
        ? '/forum?' + new URLSearchParams({ konu: target.topic_id, ...(target.reply_id ? { yanit: target.reply_id } : {}) }).toString() : null;
      return { ...n, link };
    }));
  } catch (error: any) {
    return sendError(res, error);
  }
});

// Keep the legacy clear URL safe during rolling deploys: reading never deletes history.
router.post(['/notifications/read', '/notifications/clear'], requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const ids = req.body?.ids;
    if (ids !== undefined && (!Array.isArray(ids) || !ids.length || ids.length > 200 || !ids.every((id: unknown) => typeof id === 'string' && id.length > 0))) {
      return res.status(400).json({ error: 'Provide between 1 and 200 notification IDs.' });
    }
    return res.json(await markNotificationsRead(req.user.id, ids));
  } catch (error: any) {
    return sendError(res, error);
  }
});

router.delete('/notifications/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    return res.json(await markNotificationsRead(req.user.id, [id]));
  } catch (error: any) {
    return sendError(res, error);
  }
});

router.post('/notifications/custom', requireAuth, isMentorOrAdmin, async (req, res) => {
  try {
    const { userIds, message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    let targetUserIds: string[] = [];

    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      targetUserIds = userIds;
    } else {
      const cubes = await prisma.user.findMany({
        where: { role: Role.CUBE },
        select: { id: true }
      });
      targetUserIds = cubes.map(c => c.id);
    }

    if (targetUserIds.length > 0) {
      await prisma.notification.createMany({
        data: targetUserIds.map(uid => ({
          user_id: uid,
          message: message.trim()
        }))
      });
    }

    return res.json({ success: true, count: targetUserIds.length });
  } catch (error: any) {
    return sendError(res, error);
  }
});

export default router;
