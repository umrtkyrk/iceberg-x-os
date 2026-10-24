/**
 * Public applications and admin recruitment.
 */
import { Router } from 'express';
import prisma from '../services/prisma';
import { requireAuth, isAdmin, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { applicationRateLimit } from '../middlewares/rateLimit.middleware';
import { sendError, parseCubeNumber, highestCubeNumber } from '../utils/http';
import { INVITE_TTL_HOURS, issueInvite, unusablePasswordHash } from '../services/invite.service';
import { Role, CubeLevel } from '@prisma/client';

const router = Router();

// Public Route: Submit an application
router.post('/applications', applicationRateLimit, async (req, res) => {
  try {
    const { name, email, university, degree, year_of_study, why_join, linkedin_url, github_url } = req.body;

    if (!name || !email || !university || !degree || !year_of_study || !why_join) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'A user with this email address already exists.' });
    }

    const existingApp = await prisma.cubeApplication.findFirst({
      where: { email, status: 'pending' }
    });
    if (existingApp) {
      return res.status(400).json({ error: 'A pending application with this email address already exists.' });
    }

    const application = await prisma.cubeApplication.create({
      data: {
        name,
        email,
        university,
        degree,
        year_of_study,
        why_join,
        linkedin_url,
        github_url
      }
    });

    return res.status(201).json({ success: true, application });
  } catch (error: any) {
    return sendError(res, error);
  }
});

// Admin Route: List all applications
router.get('/admin/applications', requireAuth, isAdmin, async (req, res) => {
  try {
    const applications = await prisma.cubeApplication.findMany({
      orderBy: { created_at: 'desc' }
    });
    return res.json(applications);
  } catch (error: any) {
    return sendError(res, error);
  }
});

// Admin Route: Approve/Reject an application
router.patch('/admin/applications/:id', requireAuth, isAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { status, cohort } = req.body;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const application = await prisma.cubeApplication.findUnique({
      where: { id }
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({ error: 'Application has already been processed' });
    }

    if (status === 'rejected') {
      const updated = await prisma.cubeApplication.update({
        where: { id },
        data: { status: 'rejected' }
      });
      return res.json({ success: true, application: updated });
    }

    if (!cohort) {
      return res.status(400).json({ error: 'Cohort is required for approval' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: application.email } });
    if (existingUser) {
      const updated = await prisma.cubeApplication.update({
        where: { id },
        data: { status: 'approved' }
      });
      return res.json({ success: true, application: updated, message: 'User already exists, application marked as approved' });
    }

    // Determine the next cube number. `orderBy` over this string column sorted
    // "9" above "10", so the maximum is computed numerically instead.
    const existingNumbers = await prisma.cubeProfile.findMany({
      select: { cube_number: true }
    });
    const nextNum = highestCubeNumber(existingNumbers.map(p => p.cube_number)) + 1;
    const nextCubeNumber = parseCubeNumber(nextNum) as string;

    // The account starts with an unusable password and is opened by a one-time
    // invite link, replacing the shared DEFAULT_CUBE_PASSWORD every approved
    // Cube used to receive. bcrypt runs outside the transaction so it does not
    // hold a database connection for ~100ms.
    const passwordHash = await unusablePasswordHash();

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: application.name,
          email: application.email,
          password_hash: passwordHash,
          role: Role.CUBE
        }
      });

      const profile = await tx.cubeProfile.create({
        data: {
          user_id: user.id,
          cube_number: nextCubeNumber,
          cohort,
          university: application.university,
          department: application.degree,
          github_url: application.github_url || null,
          linkedin_url: application.linkedin_url || null,
          skills: [],
          interests: [],
          current_level: CubeLevel.Cube
        }
      });

      const updated = await tx.cubeApplication.update({
        where: { id },
        data: { status: 'approved' }
      });

      const invite = await issueInvite(tx, user.id, req.user!.id, req);

      return { user, profile, application: updated, invite };
    });

    const { invite, ...rest } = result;
    return res.json({
      success: true,
      ...rest,
      inviteUrl: invite.url,
      expiresAt: invite.expiresAt,
      expiresInHours: INVITE_TTL_HOURS,
      message: 'No email is sent. Copy this single-use link and share it with the applicant so they can set their own password — it is shown only once.'
    });
  } catch (error: any) {
    return sendError(res, error);
  }
});

// Admin Route: Delete application
router.delete('/admin/applications/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.cubeApplication.delete({
      where: { id }
    });
    return res.json({ success: true, message: 'Application deleted successfully' });
  } catch (error: any) {
    return sendError(res, error);
  }
});

export default router;
