/**
 * Who a webinar is for, and how they are told about it. Shared by the webinar
 * routes and the reminder sweep.
 */
import prisma from './prisma';
import { IN_PROGRAMME_CUBE_LEVELS } from '../config/constants';

/** Cubes expected to take part: the invite list, or every active Cube. */
export async function requiredCubes(webinar: { invited_cube_ids: string[] }) {
  const invited = webinar.invited_cube_ids || [];
  return prisma.cubeProfile.findMany({
    where: {
      current_level: { in: IN_PROGRAMME_CUBE_LEVELS },
      ...(invited.length > 0 ? { id: { in: invited } } : {})
    },
    select: {
      id: true,
      cube_number: true,
      avatar_url: true,
      user: { select: { id: true, name: true } }
    },
    orderBy: { cube_number: 'asc' }
  });
}

/** Best-effort notifications: a failure is logged and never fails the request. */
export async function notifyUsers(userIds: string[], message: string) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return;
  try {
    await prisma.notification.createMany({ data: unique.map(user_id => ({ user_id, message })) });
  } catch (err) {
    console.error('Failed to create webinar notifications:', err);
  }
}

/** Cube ids that already sent at least one question for the webinar. */
export async function cubesWithQuestions(webinarId: string): Promise<Set<string>> {
  const rows = await prisma.webinarQuestion.findMany({
    where: { webinar_id: webinarId },
    select: { cube_id: true },
    distinct: ['cube_id']
  });
  return new Set(rows.map(r => r.cube_id));
}
