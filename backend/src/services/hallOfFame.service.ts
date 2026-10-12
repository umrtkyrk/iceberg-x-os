/**
 * The Hall of Fame: where everyone is on the way
 * Cube -> Senior Cube candidate -> Senior Cube -> Iceberger -> Mentor.
 *
 * Stages are positive designations only. There is no ranking among the Cubes
 * in a stage, and nobody is shown "below" the others: the outer ring is simply
 * "Cube". Candidacy is an explicit decision by staff, never computed from
 * private scorecards or scores.
 *
 * Data safety: promoting an Iceberger to Mentor changes the user's role and
 * stamps the profile. The CubeProfile and everything attached to it (badges,
 * quests, scorecards, history) is kept, and the change can be reverted.
 */
import prisma from './prisma';
import { CubeLevel, Role } from '@prisma/client';
import { badRequest, conflict, notFound } from '../utils/http';
import { createSingleNotification } from './notification.service';

export type HallStage = 'cube' | 'candidate' | 'senior' | 'iceberger' | 'mentor';

export const HALL_STAGES: HallStage[] = ['cube', 'candidate', 'senior', 'iceberger', 'mentor'];

const LEGENDARY_BADGE_NAME = 'Be an Iceberger';
const LEGENDARY_QUEST_TITLE = 'Become an Iceberger';

/**
 * The Mentor ring is for Icebergers who came up through the Cube path and were
 * promoted. It is built from CubeProfile rows (level Iceberger, role MENTOR), so
 * mentors who were hired as mentors or sit on the development team, and never
 * had a Cube profile, are not on the ladder and must not be added to it.
 */
function stageOf(p: {
  current_level: CubeLevel;
  is_senior_candidate: boolean;
  user: { role: Role };
}): HallStage | null {
  if (p.user.role === Role.MENTOR && p.current_level === CubeLevel.Iceberger) return 'mentor';
  if (p.user.role !== Role.CUBE) return null;
  if (p.current_level === CubeLevel.Iceberger) return 'iceberger';
  if (p.current_level === CubeLevel.Senior_Cube) return 'senior';
  if (p.current_level === CubeLevel.Cube) return p.is_senior_candidate ? 'candidate' : 'cube';
  return null; // Former Cubes and Alumni are not part of the ladder
}

export async function getHallOfFame() {
  const profiles = await prisma.cubeProfile.findMany({
    where: {
      OR: [
        { current_level: { in: [CubeLevel.Cube, CubeLevel.Senior_Cube, CubeLevel.Iceberger] }, user: { role: Role.CUBE } },
        { current_level: CubeLevel.Iceberger, user: { role: Role.MENTOR } }
      ]
    },
    select: {
      id: true,
      cube_number: true,
      cohort: true,
      avatar_url: true,
      is_founding_cube: true,
      is_senior_candidate: true,
      current_level: true,
      iceberger_at: true,
      mentor_promoted_at: true,
      user: { select: { name: true, avatar_url: true, role: true } }
    }
  });

  const stages: Record<HallStage, any[]> = { cube: [], candidate: [], senior: [], iceberger: [], mentor: [] };

  for (const p of profiles) {
    const stage = stageOf(p);
    if (!stage) continue;
    stages[stage].push({
      id: p.id,
      name: p.user.name,
      cube_number: p.cube_number,
      cohort: p.cohort,
      avatar_url: p.avatar_url || p.user.avatar_url || null,
      is_founding_cube: p.is_founding_cube,
      since: stage === 'mentor' ? p.mentor_promoted_at : stage === 'iceberger' ? p.iceberger_at : null
    });
  }

  for (const stage of HALL_STAGES) {
    stages[stage].sort((a, b) => a.name.localeCompare(b.name));
  }

  return {
    stages,
    counts: Object.fromEntries(HALL_STAGES.map(s => [s, stages[s].length]))
  };
}

/**
 * Promotes Icebergers to Mentors. Either an explicit list of profile ids, or
 * everyone currently at the Iceberger level with the Cube role. All-or-nothing.
 */
