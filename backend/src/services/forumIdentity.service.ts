import { Prisma } from '@prisma/client';
import prisma from './prisma';
import { badRequest, forbidden, notFound } from '../utils/http';
import { ForumActor, isForumStaff } from './forumPolicy';

// Select public fields explicitly. Never return the raw Cube profile.
export const forumAuthorSelect = {
  id: true, name: true, role: true, avatar_url: true,
  forum_profile: { select: { signature: true, badge_ids: true } },
  cube_profile: { select: {
    id: true, cube_number: true, current_level: true, is_senior_candidate: true,
    is_founding_cube: true, avatar_url: true,
    cube_badges: { select: { badge: { select: { id: true, name: true, icon: true, rarity: true } } } },
  } },
} satisfies Prisma.UserSelect;
type Author = Prisma.UserGetPayload<{ select: typeof forumAuthorSelect }>;

export function forumStage(level?: string, candidate = false, role = 'CUBE') {
  if (role === 'ADMIN') return 'admin';
  if (role === 'MENTOR') return 'mentor';
  if (level === 'Senior_Cube') return 'senior';
  if (level === 'Iceberger') return 'iceberger';
  if (level === 'Alumni') return 'alumni';
  if (level === 'Former_Cube') return 'former';
  return candidate ? 'candidate' : 'cube';
}

export function publicForumAuthor(user: Author | null) {
  if (!user) return null;
  const profile = user.cube_profile;
  const earned = new Map(profile?.cube_badges.map(row => [row.badge.id, row.badge]) || []);
  const badgeIds = user.forum_profile?.badge_ids || [];
  return {
    id: user.id, name: user.name, role: user.role,
    avatar_url: profile?.avatar_url || user.avatar_url || null,
    cube_id: profile?.id || null, cube_number: profile?.cube_number || null,
    stage: forumStage(profile?.current_level, profile?.is_senior_candidate, user.role),
    founding: profile?.is_founding_cube || false,
    signature: user.forum_profile?.signature || '',
    badges: badgeIds.flatMap(id => earned.has(id) ? [earned.get(id)!] : []).slice(0, 3),
  };
}

export async function forumViewer(actor: ForumActor) {
  const user = await prisma.user.findUnique({ where: { id: actor.id }, select: forumAuthorSelect });
  if (!user) throw notFound('Account not found.');
  const profile = user.cube_profile;
  return {
    author: publicForumAuthor(user),
    can_post: isForumStaff(actor) || (actor.role === 'CUBE' && !!profile && !['Alumni', 'Former_Cube'].includes(profile.current_level)),
    earned_badges: [...new Map(profile?.cube_badges.map(row => [row.badge.id, row.badge]) || []).values()],
    badge_ids: (user.forum_profile?.badge_ids || []).filter(id => profile?.cube_badges.some(row => row.badge.id === id)).slice(0, 3),
  };
}

export function validateForumPreferences(input: Record<string, unknown>, earnedIds: string[]) {
  if (typeof input.signature !== 'string' || input.signature.length > 140) throw badRequest('Your signature must be at most 140 characters.');
  if (!Array.isArray(input.badge_ids) || input.badge_ids.length > 3 || !input.badge_ids.every(id => typeof id === 'string')) throw badRequest('Choose up to three badges.');
  const ids = input.badge_ids as string[];
  if (new Set(ids).size !== ids.length || ids.some(id => !earnedIds.includes(id))) throw badRequest('Choose each earned badge at most once.');
  return { signature: input.signature.trim(), badge_ids: ids };
}

export async function saveForumProfile(actor: ForumActor, input: Record<string, unknown>) {
  return prisma.$transaction(async tx => {
    const profile = await tx.cubeProfile.findUnique({ where: { user_id: actor.id }, select: { cube_badges: { select: { badge_id: true } } } });
    const data = validateForumPreferences(input, profile?.cube_badges.map(b => b.badge_id) || []);
    return tx.forumProfile.upsert({ where: { user_id: actor.id }, create: { user_id: actor.id, ...data }, update: data });
  });
}

export async function assertForumPosting(actor: ForumActor) {
  if (isForumStaff(actor)) return;
  const profile = await prisma.cubeProfile.findUnique({ where: { user_id: actor.id }, select: { current_level: true } });
  if (!profile || ['Alumni', 'Former_Cube'].includes(profile.current_level)) throw forbidden('This account can read the forum but cannot create or edit posts.');
}
