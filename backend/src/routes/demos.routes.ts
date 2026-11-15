/**
 * Demo submissions.
 */
import { Router } from 'express';
import prisma from '../services/prisma';
import { requireAuth, isAdmin, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { sendError } from '../utils/http';
import { MissionStatus } from '@prisma/client';
import { StorageService } from '../services/storage.service';
import { ATTACHMENT_PUBLIC_SELECT, claimAttachments, parseAttachmentIds } from '../services/attachment.service';

const router = Router();

/**
 * List demo submissions.
 *
 * Staff see everything. A Cube sees only their own submissions and those from
 * missions they were actually on — previously every Cube could read every other
 * team's full write-up, including "what could we have done better".
 */
router.get('/demos', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const isStaff = req.user?.role === 'ADMIN' || req.user?.role === 'MENTOR';

    let where: any = {};
    if (!isStaff) {
      const memberships = await prisma.missionTeamMember.findMany({
        where: { cube_id: req.user?.cubeProfileId },
        select: { team: { select: { mission_id: true } } }
      });
      const missionIds = memberships
        .map(m => m.team.mission_id)
        .filter((id): id is string => !!id);

      where = {
        OR: [
          { submitted_by_id: req.user?.id },
          { mission_id: { in: missionIds } }
        ]
      };
    }

    const submissions = await prisma.demoSubmission.findMany({
      where,
      include: {
        mission: true,
        team: true,
        submitted_by: { select: { name: true, id: true } },
        // This list is already limited to the Cube's own missions (or staff).
        attachments: { select: ATTACHMENT_PUBLIC_SELECT, orderBy: { created_at: 'asc' } }
      },
      orderBy: { submitted_at: 'desc' }
    });
    return res.json(submissions);
  } catch (error: any) {
    return sendError(res, error);
  }
});

// Submit a Demo (Cube only)
router.post('/demos', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      mission_id,
      team_id,
      title,
      summary,
      what_we_built,
      what_we_learned,
      what_worked_well,
      what_could_we_have_done_better,
      recommendation,
      repository_url,
      pull_request_url,
      demo_url,
      document_url,
      video_url
    } = req.body;
    const attachmentIds = parseAttachmentIds(req.body.attachment_ids);

    if (!mission_id || !title || !summary || !what_we_built || !what_we_learned || !what_worked_well || !what_could_we_have_done_better) {
      return res.status(400).json({ error: 'Missing required fields. What could we have done better? is mandatory.' });
    }

    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    if (req.user.role === 'CUBE') {
      const profile = await prisma.cubeProfile.findUnique({
        where: { user_id: req.user.id }
      });
      if (!profile) {
        return res.status(403).json({ error: 'Cube profile not found' });
      }

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
    const submission = await prisma.$transaction(async tx => {
      const created = await tx.demoSubmission.create({
        data: {
          mission_id,
          team_id: team_id || null,
          submitted_by_id: userId,
          title,
          summary,
          what_we_built,
          what_we_learned,
          what_worked_well,
          what_could_we_have_done_better,
          recommendation,
          repository_url,
          pull_request_url,
          demo_url,
          document_url,
          video_url
        }
      });
      await claimAttachments(tx, attachmentIds, userId, { demo_submission_id: created.id });
      return created;
    });

    // Automatically progress mission status if it was in building_demo
    await prisma.mission.updateMany({
      where: { id: mission_id, status: MissionStatus.building_demo },
      data: { status: MissionStatus.demo_ready }
    });

    return res.status(201).json(submission);
  } catch (error: any) {
    return sendError(res, error);
  }
});

router.delete('/demos/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const files = await prisma.attachment.findMany({ where: { demo_submission_id: id }, select: { stored_name: true } });
    await prisma.demoSubmission.delete({ where: { id } });
    // Rows cascade with the submission; the files on disk do not.
    await StorageService.deleteAttachments(files.map(f => f.stored_name));
    return res.json({ success: true, message: 'Demo submission deleted successfully' });
  } catch (error: any) {
    return sendError(res, error);
  }
});

export default router;
