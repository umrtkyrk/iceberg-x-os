/**
 * Admin user management.
 */
import { Router } from 'express';
import * as bcrypt from 'bcryptjs';
import prisma from '../services/prisma';
import { requireAuth, isAdmin, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { badRequest, parseCubeNumber, sendError } from '../utils/http';
import { INVITE_TTL_HOURS, issueInvite, unusablePasswordHash } from '../services/invite.service';
import { Role, CubeLevel } from '@prisma/client';
import { ACTIVITY_WINDOW_DAYS, getTrackingStartedAt, listActivitySummaries } from '../services/activity.service';

const router = Router();

router.get('/admin/users', requireAuth, isAdmin, async (req, res) => {
  try {
    // Explicit select: the previous `include` returned password_hash to the client.
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        created_at: true,
        updated_at: true,
        last_login_at: true,
        last_seen_at: true,
        cube_profile: true
      },
      orderBy: { name: 'asc' }
    });

    // Usage over the last 30 days; people never seen get zeros.
    const summaries = await listActivitySummaries();
    const empty = { active_days: 0, page_views: 0, active_minutes: 0 };
    return res.json(users.map((u) => ({ ...u, activity: summaries.get(u.id) ?? empty })));
  } catch (error: any) {
    return sendError(res, error);
  }
});

/**
 * When usage tracking started. Before that there is no data, so the page uses
 * it to avoid calling someone inactive just because tracking is brand new.
 */
router.get('/admin/activity/overview', requireAuth, isAdmin, async (_req, res) => {
  try {
    return res.json({
      tracking_started_at: await getTrackingStartedAt(),
      window_days: ACTIVITY_WINDOW_DAYS
    });
  } catch (error) {
    return sendError(res, error);
  }
});

/**
 * Creates a user. `password` is optional: omit it (or send `invite: true`) and
 * the account is created locked, returning a one-time invite link for the
 * person to set their own password.
 */
router.post('/admin/users/create', requireAuth, isAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      cube_number,
      cohort,
      university,
      department,
      github_url,
      gitlab_url,
      linkedin_url,
      slack_handle,
      phone_number,
      skills,
      interests,
      assigned_mentor_id
    } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({ error: 'Missing required fields (name, email, role)' });
    }

    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const useInvite = !password || req.body.invite === true;
    if (password && typeof password === 'string' && password.length < 8) {
      throw badRequest('Password must be at least 8 characters long.');
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // bcrypt is deliberately slow; keep it out of the transaction below
    const password_hash = useInvite
      ? await unusablePasswordHash()
      : await bcrypt.hash(password, 10);

    if (role === Role.CUBE) {
      if (!cube_number || !cohort) {
        return res.status(400).json({ error: 'Missing required fields for Cube (cube_number, cohort)' });
      }
      const normalizedCubeNumber = parseCubeNumber(cube_number);
      if (!normalizedCubeNumber) {
        throw badRequest('Cube number must be numeric (e.g. 007)');
      }
      const existingProfile = await prisma.cubeProfile.findUnique({
        where: { cube_number: normalizedCubeNumber }
      });
      if (existingProfile) {
        return res.status(400).json({ error: 'Cube number already assigned' });
      }

      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name,
            email,
            password_hash,
            role: Role.CUBE
          }
        });

        const invite = useInvite ? await issueInvite(tx, user.id, req.user!.id, req) : null;

        const profile = await tx.cubeProfile.create({
          data: {
            user_id: user.id,
            cube_number: normalizedCubeNumber,
            cohort,
            university: university || '',
            department: department || '',
            github_url,
            gitlab_url,
            linkedin_url,
            slack_handle,
            phone_number,
            skills: skills || [],
            interests: interests || [],
            current_level: CubeLevel.Cube,
            assigned_mentor_id: assigned_mentor_id || null
          }
        });

        return { user, profile, invite };
      });

      const { invite, ...rest } = result;
      return res.status(201).json({ ...rest, ...inviteResponse(invite) });
    } else {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name,
            email,
            password_hash,
            role: role as Role
          }
        });
        const invite = useInvite ? await issueInvite(tx, user.id, req.user!.id, req) : null;
        return { user, invite };
      });

      return res.status(201).json({ user: result.user, ...inviteResponse(result.invite) });
    }
  } catch (error: any) {
    return sendError(res, error);
  }
});

/** Shapes the one-time invite link into the response, when one was issued. */
function inviteResponse(invite: { url: string; expiresAt: Date } | null) {
  if (!invite) return {};
  return {
    inviteUrl: invite.url,
    expiresAt: invite.expiresAt,
    expiresInHours: INVITE_TTL_HOURS,
    message: 'No email is sent. Copy this single-use link and share it yourself — it is shown only once.'
  };
}

router.delete('/admin/users/:id', requireAuth, isAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.params.id;
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const adminId = req.user.id;

    if (userId === adminId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const userToDelete = await prisma.user.findUnique({
      where: { id: userId },
      include: { cube_profile: true }
    });

    if (!userToDelete) {
      return res.status(404).json({ error: 'User not found' });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Delete updates
      await tx.update.deleteMany({ where: { cube_id: userId } });

      // 2. Delete demo submissions
      await tx.demoSubmission.deleteMany({ where: { submitted_by_id: userId } });

      // 3. Delete feedbacks given or received
      await tx.mentorFeedback.deleteMany({
        where: { OR: [{ cube_id: userId }, { mentor_id: userId }] }
      });

      // 4. Delete presentations
      await tx.demoDayPresentation.deleteMany({
        where: { presenter_id: userId }
      });

      // 5. Delete badges & team memberships
      if (userToDelete.cube_profile) {
        await tx.cubeBadge.deleteMany({ where: { cube_id: userToDelete.cube_profile.id } });
        await tx.missionTeamMember.deleteMany({ where: { cube_id: userToDelete.cube_profile.id } });
      }
      await tx.cubeBadge.deleteMany({ where: { awarded_by_id: userId } });

      // 6. Re-assign created missions to the deleting admin
      await tx.mission.updateMany({
        where: { created_by_id: userId },
        data: { created_by_id: adminId }
      });

      // 7. Clear mentor assignments for cubes
      await tx.cubeProfile.updateMany({
        where: { assigned_mentor_id: userId },
        data: { assigned_mentor_id: null }
      });

      // 8. Delete CubeProfile if exists
      if (userToDelete.cube_profile) {
        await tx.cubeProfile.delete({ where: { id: userToDelete.cube_profile.id } });
      }

      // 9. Delete the User
      await tx.user.delete({ where: { id: userId } });
    });

    return res.json({ success: true, message: 'User deleted successfully' });
  } catch (error: any) {
    return sendError(res, error);
  }
});

export default router;
