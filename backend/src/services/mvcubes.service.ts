/**
 * MVCubes: monthly category winners.
 *
 * Only winners are ever produced or returned. There is no ranking of the
 * rest of the cohort anywhere in this module.
 */
import prisma from './prisma';
import { PeerFeedbackKind, PeerFeedbackStatus } from '@prisma/client';
import { badRequest } from '../utils/http';
import { IN_PROGRAMME_CUBE_LEVELS } from '../config/constants';
import {
  K_ANONYMITY,
  MVCUBES_CATEGORIES,
  MVCUBES_RISING_STAR,
  MVCUBES_TAG_CATEGORIES,
  TITLE_LABELS
} from '../config/peer';
import { monthKey, monthLabel, monthRange, previousMonthKey } from './peerCore';
import { createSingleNotification } from './notification.service';
import { recalculateQuestsForCubes } from './quest.service';

export const CATEGORY_LABELS: Record<string, string> = {
  ...TITLE_LABELS,
  [MVCUBES_RISING_STAR]: 'Rising Star'
};

/** distinct kudos givers per (cube, tag) within [start, end). */
async function giversByCubeAndTag(start: Date, end: Date) {
  const rows = await prisma.peerFeedback.findMany({
    where: {
      kind: PeerFeedbackKind.KUDOS,
      status: PeerFeedbackStatus.ACTIVE,
      created_at: { gte: start, lt: end },
      receiver: { current_level: { in: IN_PROGRAMME_CUBE_LEVELS } }
    },
    select: { receiver_id: true, giver_hash: true, tags: true, weight: true }
  });

  const byCube = new Map<string, Map<string, Map<string, number>>>();
  const overall = new Map<string, Map<string, number>>(); // cube -> giver -> max weight

  for (const row of rows) {
    if (!byCube.has(row.receiver_id)) byCube.set(row.receiver_id, new Map());
    const tags = byCube.get(row.receiver_id)!;
    for (const tag of row.tags) {
      if (!tags.has(tag)) tags.set(tag, new Map());
      const givers = tags.get(tag)!;
      givers.set(row.giver_hash, Math.max(givers.get(row.giver_hash) ?? 0, row.weight));
    }
    if (!overall.has(row.receiver_id)) overall.set(row.receiver_id, new Map());
    const all = overall.get(row.receiver_id)!;
    all.set(row.giver_hash, Math.max(all.get(row.giver_hash) ?? 0, row.weight));
  }
  return { byCube, overall };
}

export async function computeMvcubes(period: string) {
  const range = monthRange(period);
  if (!range) throw badRequest('Period must look like 2026-10.');

  const prevKey = previousMonthKey(period)!;
  const prevRange = monthRange(prevKey)!;

  const [current, previous, existing] = await Promise.all([
    giversByCubeAndTag(range.start, range.end),
    giversByCubeAndTag(prevRange.start, prevRange.end),
    prisma.mvcubesAward.findMany({ where: { period }, select: { category: true, cube_id: true } })
  ]);

  const done = new Set(existing.map(a => a.category));
  const taken = new Set(existing.map(a => a.cube_id));
  const created: { category: string; cube_id: string }[] = [];

  const award = async (category: string, cubeId: string, note: string) => {
    await prisma.mvcubesAward.create({ data: { period, category, cube_id: cubeId, note } });
    created.push({ category, cube_id: cubeId });
    taken.add(cubeId);
  };

  // Tag categories: most distinct givers; ties go to the higher total weight.
  for (const category of MVCUBES_TAG_CATEGORIES) {
    if (done.has(category)) continue;

    let best: { cube: string; givers: number; weight: number } | null = null;
    for (const [cube, tags] of current.byCube) {
      if (taken.has(cube)) continue;
      const givers = tags.get(category);
      if (!givers || givers.size < K_ANONYMITY) continue;
      const weight = [...givers.values()].reduce((a, b) => a + b, 0);
      if (!best || givers.size > best.givers || (givers.size === best.givers && weight > best.weight)) {
        best = { cube, givers: givers.size, weight };
      }
    }
    if (best) {
      await award(category, best.cube, `Recognised by ${best.givers} teammates`);
    }
  }

  // Rising Star: biggest increase in the number of people recognising a Cube,
  // so quiet and newer Cubes can win without outscoring anyone.
  if (!done.has(MVCUBES_RISING_STAR)) {
    let best: { cube: string; delta: number; before: number } | null = null;
    for (const [cube, givers] of current.overall) {
      if (taken.has(cube) || givers.size < K_ANONYMITY) continue;
      const before = previous.overall.get(cube)?.size ?? 0;
      const delta = givers.size - before;
      if (delta <= 0) continue;
      if (!best || delta > best.delta || (delta === best.delta && before < best.before)) {
        best = { cube, delta, before };
      }
    }
    if (best) {
      await award(MVCUBES_RISING_STAR, best.cube, `${best.delta} more people recognised them than last month`);
    }
  }

  // Tell the winners and let their quests move. Best-effort.
  if (created.length > 0) {
    try {
      const profiles = await prisma.cubeProfile.findMany({
        where: { id: { in: created.map(c => c.cube_id) } },
        select: { id: true, user_id: true }
      });
      const userByCube = new Map(profiles.map(p => [p.id, p.user_id]));
      for (const c of created) {
        const userId = userByCube.get(c.cube_id);
        if (userId) {
          await createSingleNotification(
            userId,
            `You are MVCubes ${CATEGORY_LABELS[c.category] || c.category} for ${monthLabel(period)}!`
          );
        }
      }
      await recalculateQuestsForCubes(created.map(c => c.cube_id));
    } catch (err) {
      console.error('[mvcubes] post-award hooks failed:', err);
    }
  }

  return { period, created: created.length };
}

export async function getMvcubes(period?: string) {
  const selected = period && monthRange(period) ? period : monthKey(new Date());

  const [awards, periods] = await Promise.all([
    prisma.mvcubesAward.findMany({
      where: { period: selected },
      include: {
        cube: {
          select: {
            id: true,
            cube_number: true,
            avatar_url: true,
            user: { select: { name: true, avatar_url: true } }
          }
        }
      }
    }),
    prisma.mvcubesAward.findMany({
      distinct: ['period'],
      orderBy: { period: 'desc' },
      take: 12,
      select: { period: true }
    })
  ]);

  const byCategory = new Map(awards.map(a => [a.category, a]));
  return {
    period: selected,
    period_label: monthLabel(selected),
    periods: periods.map(p => ({ period: p.period, label: monthLabel(p.period) })),
    // Fixed category order so the shelf never reshuffles.
    categories: MVCUBES_CATEGORIES.map(category => {
      const a = byCategory.get(category);
      return {
        category,
        label: CATEGORY_LABELS[category] || category,
        winner: a
          ? {
              cube_id: a.cube.id,
              cube_number: a.cube.cube_number,
              name: a.cube.user?.name || 'Unknown',
              avatar_url: a.cube.avatar_url || a.cube.user?.avatar_url || null,
              note: a.note
            }
          : null
      };
    })
  };
}
