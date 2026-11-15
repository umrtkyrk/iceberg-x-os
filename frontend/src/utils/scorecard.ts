/**
 * Reading scorecards for display. A scorecard is either a scoring v2 one
 * (per-criterion `ratings`, null = not observed) or a legacy one (nine fixed
 * columns). v2 scorecards also fill the legacy columns that map to their
 * criteria and leave the rest null, so every average here skips nulls instead
 * of counting them as zero.
 */
export const LEGACY_SCORE_ITEMS = [
  { key: 'technical_ability_score', label: 'Technical' },
  { key: 'research_ability_score', label: 'Research' },
  { key: 'demo_output_score', label: 'Demo Output' },
  { key: 'ownership_score', label: 'Ownership' },
  { key: 'communication_score', label: 'Comm' },
  { key: 'leadership_score', label: 'Leadership' },
  { key: 'product_thinking_score', label: 'Product' },
  { key: 'reliability_score', label: 'Reliability' },
  { key: 'self_reflection_score', label: 'Reflection' },
] as const;

export interface ScorecardItem {
  label: string;
  /** 1-5, or null when not observed / not applicable. */
  value: number | null;
}

const isScore = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** The ratings to show for one scorecard. */
export function scorecardItems(feedback: any): ScorecardItem[] {
  const ratings: any[] = feedback?.ratings || [];
  if (ratings.length > 0) {
    return ratings.map(r => ({ label: r.criterion?.name || 'Criterion', value: isScore(r.value) ? r.value : null }));
  }
  return LEGACY_SCORE_ITEMS.map(item => ({ label: item.label, value: isScore(feedback?.[item.key]) ? feedback[item.key] : null }));
}

/** Mean of the observed ratings on one scorecard, one decimal, or null. */
export function scorecardAverage(feedback: any): number | null {
  const values = scorecardItems(feedback).map(i => i.value).filter(isScore);
  return values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;
}

/**
 * Per legacy column average across scorecards, for the radar chart. Each
 * column is averaged over the scorecards that have a value for it.
 */
export function averageLegacyScores(feedbacks: any[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { key } of LEGACY_SCORE_ITEMS) {
    const values = (feedbacks || []).map(fb => fb?.[key]).filter(isScore);
    out[key] = values.length ? parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)) : 0;
  }
  return out;
}
