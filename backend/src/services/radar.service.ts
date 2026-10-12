/**
 * Staff-facing peer views: Hidden Gems and Needs Attention.
 *
 * Aggregates only. No function here returns a giver, a giver hash, or any
 * observation / concern text. Counts below the k-anonymity floor are withheld.
 */
import prisma from './prisma';
import { PeerFeedbackKind, PeerFeedbackStatus, PeerSignalState } from '@prisma/client';
import { badRequest, conflict, notFound } from '../utils/http';
import { IN_PROGRAMME_CUBE_LEVELS } from '../config/constants';
import {
  K_ANONYMITY,
  MAX_RELIABILITY,
  MIN_RELIABILITY,
  TITLE_LABELS,
  tagsForCategory
} from '../config/peer';
import { recomputeAllPeerState, refreshPeerSignal } from './peerSignal.service';
import { getHashIndex } from './peerAbuse.service';
import { recalculateAllQuestsForCube } from './quest.service';

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[idx];
}

const cubeSelect = {
  id: true,
  cube_number: true,
  cohort: true,
  avatar_url: true,
  user: { select: { name: true, avatar_url: true } },
  assigned_mentor: { select: { name: true } },
  peer_signal: true
} as const;

function cubeCard(c: any) {
  return {
    id: c.id,
    cube_number: c.cube_number,
    cohort: c.cohort,
    name: c.user?.name || 'Unknown',
    avatar_url: c.avatar_url || c.user?.avatar_url || null,
    mentor: c.assigned_mentor?.name || null
  };
}

function topKudosTags(tagCounts: any) {
  const kudos: Record<string, number> = tagCounts?.kudos || {};
  return Object.entries(kudos)
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([tag, givers]) => ({ tag, label: TITLE_LABELS[tag] || tag, givers }));
}

/**
 * Cubes the group clearly values but mentors rarely see: strong peer
 * recognition, low mentor-side visibility.
 */
export async function listHiddenGems() {
  await recomputeAllPeerState();

  const cubes = await prisma.cubeProfile.findMany({
    where: { current_level: { in: IN_PROGRAMME_CUBE_LEVELS } },
    select: cubeSelect
  });

  const withSignal = cubes.filter(c => c.peer_signal && c.peer_signal.distinct_givers >= K_ANONYMITY);
  if (withSignal.length === 0) return { gems: [], cohort_size: cubes.length };

  const kudosSorted = withSignal.map(c => c.peer_signal!.kudos_score).sort((a, b) => a - b);
  const visibilitySorted = cubes
    .map(c => ((c.peer_signal?.tag_counts as any)?.mentor_visibility?.total ?? 0) as number)
    .sort((a, b) => a - b);

  const kudosFloor = percentile(kudosSorted, 0.6);
  const visibilityCeiling = percentile(visibilitySorted, 0.4);

  const gems = withSignal
    .filter(c => {
      const signal = c.peer_signal!;
      const visibility = (signal.tag_counts as any)?.mentor_visibility?.total ?? 0;
      return signal.kudos_score >= kudosFloor && visibility <= visibilityCeiling;
    })
    .sort((a, b) => b.peer_signal!.visibility_gap - a.peer_signal!.visibility_gap)
    .map(c => {
      const signal = c.peer_signal!;
      const counts = signal.tag_counts as any;
      return {
        cube: cubeCard(c),
        distinct_givers: signal.distinct_givers,
        top_tags: topKudosTags(counts),
        mentor_visibility: {
          scorecards: counts?.mentor_visibility?.feedbackCount ?? 0,
          notes: counts?.mentor_visibility?.notesCount ?? 0,
          missions: counts?.mentor_visibility?.missionCount ?? 0
        },
        gap: signal.visibility_gap
      };
    });

  return { gems, cohort_size: cubes.length };
}

/**
 * Verified growth signals plus emerging patterns. Concern and observation text
 * is never included; only counts and broad categories.
 */