export async function promoteIcebergersToMentors(input: { profileIds?: unknown; all?: unknown }) {
  const all = input.all === true;
  const ids = Array.isArray(input.profileIds) ? input.profileIds.map(String) : [];
  if (!all && ids.length === 0) {
    throw badRequest('Choose who to promote, or promote everyone at the Iceberger level.');
  }

  const profiles = await prisma.cubeProfile.findMany({
    where: {
      current_level: CubeLevel.Iceberger,
      user: { role: Role.CUBE },
      ...(all ? {} : { id: { in: ids } })
    },
    select: { id: true, user_id: true, user: { select: { name: true } } }
  });

  if (!all) {
    const missing = ids.filter(id => !profiles.some(p => p.id === id));
    if (missing.length > 0) {
      throw badRequest(
        `${missing.length} selected ${missing.length === 1 ? 'person is' : 'people are'} not Icebergers with a Cube role, so nothing was changed.`
      );
    }
  }
  if (profiles.length === 0) throw conflict('There is nobody at the Iceberger level to promote.');

  const now = new Date();
  await prisma.$transaction(
    profiles.flatMap(p => [
      prisma.user.update({ where: { id: p.user_id }, data: { role: Role.MENTOR } }),
      prisma.cubeProfile.update({ where: { id: p.id }, data: { mentor_promoted_at: now } })
    ])
  );

  for (const p of profiles) {
    await createSingleNotification(
      p.user_id,
      'Welcome to the mentor team! You have been promoted from Iceberger to Mentor. Sign out and back in to see your new workspace.'
    );
  }

  return { promoted: profiles.map(p => ({ id: p.id, name: p.user.name })) };
}

/** Undo a promotion made through this feature. Never touches other mentors. */
export async function revertMentorPromotion(profileId: string) {
  const profile = await prisma.cubeProfile.findFirst({
    where: { id: profileId, user: { role: Role.MENTOR }, mentor_promoted_at: { not: null } },
    select: { id: true, user_id: true, user: { select: { name: true } } }
  });
  if (!profile) throw notFound('That person was not promoted from Iceberger to Mentor.');

  await prisma.$transaction([
    prisma.user.update({ where: { id: profile.user_id }, data: { role: Role.CUBE } }),
    prisma.cubeProfile.update({ where: { id: profile.id }, data: { mentor_promoted_at: null } })
  ]);

  return { id: profile.id, name: profile.user.name };
}

export async function setSeniorCandidate(profileId: string, value: unknown) {
  if (typeof value !== 'boolean') throw badRequest('value must be true or false.');

  const profile = await prisma.cubeProfile.findFirst({
    where: { id: profileId, current_level: CubeLevel.Cube, user: { role: Role.CUBE } },
    select: { id: true, user_id: true, is_senior_candidate: true, user: { select: { name: true } } }
  });
  if (!profile) throw notFound('Only Cubes who are not yet Senior Cubes can be marked as candidates.');

  const updated = await prisma.cubeProfile.update({
    where: { id: profile.id },
    data: { is_senior_candidate: value },
    select: { id: true, is_senior_candidate: true }
  });

  if (value && !profile.is_senior_candidate) {
    await createSingleNotification(
      profile.user_id,
      'You are now on the Senior Cube candidates ring in the Hall of Fame. Keep going!'
    );
  }
  return updated;
}

/**
 * Side effects of a level change, run after the level has been saved. Every
 * step is idempotent and best-effort: a failure here never undoes the change.
 */
export async function afterLevelChange(
  profileId: string,
  previous: CubeLevel,
  next: CubeLevel,
  awardedById: string
): Promise<void> {
  const profile = await prisma.cubeProfile.findUnique({
    where: { id: profileId },
    select: { id: true, user_id: true, is_senior_candidate: true, iceberger_at: true }
  });
  if (!profile) return;

  // Promoted out of the candidate ring (or left the ladder).
  if (next !== CubeLevel.Cube && profile.is_senior_candidate) {
    await prisma.cubeProfile.update({ where: { id: profileId }, data: { is_senior_candidate: false } });
  }

  if (next !== CubeLevel.Iceberger || previous === CubeLevel.Iceberger) return;

  if (!profile.iceberger_at) {
    await prisma.cubeProfile.update({ where: { id: profileId }, data: { iceberger_at: new Date() } });
  }

  // The summit badge, if it has been created, and its quest.
  const badge = await prisma.badge.findUnique({ where: { name: LEGENDARY_BADGE_NAME } });
  if (badge) {
    const already = await prisma.cubeBadge.findFirst({
      where: { cube_id: profileId, badge_id: badge.id },
      select: { id: true }
    });
    if (!already) {
      await prisma.cubeBadge.create({
        data: {
          cube_id: profileId,
          badge_id: badge.id,
          reason: 'Became an Iceberger',
          awarded_by_id: awardedById
        }
      });
    }
  }

  const quest = await prisma.quest.findFirst({ where: { title: LEGENDARY_QUEST_TITLE }, select: { id: true } });
  if (quest) {
    await prisma.cubeQuest.upsert({
      where: { cube_id_quest_id: { cube_id: profileId, quest_id: quest.id } },
      create: { cube_id: profileId, quest_id: quest.id, current_value: 1, is_completed: true, completed_at: new Date() },
      update: { is_completed: true, completed_at: new Date(), current_value: 1 }
    });
  }

  await createSingleNotification(
    profile.user_id,
    'You are an Iceberger! You have reached the summit of the programme. Your name is on the Hall of Fame.'
  );
}
