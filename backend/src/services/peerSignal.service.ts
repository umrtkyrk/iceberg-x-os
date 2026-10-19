/**
 * Peer aggregation.
 *
 * Two kinds of computation, deliberately separated:
 *
 *  - refreshPeerSignal: the LIVE aggregate. Staff-facing (Radar) and the score
 *    read it. It never names or exposes a giver.
 *  - recomputeCubePeerState: the DELIVERED view. Titles, growth signals and
 *    receive-side quest progress only look at feedback written before the
 *    start of the current ISO week, so a new title or indicator cannot be
 *    matched to the moment someone wrote kudos.
 */
import prisma from './prisma';
import {
  BadgeRarity,
  PeerFeedbackKind,
  PeerFeedbackStatus,
  PeerSignalState
} from '@prisma/client';
import {
  CORROBORATION_GIVERS,
  MENTOR_SLA_DAYS,
  MIN_CONCERN_SCORE_WEIGHT,
  MUTUAL_KUDOS_FACTOR,
  RARITY_ORDINAL,
  RIVAL_CONCERN_FACTOR,
  SIGNAL_REOPEN_COOLDOWN_DAYS,
  SIGNAL_WINDOW_DAYS,
  TITLE_TIERS,
  concernCategory,
  isKudosTag
} from '../config/peer';
import { daysAgo, digestCutoff } from './peerCore';
import {
  loadReliability,
  mutualKudosGivers,
  reciprocalConcernGivers,
  rivalGivers
} from './peerAbuse.service';
import { createSingleNotification } from './notification.service';

interface GiverAggregate {
  /** Highest context weight among this giver's items (one voice per giver). */
  weight: number;
  contexts: Set<string>;
  tags: Set<string>;
}

function contextKey(type: string, id: string | null): string {
  return `${type}:${id ?? '-'}`;
}

function collect(
  items: { giver_hash: string; weight: number; tags: string[]; context_type: string; context_id: string | null }[]
): Map<string, GiverAggregate> {
  const byGiver = new Map<string, GiverAggregate>();
  for (const item of items) {
    const existing = byGiver.get(item.giver_hash) || {
      weight: 0,
      contexts: new Set<string>(),
      tags: new Set<string>()
    };
    existing.weight = Math.max(existing.weight, item.weight);
    existing.contexts.add(contextKey(item.context_type, item.context_id));
    item.tags.forEach(t => existing.tags.add(t));
    byGiver.set(item.giver_hash, existing);
  }
  return byGiver;
}

/** How visible a Cube already is to mentors. Used to find Hidden Gems. */
export async function mentorVisibility(cubeProfileId: string, userId: string) {
  const [feedbackCount, notesCount, missionCount] = await Promise.all([
    prisma.mentorFeedback.count({ where: { cube_id: userId } }),
    prisma.privateNote.count({ where: { cube_id: cubeProfileId } }),
    prisma.missionContributor.count({ where: { cube_id: cubeProfileId } })
  ]);
  return { feedbackCount, notesCount, missionCount, total: feedbackCount + notesCount + missionCount };
}

/**
 * Recomputes the live aggregate for one Cube and stores it in PeerSignal.
 * Safe to call as often as needed; it is idempotent.
 */
