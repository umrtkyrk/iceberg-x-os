import assert from 'node:assert/strict';
import test from 'node:test';
import { legacyColumns, normalizeRatings, type ApplicableCriterion } from '../src/services/scorecard.service';

const criteria: ApplicableCriterion[] = [
  { id: 'own', name: 'Ownership', legacy_key: 'ownership_score' },
  { id: 'com', name: 'Communication', legacy_key: 'communication_score' },
  { id: 'cnt', name: 'Content & creative quality', legacy_key: null },
];

test('every criterion is answered once, in the criteria order', () => {
  const out = normalizeRatings(
    [
      { criterion_id: 'cnt', value: 4 },
      { criterion_id: 'own', value: 3 },
      { criterion_id: 'com', value: null },
    ],
    criteria
  );
  assert.deepEqual(out, [
    { criterion_id: 'own', value: 3 },
    { criterion_id: 'com', value: null },
    { criterion_id: 'cnt', value: 4 },
  ]);
});

test('missing, duplicate, foreign and out-of-range answers are refused', () => {
  assert.throws(() => normalizeRatings([{ criterion_id: 'own', value: 3 }], criteria), /Communication, Content/);
  assert.throws(
    () => normalizeRatings([{ criterion_id: 'own', value: 3 }, { criterion_id: 'own', value: 4 }, { criterion_id: 'com', value: 1 }, { criterion_id: 'cnt', value: 1 }], criteria),
    /twice/
  );
  assert.throws(() => normalizeRatings([{ criterion_id: 'technical', value: 3 }], criteria), /does not apply/);
  assert.throws(() => normalizeRatings([{ criterion_id: 'own', value: 6 }, { criterion_id: 'com', value: 1 }, { criterion_id: 'cnt', value: 1 }], criteria), /between/);
  assert.throws(() => normalizeRatings([{ criterion_id: 'own', value: 2.5 }, { criterion_id: 'com', value: 1 }, { criterion_id: 'cnt', value: 1 }], criteria), /whole/);
  assert.throws(() => normalizeRatings('x', criteria));
});

test('a scorecard needs at least one rating and at least one criterion', () => {
  assert.throws(
    () => normalizeRatings(criteria.map(c => ({ criterion_id: c.id, value: null })), criteria),
    /at least one/
  );
  assert.throws(() => normalizeRatings([], []), /No scorecard criteria/);
});

test('ratings with a legacy key fill that column; everything else stays null', () => {
  const cols = legacyColumns(
    [
      { criterion_id: 'own', value: 4 },
      { criterion_id: 'com', value: null },
      { criterion_id: 'cnt', value: 5 },
    ],
    criteria
  );
  assert.equal(cols.ownership_score, 4);
  assert.equal(cols.communication_score, null);
  assert.equal(cols.technical_ability_score, null);
  assert.equal(Object.values(cols).filter(v => v !== null).length, 1);
});
