/**
 * Single source of truth for a Cube's overall performance score.
 *
 * The base number reproduces, exactly, what Profile.tsx used to compute in the
 * browser: the mean of the scorecard percentage (9 criteria out of 5) and the
 * private-note percentage (score out of 10), or whichever of the two exists.
 *
 * Peer feedback then moves it by at most PEER_SCORE_CAP (20%), scaled by how
 * much independent evidence exists. With no peer data the weight is 0 and the
 * overall score is identical to the legacy one.
 */
import prisma from './prisma';
import { K_ANONYMITY, PEER_SCORE_CAP } from '../config/peer';

export const SCORECARD_KEYS = [
  'technical_ability_score',
  'research_ability_score',
  'demo_output_score',
  'ownership_score',
  'communication_score',
  'leadership_score',
  'product_thinking_score',
  'reliability_score',
  'self_reflection_score'
] as const;

export interface ScoreBreakdown {
  /** Final score, 0-100, or null when there is no scorecard or private score. */
  overall: number | null;
  /** Score before any peer influence. */
  base: number | null;
  scorecard: { average: number; percentage: number; count: number };
  private_notes: { average: number; percentage: number; count: number };
  peer: {
    applied: boolean;
    /** Share of the overall score that came from peers (0 - PEER_SCORE_CAP). */
    weight: number;
    /** Peer signal in [-1, 1], or null when there is not enough evidence. */
    signal: number | null;
    /** Points the peer component moved the score (can be negative). */
    delta: number;
  };
}

/** Pure combination step, exported so it can be tested without a database. */
export function combineBase(
  scorecardPct: number | null,
  privatePct: number | null
): number | null {
  if (scorecardPct !== null && privatePct !== null) return (scorecardPct + privatePct) / 2;
  if (scorecardPct !== null) return scorecardPct;
  if (privatePct !== null) return privatePct;
  return null;
}

/** Confidence in [0, 1] from how many independent people and contexts agree. */
export function peerConfidence(distinctGivers: number, distinctContexts: number): number {
  if (distinctGivers < K_ANONYMITY) return 0;
  return Math.min(1, distinctGivers / 8) * (distinctContexts >= 2 ? 1 : 0.6);
}

/** Signal in [-1, 1] from effective kudos and verified concerns. */
export function peerSignalValue(kudosScore: number, concernScore: number): number {
  return Math.tanh((kudosScore - 1.5 * concernScore) / 6);
}

/** Pure peer-adjustment step. Returns the new overall and what was applied. */
export function applyPeer(
  base: number,
  signal: number,
  confidence: number
): { overall: number; weight: number; delta: number } {
  const weight = PEER_SCORE_CAP * confidence;
  const peerPct = signal >= 0 ? base + signal * (100 - base) : base + signal * base;
  const overall = Math.min(100, Math.max(0, (1 - weight) * base + weight * peerPct));
  return { overall, weight, delta: overall - base };
}

export async function computeScoreBreakdown(cubeProfileId: string): Promise<ScoreBreakdown> {
  const profile = await prisma.cubeProfile.findUnique({
    where: { id: cubeProfileId },
    select: { id: true, user_id: true }
  });

  const empty: ScoreBreakdown = {
    overall: null,
    base: null,
    scorecard: { average: 0, percentage: 0, count: 0 },
    private_notes: { average: 0, percentage: 0, count: 0 },
    peer: { applied: false, weight: 0, signal: null, delta: 0 }
  };
  if (!profile) return empty;

  const [feedback, notes, signal] = await Promise.all([
    prisma.mentorFeedback.findMany({ where: { cube_id: profile.user_id } }),
    prisma.privateNote.findMany({
      where: { cube_id: cubeProfileId },
      select: { score: true }
    }),
    prisma.peerSignal.findUnique({ where: { cube_id: cubeProfileId } })
  ]);

  let scorecardSum = 0;
  let scorecardCount = 0;
  for (const fb of feedback as any[]) {
    for (const key of SCORECARD_KEYS) {
      const value = fb[key];
      if (value !== undefined && value !== null) {
        scorecardSum += value;
        scorecardCount += 1;
      }
    }
  }
  const scorecardAvg = scorecardCount > 0 ? scorecardSum / scorecardCount : 0;
  const scorecardPct = (scorecardAvg / 5) * 100;

  let privateSum = 0;
  let privateCount = 0;
  for (const note of notes) {
    if (note.score !== undefined && note.score !== null) {
      privateSum += note.score;
      privateCount += 1;
    }
  }
  const privateAvg = privateCount > 0 ? privateSum / privateCount : 0;
  const privatePct = (privateAvg / 10) * 100;

  const base = combineBase(
    scorecardCount > 0 ? scorecardPct : null,
    privateCount > 0 ? privatePct : null
  );

  const result: ScoreBreakdown = {
    overall: base,
    base,
    scorecard: { average: scorecardAvg, percentage: scorecardPct, count: scorecardCount },
    private_notes: { average: privateAvg, percentage: privatePct, count: privateCount },
    peer: { applied: false, weight: 0, signal: null, delta: 0 }
  };

  // Peers can only adjust a score that already exists; they never create one.
  if (base === null || !signal) return result;

  const confidence = peerConfidence(signal.distinct_givers, signal.distinct_contexts);
  if (confidence <= 0) return result;

  const value = peerSignalValue(signal.kudos_score, signal.concern_score);
  const applied = applyPeer(base, value, confidence);

  result.overall = applied.overall;
  result.peer = {
    applied: true,
    weight: applied.weight,
    signal: value,
    delta: applied.delta
  };
  return result;
}
