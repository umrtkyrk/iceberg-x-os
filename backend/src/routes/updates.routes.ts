/**
 * Cube progress updates.
 */
import { Router } from 'express';
import prisma from '../services/prisma';
import { requireAuth, isAdmin, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { sendError } from '../utils/http';
import { UpdateType } from '@prisma/client';
import { recalculateAllQuestsForCube } from '../services/quest.service';
import { StorageService } from '../services/storage.service';
import { claimAttachments, parseAttachmentIds } from '../services/attachment.service';

const router = Router();

// Submit an update (Cube only)
router.post('/updates', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { mission_id, type, content, blockers } = req.body;
    const attachmentIds = parseAttachmentIds(req.body.attachment_ids);

    if (!mission_id || !type || !content) {
      return res.status(400).json({ error: 'Missing required parameters (mission_id, type, content)' });
    }

    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    let cubeProfileId = req.user.cubeProfileId;

    if (req.user.role === 'CUBE') {
      const profile = await prisma.cubeProfile.findUnique({
        where: { user_id: req.user.id }
      });
      if (!profile) {
        return res.status(403).json({ error: 'Cube profile not found' });
      }
      cubeProfileId = profile.id;

      const isAssigned = await prisma.missionTeamMember.findFirst({
        where: {
          cube_id: profile.id,
          team: {
            mission_id: mission_id
          }
        }
      });

      if (!isAssigned) {
        return res.status(403).json({ error: 'You are not assigned to this mission.' });
      }
    }

    const userId = req.user.id;
    const newUpdate = await prisma.$transaction(async tx => {
      const created = await tx.update.create({
        data: {
          cube_id: userId,
          mission_id,
          type: type as UpdateType,
          content,
          blockers,
        }
      });
      await claimAttachments(tx, attachmentIds, userId, { update_id: created.id });
      return created;
    });

    // Re-evaluate update-related quests asynchronously
    if (cubeProfileId) {
      recalculateAllQuestsForCube(cubeProfileId).catch(err => {
        console.error('Failed to recalculate quests after update creation:', err);
      });
    } else {
      prisma.cubeProfile.findUnique({ where: { user_id: req.user.id }, select: { id: true } })
        .then(p => {
          if (p) recalculateAllQuestsForCube(p.id).catch(() => {});
        })
        .catch(() => {});
    }

    return res.status(201).json(newUpdate);
  } catch (error: any) {
    return sendError(res, error);
  }
});

router.delete('/updates/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.update.findUnique({
      where: { id },
      select: { cube_id: true, attachments: { select: { stored_name: true } } }
    });

    await prisma.update.delete({ where: { id } });
    // Rows cascade with the update; the files on disk do not.
    await StorageService.deleteAttachments(existing?.attachments.map(a => a.stored_name) || []);

    if (existing?.cube_id) {
      prisma.cubeProfile.findUnique({ where: { user_id: existing.cube_id }, select: { id: true } })
        .then(p => {
          if (p) recalculateAllQuestsForCube(p.id).catch(() => {});
        })
        .catch(() => {});
    }

    return res.json({ success: true, message: 'Update deleted successfully' });
  } catch (error: any) {
    return sendError(res, error);
  }
});

export default router;
