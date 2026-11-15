/**
 * Scoring v2 formula (docs/scoring-v2.md). Pure: everything it needs is in
 * ScoreInput, so it is unit-tested without a database and can be evaluated
 * "as of" any past date for the weekly backfill.
 *
 *   overall = peer_adjust( 0.70 × mentor + 0.30 × delivery )
 *   mentor  = 0.70 × scorecards + 0.30 × private assessments
 *
 * Assessments are weighted by recency (10-week half-life) and by mission
 * difficulty; check-ins count at half the weight of a scorecard; "not
 * observed" ratings are left out, never treated as zero.
 */
import { applyPeer } from './score.service';

export const FORMULA_VERSION = 'v2.0';
export const HALF_LIFE_DAYS = 70;
export const CHECKIN_WEIGHT = 0.5;
export const PEER_CAP_V2 = 0.15;
export const MIN_ASSESSMENTS = 2;
export const STALE_AFTER_DAYS = 70;
export const MENTOR_MIX = { scorecards: 0.7, private: 0.3 } as const;
export const PILLAR_MIX = { mentor: 0.7, delivery: 0.3 } as const;
export const DELIVERY_PARTS = { rhythm: 0.35, delivery: 0.3, attendance: 0.2, learning: 0.15 } as const;
export const DIFFICULTY_WEIGHT: Record<string, number> = {
  Level_1_Research_Only: 0.8,
  Level_2_Research_Mock: 0.9,
  Level_3_Working_POC: 1.0,
  Level_4_Integration_Candidate: 1.15,
  Level_5_Main_Team_Assist: 1.3,
};
export const BANDS = [
  { band: 'Exceptional', min: 85 },
  { band: 'Strong', min: 70 },
  { band: 'Solid', min: 55 },
  { band: 'Developing', min: -Infinity },
] as const;
export type Band = (typeof BANDS)[number]['band'];
/** Band order for quests: Developing 1 … Exceptional 4. */
export const BAND_RANK: Record<Band, number> = { Developing: 1, Solid: 2, Strong: 3, Exceptional: 4 };

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

export interface Assessment {
  at: Date;
  kind: 'scorecard' | 'checkin';
  /** criterion key -> 1-5 or null (not observed). */
  ratings: Record<string, number | null>;
  difficulty: string | null;
  mission_id: string | null;
  /** Written before scoring v2 (read from the nine legacy columns). */
  legacy: boolean;
  mentor_id: string;
}

export interface ScoreInput {
  assessments: Assessment[];
  private_scores: { at: Date; score: number }[];
  /** When the Cube joined each mission. */
  memberships: { mission_id: string; joined_at: Date }[];
  /** Missions whose current status means delivery was due (demo ready or later). */
  delivery_due_mission_ids: string[];
  update_times: Date[];
  /** Demo submissions by the Cube or their team. */
  demos: { mission_id: string; at: Date }[];
  attendance: { at: Date; attended: boolean }[];
  quiz_scores: { at: Date; score: number }[];
  /** Current peer signal, applied only to the live score. */
  peer: { signal: number; confidence: number } | null;
  /** criterion key -> display name and whether it is core. */
  criteria: Record<string, { name: string; core: boolean; discipline_id?: string | null }>;
}

