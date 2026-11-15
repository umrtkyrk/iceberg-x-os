/**
 * Scoring v2 scorecards: validating the per-criterion ratings a mentor sends
 * and mirroring them into the legacy columns, so the current score, radar
 * chart and quests keep working until the v2 score goes live.
 */
import { badRequest } from '../utils/http';
import { MIN_SCORE, MAX_SCORE } from '../config/constants';

export const LEGACY_SCORE_KEYS = [
  'technical_ability_score',
  'research_ability_score',
  'demo_output_score',
  'ownership_score',
  'communication_score',
  'leadership_score',
  'product_thinking_score',
  'reliability_score',
  'self_reflection_score',
] as const;
export type LegacyScoreKey = (typeof LEGACY_SCORE_KEYS)[number];

export interface ApplicableCriterion {
  id: string;
  name: string;
  legacy_key: string | null;
}

export interface NormalizedRating {
  criterion_id: string;
  /** 1-5, or null for "not observed". */
  value: number | null;
}

/**
 * Every applicable criterion must be answered exactly once, with a whole
 * number 1-5 or null ("not observed"); nothing else is accepted. At least one
 * criterion must be rated.
 */
export function normalizeRatings(input: unknown, applicable: ApplicableCriterion[]): NormalizedRating[] {
  if (!Array.isArray(input)) throw badRequest('ratings must be a list.');
  if (applicable.length === 0) throw badRequest('No scorecard criteria are set up for this discipline yet.');
  const known = new Map(applicable.map(c => [c.id, c]));
  const answers = new Map<string, number | null>();

  for (const row of input) {
    const r = row as { criterion_id?: unknown; value?: unknown };
    if (typeof r.criterion_id !== 'string' || !known.has(r.criterion_id)) {
      throw badRequest('A rating refers to a criterion that does not apply to this scorecard.');
    }
    if (answers.has(r.criterion_id)) throw badRequest(`${known.get(r.criterion_id)!.name} is rated twice.`);
    if (r.value === null) {
      answers.set(r.criterion_id, null);
      continue;
    }
    if (typeof r.value !== 'number' || !Number.isInteger(r.value) || r.value < MIN_SCORE || r.value > MAX_SCORE) {
      throw badRequest(`Ratings must be whole numbers between ${MIN_SCORE} and ${MAX_SCORE}, or "not observed".`);
    }
    answers.set(r.criterion_id, r.value);
  }

  const missing = applicable.filter(c => !answers.has(c.id)).map(c => c.name);
  if (missing.length > 0) throw badRequest(`Rate or mark as not observed: ${missing.join(', ')}.`);
  if ([...answers.values()].every(v => v === null)) throw badRequest('Rate at least one criterion.');

  return applicable.map(c => ({ criterion_id: c.id, value: answers.get(c.id)! }));
}

/**
 * The legacy columns for a v2 scorecard: a criterion with a legacy_key writes
 * its value there; every other legacy column is null.
 */
export function legacyColumns(ratings: NormalizedRating[], applicable: ApplicableCriterion[]): Record<LegacyScoreKey, number | null> {
  const out = Object.fromEntries(LEGACY_SCORE_KEYS.map(k => [k, null])) as Record<LegacyScoreKey, number | null>;
  const byId = new Map(applicable.map(c => [c.id, c]));
  for (const rating of ratings) {
    const key = byId.get(rating.criterion_id)?.legacy_key;
    if (key && (LEGACY_SCORE_KEYS as readonly string[]).includes(key)) out[key as LegacyScoreKey] = rating.value;
  }
  return out;
}