export async function listNeedsAttention() {
  await recomputeAllPeerState();

  const [signals, emerging] = await Promise.all([
    prisma.peerGrowthSignal.findMany({
      where: { state: { in: [PeerSignalState.OPEN, PeerSignalState.IN_CONVERSATION] } },
      orderBy: { due_at: 'asc' },
      include: { cube: { select: cubeSelect } }
    }),
    prisma.cubeProfile.findMany({
      where: {
        current_level: { in: IN_PROGRAMME_CUBE_LEVELS },
        peer_signal: { isNot: null }
      },
      select: cubeSelect
    })
  ]);

  const now = Date.now();
  const openCubeIds = new Set(signals.map(s => s.cube_id));

  const verified = signals.map(s => {
    const counts = (s.cube.peer_signal?.tag_counts as any) || {};
    return {
      signal: {
        id: s.id,
        category: s.category,
        state: s.state,
        due_at: s.due_at,
        overdue: s.due_at.getTime() < now
      },
      cube: cubeCard(s.cube),
      concern_givers: counts.concern_givers ?? 0,
      observation_givers: counts.observation_givers ?? 0,
      reciprocal_flag: (counts.reciprocal_flags ?? 0) > 0
    };
  });

  // Not yet a growth signal, but enough independent people noticed something
  // that a mentor may want to look. "Max" keeps the distinct-people claim safe.
  const emergingCards = emerging
    .filter(c => !openCubeIds.has(c.id))
    .map(c => {
      const counts = (c.peer_signal!.tag_counts as any) || {};
      const people = Math.max(counts.concern_givers ?? 0, counts.observation_givers ?? 0);
      return { cube: c, counts, people };
    })
    .filter(x => x.people >= K_ANONYMITY)
    .map(x => ({
      cube: cubeCard(x.cube),
      people: x.people,
      concern_categories: x.counts.concern || {},
      observation_categories: x.counts.observation || {},
      reciprocal_flag: (x.counts.reciprocal_flags ?? 0) > 0
    }));

  return { signals: verified, emerging: emergingCards };
}

export type SignalOutcome = 'confirmed' | 'unfounded';

/**
 * Moves a growth signal forward. Resolving it records whether the mentor
 * found the concern founded, which tunes how much each giver is trusted.
 */
export async function updateSignalState(
  signalId: string,
  staffUserId: string,
  next: { state?: unknown; outcome?: unknown }
) {
  const signal = await prisma.peerGrowthSignal.findUnique({ where: { id: signalId } });
  if (!signal) throw notFound('Signal not found.');
  if (signal.state === PeerSignalState.RESOLVED) throw conflict('This signal is already resolved.');

  const state = String(next.state);
  if (state !== PeerSignalState.IN_CONVERSATION && state !== PeerSignalState.RESOLVED) {
    throw badRequest('State must be IN_CONVERSATION or RESOLVED.');
  }
  if (state === PeerSignalState.IN_CONVERSATION && signal.state !== PeerSignalState.OPEN) {
    throw conflict('This signal is already in conversation.');
  }

  let outcome: SignalOutcome | null = null;
  if (state === PeerSignalState.RESOLVED) {
    if (next.outcome !== 'confirmed' && next.outcome !== 'unfounded') {
      throw badRequest('Resolving a signal needs an outcome: "confirmed" or "unfounded".');
    }
    outcome = next.outcome;
  }

  const updated = await prisma.peerGrowthSignal.update({
    where: { id: signalId },
    data: {
      state: state as PeerSignalState,
      handled_by_id: staffUserId,
      handled_at: new Date()
    }
  });

  if (outcome) await applyOutcome(signal.cube_id, signal.category, outcome);

  return { id: updated.id, state: updated.state };
}

async function applyOutcome(cubeProfileId: string, category: string, outcome: SignalOutcome) {
  const concerns = await prisma.peerFeedback.findMany({
    where: {
      receiver_id: cubeProfileId,
      kind: PeerFeedbackKind.CONCERN,
      status: PeerFeedbackStatus.ACTIVE,
      tags: { hasSome: tagsForCategory(category) }
    },
    select: { id: true, giver_hash: true }
  });
  if (concerns.length === 0) return;

  const givers = [...new Set(concerns.map(c => c.giver_hash))];

  if (outcome === 'unfounded') {
    await prisma.peerFeedback.updateMany({
      where: { id: { in: concerns.map(c => c.id) } },
      data: { status: PeerFeedbackStatus.DISMISSED }
    });
  }

  for (const hash of givers) {
    const stat = await prisma.peerReviewerStat.findUnique({ where: { giver_hash: hash } });
    const reliability = stat?.reliability ?? 1;
    const nextReliability =
      outcome === 'unfounded'
        ? Math.max(MIN_RELIABILITY, reliability - 0.1)
        : Math.min(MAX_RELIABILITY, reliability + 0.05);

    await prisma.peerReviewerStat.upsert({
      where: { giver_hash: hash },
      create: {
        giver_hash: hash,
        reliability: nextReliability,
        dismissed: outcome === 'unfounded' ? 1 : 0,
        confirmed: outcome === 'confirmed' ? 1 : 0
      },
      update: {
        reliability: nextReliability,
        ...(outcome === 'unfounded'
          ? { dismissed: { increment: 1 } }
          : { confirmed: { increment: 1 } })
      }
    });
  }

  // Aggregate and the givers' calibration quests, best-effort.
  void (async () => {
    try {
      await refreshPeerSignal(cubeProfileId);
      const index = await getHashIndex();
      for (const hash of givers) {
        const giverCube = index.get(hash);
        if (giverCube) await recalculateAllQuestsForCube(giverCube);
      }
    } catch (err) {
      console.error('[peer] post-adjudication refresh failed:', err);
    }
  })();
}
