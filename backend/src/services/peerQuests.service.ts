/**
 * Quest criteria backed by peer feedback.
 *
 * Each criteria type carries its own algorithm: how progress is measured and
 * who is eligible for auto-assignment. quest.service.ts delegates to this
 * registry from verifyQuestProgress and ensureAutoQuestsForCube.
 *
 * Design rules:
 *  - Giving is rewarded for breadth and quality, never for negativity. There is
 *    no "number of concerns filed" criterion.
 *  - Receive-side progress only counts feedback delivered before the start of
 *    the current ISO week, so progress cannot reveal who just wrote kudos.
 *  - Peer quests are sticky: once complete they are never reverted, because a
 *    peer-derived value can fall (a concern is dismissed, a rate dips) and a
 *    badge must not silently disappear.
 */
import prisma from './prisma';
import { PeerFeedbackKind, PeerFeedbackStatus } from '@prisma/client';
import { RARITY_ORDINAL } from '../config/peer';
import { digestCutoff, giverHash } from './peerCore';

export const PEER_CRITERIA = [
  'peer_kudos_given',
  'peer_feedback_streak',
  'peer_quiet_kudos',
  'peer_helpful_feedback',
  'peer_calibration',
  'peer_distinct_givers_received',
  'peer_title_tier',
  'mvcubes_awards'
] as const;

export type PeerCriteria = (typeof PEER_CRITERIA)[number];

export function isPeerCriteria(type: string): type is PeerCriteria {
  return (PEER_CRITERIA as readonly string[]).includes(type);
}

/** Types whose target is a whole number of at least 1. */
export const PEER_COUNT_CRITERIA: PeerCriteria[] = [
  'peer_kudos_given',
  'peer_feedback_streak',
  'peer_quiet_kudos',
  'peer_helpful_feedback',
  'peer_distinct_givers_received',
  'mvcubes_awards'
];

/** Types expressed as a percentage, which accept min_sample_size. */
export const PEER_RATE_CRITERIA: PeerCriteria[] = ['peer_calibration'];

export interface PeerQuestContext {
  calculateWeeklyStreak: (dates: (Date | string)[]) => { effectiveStreak: number };
  /** Resolved minimum sample size for rate criteria. */
  minSampleSize: number;
}

interface PeerQuestAlgorithm {
  /** Whether the Cube should be auto-assigned this quest right now. */
  eligible: (cubeProfileId: string, userId: string) => Promise<boolean>;
  /** Current progress value for the Cube. */
  progress: (cubeProfileId: string, userId: string, ctx: PeerQuestContext) => Promise<number>;
}

const always = async () => true;

async function distinctReceivers(hash: string, extra: Record<string, unknown> = {}): Promise<number> {
  const rows = await prisma.peerFeedback.findMany({
    where: { giver_hash: hash, status: PeerFeedbackStatus.ACTIVE, ...extra },
    distinct: ['receiver_id'],
    select: { receiver_id: true }
  });
  return rows.length;
}

export const PEER_QUESTS: Record<PeerCriteria, PeerQuestAlgorithm> = {
  // Number of different Cubes recognised.
  peer_kudos_given: {
    eligible: always,
    progress: async (_cube, userId) =>
      distinctReceivers(giverHash(userId), { kind: PeerFeedbackKind.KUDOS })
  },

  // Consecutive ISO weeks in which the Cube gave any feedback.
  peer_feedback_streak: {
    eligible: always,
    progress: async (_cube, userId, ctx) => {
      const rows = await prisma.peerFeedback.findMany({
        where: { giver_hash: giverHash(userId) },
        select: { created_at: true }
      });
      return ctx.calculateWeeklyStreak(rows.map(r => r.created_at)).effectiveStreak;
    }
  },

  // Quiet teammates recognised. `was_quiet` is a snapshot taken at write time,
  // so it cannot be gamed afterwards.
  peer_quiet_kudos: {
    eligible: always,
    progress: async (_cube, userId) =>
      distinctReceivers(giverHash(userId), { kind: PeerFeedbackKind.KUDOS, was_quiet: true })
  },

  // Kudos that recipients marked helpful, one per distinct recipient.
  peer_helpful_feedback: {
    eligible: async (_cube, userId) =>
      (await prisma.peerFeedback.count({
        where: { giver_hash: giverHash(userId), kind: PeerFeedbackKind.KUDOS }
      })) > 0,
    progress: async (_cube, userId) =>
      distinctReceivers(giverHash(userId), {
        kind: PeerFeedbackKind.KUDOS,
        helpful_at: { not: null }
      })
  },

  // Share of this Cube's adjudicated concerns that mentors confirmed. A rate
  // with a minimum sample, and 0 until enough have been adjudicated.
  peer_calibration: {
    eligible: async (_cube, userId) =>
      (await prisma.peerFeedback.count({
        where: { giver_hash: giverHash(userId), kind: PeerFeedbackKind.CONCERN }
      })) > 0,
    progress: async (_cube, userId, ctx) => {
      const stat = await prisma.peerReviewerStat.findUnique({
        where: { giver_hash: giverHash(userId) }
      });
      if (!stat) return 0;
      const adjudicated = stat.confirmed + stat.dismissed;
      if (adjudicated < ctx.minSampleSize) return 0;
      return Math.round((stat.confirmed / adjudicated) * 100);
    }
  },

  // Different people who recognised this Cube (delivered feedback only).
  peer_distinct_givers_received: {
    eligible: always,
    progress: async cubeProfileId => {
      const rows = await prisma.peerFeedback.findMany({
        where: {
          receiver_id: cubeProfileId,
          kind: PeerFeedbackKind.KUDOS,
          status: PeerFeedbackStatus.ACTIVE,
          created_at: { lt: digestCutoff() }
        },
        distinct: ['giver_hash'],
        select: { giver_hash: true }
      });
      return rows.length;
    }
  },

  // Highest peer title tier held: 1 Common, 2 Rare, 3 Epic.
  peer_title_tier: {
    eligible: always,
    progress: async cubeProfileId => {
      const titles = await prisma.peerTitle.findMany({
        where: { cube_id: cubeProfileId },
        select: { rarity: true }
      });
      return titles.reduce((max, t) => Math.max(max, RARITY_ORDINAL[t.rarity]), 0);
    }
  },

  // MVCubes awards won.
  mvcubes_awards: {
    eligible: always,
    progress: async cubeProfileId => prisma.mvcubesAward.count({ where: { cube_id: cubeProfileId } })
  }
};