export interface ScoreV2 {
  formula_version: string;
  as_of: string;
  overall: number | null;
  band: Band | null;
  provisional: boolean;
  /** Points the private assessments moved the overall score. */
  private_effect: number | null;
  pillars: {
    mentor: number | null;
    scorecards: number | null;
    private: number | null;
    delivery: number | null;
    delivery_parts: { rhythm: number | null; delivery: number | null; attendance: number | null; learning: number | null };
    peer_delta: number;
  };
  /** Recency-weighted level per criterion (1-5), for the skill profile. */
  criteria: { key: string; name: string; core: boolean; level: number; evidence: number }[];
  basis: {
    assessments: number;
    scorecards: number;
    checkins: number;
    legacy: number;
    missions: number;
    private_assessments: number;
    active_weeks: number;
    last_assessed_at: string | null;
    stale: boolean;
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const recency = (at: Date, asOf: Date) => Math.pow(0.5, Math.max(0, asOf.getTime() - at.getTime()) / DAY_MS / HALF_LIFE_DAYS);
const weightedMean = (pairs: [number, number][]) => {
  const total = pairs.reduce((sum, [, w]) => sum + w, 0);
  return total > 0 ? pairs.reduce((sum, [v, w]) => sum + v * w, 0) / total : null;
};
/** Weighted mix of the parts that exist, re-weighted over those parts. */
const mix = (parts: [number | null, number][]) => weightedMean(parts.filter((p): p is [number, number] => p[0] !== null));

export const bandFor = (overall: number): Band => BANDS.find(b => overall >= b.min)!.band;

const observed = (a: Assessment) => Object.values(a.ratings).filter((v): v is number => typeof v === 'number');

function assessmentWeight(a: Assessment, asOf: Date) {
  return recency(a.at, asOf) * (DIFFICULTY_WEIGHT[a.difficulty || ''] ?? 1) * (a.kind === 'checkin' ? CHECKIN_WEIGHT : 1);
}

function deliveryParts(input: ScoreInput, asOf: Date) {
  const t = asOf.getTime();
  const joined = input.memberships.filter(m => m.joined_at.getTime() <= t);

  // Rhythm: share of weeks since joining the first mission with an update.
  let rhythm: number | null = null;
  let activeWeeks = 0;
  if (joined.length > 0) {
    const start = Math.min(...joined.map(m => m.joined_at.getTime()));
    activeWeeks = Math.max(1, Math.ceil((t - start) / WEEK_MS));
    const weeks = new Set(
      input.update_times.filter(u => u.getTime() >= start && u.getTime() <= t).map(u => Math.floor((u.getTime() - start) / WEEK_MS))
    );
    rhythm = Math.min(100, (weeks.size / activeWeeks) * 100);
  }

  // Delivery: missions where delivery was due that got a demo. Historically a
  // mission counts as due once its demo exists; the live score also counts
  // missions whose current status says the demo is due.
  const isLive = Date.now() - t < WEEK_MS;
  const joinedIds = new Set(joined.map(m => m.mission_id));
  const demoed = new Set(input.demos.filter(d => d.at.getTime() <= t && joinedIds.has(d.mission_id)).map(d => d.mission_id));
  const due = new Set(demoed);
  if (isLive) for (const id of input.delivery_due_mission_ids) if (joinedIds.has(id)) due.add(id);
  const delivery = due.size > 0 ? (demoed.size / due.size) * 100 : null;

  const meetings = input.attendance.filter(a => a.at.getTime() <= t);
  const attendance = meetings.length > 0 ? (meetings.filter(m => m.attended).length / meetings.length) * 100 : null;

  const quizzes = input.quiz_scores.filter(q => q.at.getTime() <= t);
  const learning = quizzes.length > 0 ? Math.max(...quizzes.map(q => q.score)) : null;

  return { rhythm, delivery, attendance, learning, activeWeeks };
}

function combine(mentor: number | null, delivery: number | null, peer: ScoreInput['peer']) {
  if (mentor === null) return { overall: null, peerDelta: 0 };
  const base = mix([
    [mentor, PILLAR_MIX.mentor],
    [delivery, PILLAR_MIX.delivery],
  ])!;
  if (!peer || peer.confidence <= 0) return { overall: base, peerDelta: 0 };
  // applyPeer scales by its cap; rescale the confidence to the v2 cap.
  const applied = applyPeer(base, peer.signal, peer.confidence * (PEER_CAP_V2 / 0.2));
  return { overall: applied.overall, peerDelta: applied.delta };
}

export function computeScoreV2(input: ScoreInput, asOf: Date, { includePeer = false } = {}): ScoreV2 {
  const t = asOf.getTime();
  const assessments = input.assessments.filter(a => a.at.getTime() <= t && observed(a).length > 0);
  const privates = input.private_scores.filter(p => p.at.getTime() <= t);

  const scorecards = weightedMean(
    assessments.map(a => {
      const values = observed(a);
      return [(values.reduce((s, v) => s + v, 0) / values.length / 5) * 100, assessmentWeight(a, asOf)] as [number, number];
    })
  );
  const priv = weightedMean(privates.map(p => [p.score * 10, recency(p.at, asOf)] as [number, number]));
  const mentor = mix([
    [scorecards, MENTOR_MIX.scorecards],
    [priv, MENTOR_MIX.private],
  ]);

  const parts = deliveryParts(input, asOf);
  const delivery = mix([
    [parts.rhythm, DELIVERY_PARTS.rhythm],
    [parts.delivery, DELIVERY_PARTS.delivery],
    [parts.attendance, DELIVERY_PARTS.attendance],
    [parts.learning, DELIVERY_PARTS.learning],
  ]);

  const peer = includePeer ? input.peer : null;
  const { overall, peerDelta } = combine(mentor, delivery, peer);
  const withoutPrivate = combine(scorecards, delivery, peer).overall;
  const privateEffect = overall !== null && withoutPrivate !== null && privates.length > 0 ? overall - withoutPrivate : null;

  // Skill profile: recency/difficulty-weighted level per criterion.
  const perCriterion = new Map<string, [number, number][]>();
  for (const a of assessments) {
    const w = assessmentWeight(a, asOf);
    for (const [key, value] of Object.entries(a.ratings)) {
      if (typeof value !== 'number') continue;
      if (!perCriterion.has(key)) perCriterion.set(key, []);
      perCriterion.get(key)!.push([value, w]);
    }
  }
  const criteria = [...perCriterion.entries()]
    .map(([key, pairs]) => ({
      key,
      name: input.criteria[key]?.name || key,
      core: input.criteria[key]?.core ?? false,
      level: round1(weightedMean(pairs)!),
      evidence: pairs.length,
    }))
    .sort((a, b) => Number(b.core) - Number(a.core) || a.name.localeCompare(b.name));

  const last = assessments.reduce<Date | null>((latest, a) => (!latest || a.at > latest ? a.at : latest), null);
  const scorecardCount = assessments.filter(a => a.kind === 'scorecard').length;

  return {
    formula_version: FORMULA_VERSION,
    as_of: asOf.toISOString(),
    overall: overall === null ? null : round1(overall),
    band: overall === null ? null : bandFor(overall),
    provisional: scorecardCount < MIN_ASSESSMENTS,
    private_effect: privateEffect === null ? null : round1(privateEffect),
    pillars: {
      mentor: mentor === null ? null : round1(mentor),
      scorecards: scorecards === null ? null : round1(scorecards),
      private: priv === null ? null : round1(priv),
      delivery: delivery === null ? null : round1(delivery),
      delivery_parts: {
        rhythm: parts.rhythm === null ? null : round1(parts.rhythm),
        delivery: parts.delivery === null ? null : round1(parts.delivery),
        attendance: parts.attendance === null ? null : round1(parts.attendance),
        learning: parts.learning === null ? null : round1(parts.learning),
      },
      peer_delta: round1(peerDelta),
    },
    criteria,
    basis: {
      assessments: assessments.length,
      scorecards: scorecardCount,
      checkins: assessments.length - scorecardCount,
      legacy: assessments.filter(a => a.legacy).length,
      missions: new Set(assessments.map(a => a.mission_id).filter(Boolean)).size,
      private_assessments: privates.length,
      active_weeks: parts.activeWeeks,
      last_assessed_at: last ? last.toISOString() : null,
      stale: last ? t - last.getTime() > STALE_AFTER_DAYS * DAY_MS : false,
    },
  };
}

/** Monday 00:00 UTC of the week containing `date`. */
export function weekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(d.getTime() - day * DAY_MS);
}

/** Week starts from the week of `from` up to the week of `to`, inclusive. */
export function weeksBetween(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  for (let w = weekStart(from); w.getTime() <= to.getTime(); w = new Date(w.getTime() + WEEK_MS)) out.push(w);
  return out;
}

/** Points gained between the first and the last non-null weekly score inside `weeks`. */
export function growthOver(snapshots: { week_start: Date; overall: number | null }[], weeks: number, now = new Date()): number | null {
  const since = now.getTime() - weeks * WEEK_MS;
  const points = snapshots
    .filter(s => s.overall !== null && s.week_start.getTime() >= since)
    .sort((a, b) => a.week_start.getTime() - b.week_start.getTime());
  return points.length >= 2 ? round1(points[points.length - 1].overall! - points[0].overall!) : null;
}
