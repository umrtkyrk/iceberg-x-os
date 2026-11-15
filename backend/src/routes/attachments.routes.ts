/**
 * Update and demo attachments: upload (unclaimed), open, and remove before sending.
 * See services/attachment.service.ts for the flow and the visibility rule.
 */
import { Router, Response } from 'express';
import multer from 'multer';
import prisma from '../services/prisma';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { StorageService } from '../services/storage.service';
import { badRequest, forbidden, notFound, sendError } from '../utils/http';
import {
  MAX_ATTACHMENT_BYTES,
  canOpenAttachment,
  createUnclaimedAttachment,
} from '../services/attachment.service';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1 },
});

router.post('/attachments', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  upload.single('file')(req, res, async error => {
    try {
      if (error instanceof multer.MulterError) {
        throw badRequest(error.code === 'LIMIT_FILE_SIZE' ? 'Files can be up to 15 MB.' : 'Upload one file at a time.');
      }
      if (error) throw error;
      if (!req.file) throw badRequest('Choose a file to upload.');
      // Multer decodes the multipart filename as latin1; restore UTF-8 (e.g. Turkish characters).
      const originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
      const attachment = await createUnclaimedAttachment(req.user!.id, { buffer: req.file.buffer, originalname });
      return res.status(201).json(attachment);
    } catch (caught) {
      return sendError(res, caught);
    }
  });
});

router.get('/attachments/:id/file', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const attachment = await prisma.attachment.findUnique({
      where: { id: req.params.id },
      include: {
        update: { select: { mission_id: true } },
        demo_submission: { select: { mission_id: true } },
      },
    });
    if (!attachment) throw notFound('Attachment not found.');
    if (!(await canOpenAttachment(req.user!, attachment))) {
      throw forbidden('You do not have access to this file.');
    }

    const filePath = StorageService.resolveAttachmentPath(attachment.stored_name);
    if (!filePath) throw notFound('The file is no longer available.');

    // Images and PDFs open in the browser; Word files download.
    const inline = attachment.kind !== 'docx' && req.query.download !== 'true';
    const asciiName = attachment.file_name.replace(/[^\x20-\x7e]/g, '_');
    res.setHeader('Content-Type', attachment.mime_type);
    res.setHeader(
      'Content-Disposition',
      `${inline ? 'inline' : 'attachment'}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(attachment.file_name)}`
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.sendFile(filePath);
  } catch (error) {
    return sendError(res, error);
  }
});

/** Removes a file the uploader has not sent yet (taken off the form). */
router.delete('/attachments/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const attachment = await prisma.attachment.findUnique({ where: { id: req.params.id } });
    if (!attachment) throw notFound('Attachment not found.');
    if (attachment.uploaded_by_id !== req.user!.id) throw forbidden('You can only remove your own files.');
    if (attachment.update_id || attachment.demo_submission_id) {
      throw badRequest('This file has already been sent.');
    }
    await prisma.attachment.delete({ where: { id: attachment.id } });
    await StorageService.deleteAttachments([attachment.stored_name]);
    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
