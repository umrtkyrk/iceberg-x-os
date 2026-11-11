import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CASE_QUESTION_IDS,
  RUBRIC,
  parseAnswers,
  parseCaseEvaluation,
  parseRubricScores,
  suggestDecision,
  totalScore,
} from '../src/services/caseEvaluation';

const full = { commitment: 21, time: 17, learning: 16, communication: 12, teamfit: 10, expectation: 10 };

test('rubric maxima add up to 100', () => {
  assert.equal(RUBRIC.reduce((sum, item) => sum + item.max, 0), 100);
});

test('total is the sum of the criteria', () => {
  assert.equal(totalScore(full), 86);
});

test('decision suggestion follows the score bands', () => {
  assert.equal(suggestDecision(92), 'StrongYes');
  assert.equal(suggestDecision(88), 'Yes');
  assert.equal(suggestDecision(74), 'Maybe');
  assert.equal(suggestDecision(40), 'No');
});

test('scores above a criterion maximum are rejected', () => {
  assert.throws(() => parseRubricScores({ ...full, teamfit: 11 }));
  assert.throws(() => parseRubricScores({ ...full, time: -1 }));
  assert.throws(() => parseRubricScores({ ...full, time: 12.5 }));
  assert.throws(() => parseRubricScores({ ...full, time: '12' }));
  assert.throws(() => parseRubricScores({ commitment: 10 }));
});

test('AI output is validated before it is used', () => {
  const ok = parseCaseEvaluation(
    JSON.stringify({ scores: full, reduction: ' Slow to ask for help. ', interview_focus: 'Availability.' })
  );
  assert.equal(ok.reduction, 'Slow to ask for help.');
  assert.throws(() => parseCaseEvaluation(JSON.stringify({ scores: { ...full, commitment: 99 }, reduction: 'x', interview_focus: 'y' })));
  assert.throws(() => parseCaseEvaluation(JSON.stringify({ scores: full, reduction: '', interview_focus: 'y' })));
  assert.throws(() => parseCaseEvaluation('not json'));
});

test('answers keep known questions only and allow blanks', () => {
  const answers = parseAnswers({ q1: '  step one ', q2: '', extra: 'ignored' });
  assert.equal(answers.q1, 'step one');
  assert.equal(answers.q2, '');
  assert.equal(answers.q3, '');
  assert.deepEqual(Object.keys(answers), CASE_QUESTION_IDS);
  assert.equal('extra' in answers, false);
});

test('oversized or non-text answers are rejected', () => {
  assert.throws(() => parseAnswers({ q1: 'a'.repeat(3001) }));
  assert.throws(() => parseAnswers({ q1: 42 }));
  assert.throws(() => parseAnswers(null));
});