export async function refreshPeerSignal(cubeProfileId: string): Promise<void> {
  const profile = await prisma.cubeProfile.findUnique({
    where: { id: cubeProfileId },
    select: { id: true, user_id: true }
  });
  if (!profile) return;

  const items = await prisma.peerFeedback.findMany({
    where: {
      receiver_id: cubeProfileId,
      status: PeerFeedbackStatus.ACTIVE,
      created_at: { gte: daysAgo(SIGNAL_WINDOW_DAYS) }
    },
    select: {
      giver_hash: true,
      kind: true,
      weight: true,
      tags: true,
      context_type: true,
      context_id: true
    }
  });

  const kudos = collect(items.filter(i => i.kind === PeerFeedbackKind.KUDOS));
  const concerns = collect(items.filter(i => i.kind === PeerFeedbackKind.CONCERN));
  const observations = collect(items.filter(i => i.kind === PeerFeedbackKind.OBSERVATION));

  const allGivers = [...new Set([...kudos.keys(), ...concerns.keys(), ...observations.keys()])];
  const [reliability, mutual, reciprocal, rivals] = await Promise.all([
    loadReliability(allGivers),
    mutualKudosGivers(cubeProfileId),
    reciprocalConcernGivers(cubeProfileId),
    rivalGivers(cubeProfileId)
  ]);
  const rel = (hash: string) => reliability.get(hash) ?? 1;

  // Kudos: one weighted voice per giver.
  let kudosEff = 0;
  const kudosContexts = new Set<string>();
  const tagGivers = new Map<string, Set<string>>();
  for (const [hash, agg] of kudos) {
    kudosEff += agg.weight * rel(hash) * (mutual.has(hash) ? MUTUAL_KUDOS_FACTOR : 1);
    agg.contexts.forEach(c => kudosContexts.add(c));
    for (const tag of agg.tags) {
      if (!isKudosTag(tag)) continue;
      if (!tagGivers.has(tag)) tagGivers.set(tag, new Set());
      tagGivers.get(tag)!.add(hash);
    }
  }

  // Concerns: only strong-context, non-retaliatory ones count at all, and only
  // once enough independent people agree.
  let concernEff = 0;
  let concernGivers = 0;
  // Different people who raised a concern at all (any context, not retaliation).
  // This is what puts a Cube on the Radar; it does not move the score.
  let concernGiversAll = 0;
  const concernCategories = new Map<string, Set<string>>();
  for (const [hash, agg] of concerns) {
    if (reciprocal.has(hash)) continue;
    concernGiversAll += 1;
    if (agg.weight < MIN_CONCERN_SCORE_WEIGHT) continue;
    concernGivers += 1;
    concernEff += agg.weight * rel(hash) * (rivals.has(hash) ? RIVAL_CONCERN_FACTOR : 1);
    for (const tag of agg.tags) {
      const category = concernCategory(tag);
      if (!category) continue;
      if (!concernCategories.has(category)) concernCategories.set(category, new Set());
      concernCategories.get(category)!.add(hash);
    }
  }
  const verified = concernGivers >= CORROBORATION_GIVERS;

  const observationCategories = new Map<string, Set<string>>();
  for (const [hash, agg] of observations) {
    for (const tag of agg.tags) {
      const category = concernCategory(tag);
      if (!category) continue;
      if (!observationCategories.has(category)) observationCategories.set(category, new Set());
      observationCategories.get(category)!.add(hash);
    }
  }

  const visibility = await mentorVisibility(cubeProfileId, profile.user_id);

  const toCounts = (m: Map<string, Set<string>>) =>
    Object.fromEntries([...m.entries()].map(([k, v]) => [k, v.size]));

  const tagCounts = {
    kudos: toCounts(tagGivers),
    concern: toCounts(concernCategories),
    observation: toCounts(observationCategories),
    concern_givers: concernGivers,
    concern_givers_all: concernGiversAll,
    observation_givers: observations.size,
    reciprocal_flags: reciprocal.size,
    mentor_visibility: visibility
  };

  const data = {
    kudos_score: kudosEff,
    concern_score: verified ? concernEff : 0,
    distinct_givers: kudos.size,
    distinct_contexts: kudosContexts.size,
    tag_counts: tagCounts,
    visibility_gap: kudosEff - 0.5 * visibility.total
  };

  await prisma.peerSignal.upsert({
    where: { cube_id: cubeProfileId },
    create: { cube_id: cubeProfileId, ...data },
    update: data
  });
}

function titleTierFor(givers: number, contexts: number, weeks: number): BadgeRarity | null {
  for (const tier of TITLE_TIERS) {
    if (givers >= tier.givers && contexts >= tier.contexts && weeks >= tier.weeks) return tier.rarity;
  }
  return null;
}

async function recomputeTitles(cubeProfileId: string): Promise<void> {
  // Kudos count the moment they arrive; only the growth signal below waits.
  const delivered = await prisma.peerFeedback.findMany({
    where: {
      receiver_id: cubeProfileId,
      kind: PeerFeedbackKind.KUDOS,
      status: PeerFeedbackStatus.ACTIVE
    },
    select: {
      giver_hash: true,
      tags: true,
      context_type: true,
      context_id: true,
      created_at: true
    }
  });
  if (delivered.length === 0) return;

  const byTag = new Map<
    string,
    { givers: Set<string>; contexts: Set<string>; first: Date; last: Date }
  >();
  for (const item of delivered) {
    for (const tag of item.tags) {
      if (!isKudosTag(tag)) continue;
      const entry = byTag.get(tag) || {
        givers: new Set<string>(),
        contexts: new Set<string>(),
        first: item.created_at,
        last: item.created_at
      };
      entry.givers.add(item.giver_hash);
      entry.contexts.add(contextKey(item.context_type, item.context_id));
      if (item.created_at < entry.first) entry.first = item.created_at;
      if (item.created_at > entry.last) entry.last = item.created_at;
      byTag.set(tag, entry);
    }
  }

  for (const [tag, entry] of byTag) {
    const weeks = (entry.last.getTime() - entry.first.getTime()) / (7 * 86400000);
    const rarity = titleTierFor(entry.givers.size, entry.contexts.size, weeks);
    if (!rarity) continue;

    const existing = await prisma.peerTitle.findUnique({
      where: { cube_id_category: { cube_id: cubeProfileId, category: tag } }
    });

    if (!existing) {
      await prisma.peerTitle.create({
        data: { cube_id: cubeProfileId, category: tag, rarity }
      });
    } else if (RARITY_ORDINAL[rarity] > RARITY_ORDINAL[existing.rarity]) {
      // Tiers only ever go up.
      await prisma.peerTitle.update({
        where: { id: existing.id },
        data: { rarity, upgraded_at: new Date() }
      });
    }
  }
}

