import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bandFor,
  computeScoreV2,
  growthOver,
  weekStart,
  weeksBetween,
  type Assessment,
  type ScoreInput,
} from '../src/services/scoreV2';

const NOW = new Date('2026-11-16T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const card = (days: number, value: number | null, extra: Partial<Assessment> = {}): Assessment => ({
  at: daysAgo(days),
  kind: 'scorecard',
  ratings: { ownership: value, communication: value },
  difficulty: 'Level_3_Working_POC',
  mission_id: 'm1',
  legacy: false,
  mentor_id: 'mentor',
  ...extra,
});
const base = (over: Partial<ScoreInput> = {}): ScoreInput => ({
  assessments: [],
  private_scores: [],
  memberships: [],
  delivery_due_mission_ids: [],
  update_times: [],
  demos: [],
  attendance: [],
  quiz_scores: [],
  peer: null,
  criteria: { ownership: { name: 'Ownership', core: true }, communication: { name: 'Communication', core: true } },
  ...over,
});

test('no assessment means no score, even with delivery data', () => {
  const s = computeScoreV2(base({ attendance: [{ at: daysAgo(3), attended: true }] }), NOW);
  assert.equal(s.overall, null);
  assert.equal(s.band, null);
});

test('recent assessments outweigh old ones (10-week half-life)', () => {
  const s = computeScoreV2(base({ assessments: [card(140, 2), card(0, 4)] }), NOW);
  // Plain mean would be 60%; the 20-week-old 2/5 counts a quarter.
  assert.equal(s.pillars.scorecards, 72);
  assert.equal(s.overall, 72);
});

test('with no new evidence the score does not drift over time', () => {
  const input = base({ assessments: [card(10, 3), card(5, 4)] });
  assert.equal(computeScoreV2(input, NOW).overall, computeScoreV2(input, new Date(NOW.getTime() + 200 * 86_400_000)).overall);
});

test('"not observed" is left out, never counted as zero', () => {
  const a = card(0, 4, { ratings: { ownership: 4, communication: null } });
  assert.equal(computeScoreV2(base({ assessments: [a] }), NOW).pillars.scorecards, 80);
  const empty = card(0, null);
  assert.equal(computeScoreV2(base({ assessments: [empty] }), NOW).overall, null);
});

test('harder missions weigh more', () => {
  const s = computeScoreV2(
    base({ assessments: [card(0, 2, { difficulty: 'Level_1_Research_Only' }), card(0, 4, { difficulty: 'Level_5_Main_Team_Assist' })] }),
    NOW
  );
  assert.ok(s.pillars.scorecards! > 60, String(s.pillars.scorecards));
});

test('mentor pillar mixes scorecards 70 / private 30, and the private effect is disclosed', () => {
  const s = computeScoreV2(base({ assessments: [card(0, 4)], private_scores: [{ at: daysAgo(0), score: 5 }] }), NOW);
  assert.equal(s.pillars.mentor, 71); // 0.7 × 80 + 0.3 × 50
  assert.equal(s.private_effect, -9);
});

test('two scorecards are needed for a non-provisional score; check-ins count at half weight', () => {
  assert.equal(computeScoreV2(base({ assessments: [card(0, 4)] }), NOW).provisional, true);
  const withCheckin = computeScoreV2(base({ assessments: [card(0, 4), card(0, 2, { kind: 'checkin' })] }), NOW);
  assert.equal(withCheckin.provisional, true);
  assert.equal(withCheckin.pillars.scorecards, 66.7); // (80×1 + 40×0.5) / 1.5
  assert.equal(computeScoreV2(base({ assessments: [card(1, 4), card(0, 4)] }), NOW).provisional, false);
});

test('delivery pillar: rhythm, demos, attendance and quizzes, re-weighted over what exists', () => {
  const s = computeScoreV2(
    base({
      assessments: [card(0, 5)],
      memberships: [{ mission_id: 'm1', joined_at: daysAgo(28) }],
      update_times: [daysAgo(27), daysAgo(20), daysAgo(1)],
      delivery_due_mission_ids: ['m1'],
      attendance: [{ at: daysAgo(5), attended: true }, { at: daysAgo(12), attended: false }],
      quiz_scores: [{ at: daysAgo(3), score: 80 }],
    }),
    NOW
  );
  assert.deepEqual(s.pillars.delivery_parts, { rhythm: 75, delivery: 0, attendance: 50, learning: 80 });
  assert.equal(s.basis.active_weeks, 4);
  // overall = 0.7 × 100 + 0.3 × delivery
  assert.equal(s.overall, Math.round((70 + 0.3 * s.pillars.delivery!) * 10) / 10);
});

test('records after the as-of date are ignored (backfill)', () => {
  const input = base({ assessments: [card(30, 2), card(1, 5)] });
  assert.equal(computeScoreV2(input, daysAgo(10)).pillars.scorecards, 40);
});

test('peers move the live score by at most 15%', () => {
  const input = base({ assessments: [card(0, 3)], peer: { signal: 1, confidence: 1 } });
  assert.equal(computeScoreV2(input, NOW).overall, 60);
  const live = computeScoreV2(input, NOW, { includePeer: true });
  assert.equal(live.pillars.peer_delta, 6); // 15% of the way from 60 to 100
});

test('bands, weeks and growth', () => {
  assert.equal(bandFor(54.9), 'Developing');
  assert.equal(bandFor(55), 'Solid');
  assert.equal(bandFor(70), 'Strong');
  assert.equal(bandFor(85), 'Exceptional');
  assert.equal(weekStart(new Date('2026-11-19T23:00:00Z')).toISOString(), '2026-11-16T00:00:00.000Z');
  // 1 Nov 2026 is a Sunday, so its week starts on 26 Oct: 26 Oct, 2, 9 and 16 Nov.
  assert.equal(weeksBetween(new Date('2026-11-01T10:00:00Z'), NOW).length, 4);
  const snaps = [
    { week_start: daysAgo(70), overall: 50 },
    { week_start: daysAgo(14), overall: null },
    { week_start: daysAgo(7), overall: 63 },
  ];
  assert.equal(growthOver(snaps, 12, NOW), 13);
  assert.equal(growthOver(snaps.slice(1), 12, NOW), null);
});