async function recomputeGrowthSignal(cubeProfileId: string, cutoff: Date): Promise<void> {
  const [delivered, reciprocal] = await Promise.all([
    prisma.peerFeedback.findMany({
      where: {
        receiver_id: cubeProfileId,
        kind: PeerFeedbackKind.CONCERN,
        status: PeerFeedbackStatus.ACTIVE,
        weight: { gte: MIN_CONCERN_SCORE_WEIGHT },
        created_at: { lt: cutoff, gte: daysAgo(SIGNAL_WINDOW_DAYS) }
      },
      select: { giver_hash: true, tags: true }
    }),
    reciprocalConcernGivers(cubeProfileId)
  ]);

  // distinct, non-retaliatory givers per category
  const perCategory = new Map<string, Set<string>>();
  for (const item of delivered) {
    if (reciprocal.has(item.giver_hash)) continue;
    for (const tag of item.tags) {
      const category = concernCategory(tag);
      if (!category) continue;
      if (!perCategory.has(category)) perCategory.set(category, new Set());
      perCategory.get(category)!.add(item.giver_hash);
    }
  }

  for (const [category, givers] of perCategory) {
    if (givers.size < CORROBORATION_GIVERS) continue;

    const open = await prisma.peerGrowthSignal.findFirst({
      where: {
        cube_id: cubeProfileId,
        category,
        OR: [
          { state: { in: [PeerSignalState.OPEN, PeerSignalState.IN_CONVERSATION] } },
          {
            state: PeerSignalState.RESOLVED,
            handled_at: { gte: daysAgo(SIGNAL_REOPEN_COOLDOWN_DAYS) }
          }
        ]
      },
      select: { id: true }
    });
    if (open) continue;

    await prisma.peerGrowthSignal.create({
      data: {
        cube_id: cubeProfileId,
        category,
        due_at: new Date(Date.now() + MENTOR_SLA_DAYS * 86400000)
      }
    });

    const profile = await prisma.cubeProfile.findUnique({
      where: { id: cubeProfileId },
      select: {
        user_id: true,
        assigned_mentor_id: true,
        user: { select: { name: true } }
      }
    });
    if (!profile) continue;

    if (profile.assigned_mentor_id) {
      await createSingleNotification(
        profile.assigned_mentor_id,
        `A peer growth signal is waiting in Radar for ${profile.user?.name || 'a Cube'} (${category}).`
      );
    }
    await createSingleNotification(
      profile.user_id,
      'A growth area has been shared with you. Your mentor will reach out to talk it through.'
    );
  }
}

/**
 * Brings the delivered view up to date for one Cube: titles, growth signals.
 * Idempotent and best-effort; callers must not let it fail their own action.
 */
export async function recomputeCubePeerState(cubeProfileId: string): Promise<void> {
  await recomputeTitles(cubeProfileId);
  // A growth indicator is shown to the person, so it keeps the weekly pause.
  await recomputeGrowthSignal(cubeProfileId, digestCutoff());
}

let lastFullRecompute = 0;
const FULL_RECOMPUTE_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Refreshes every Cube that has received any feedback. Throttled so the Radar
 * can call it on each load without recomputing the cohort every time.
 */
export async function recomputeAllPeerState(force = false): Promise<void> {
  if (!force && Date.now() - lastFullRecompute < FULL_RECOMPUTE_INTERVAL_MS) return;
  lastFullRecompute = Date.now();

  const receivers = await prisma.peerFeedback.findMany({
    distinct: ['receiver_id'],
    select: { receiver_id: true }
  });

  for (const { receiver_id } of receivers) {
    try {
      await refreshPeerSignal(receiver_id);
      await recomputeCubePeerState(receiver_id);
    } catch (err) {
      console.error(`[peer] recompute failed for cube ${receiver_id}:`, err);
    }
  }
}
