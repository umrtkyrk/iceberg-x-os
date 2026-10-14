import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fallbackOperationsBrief,
  latestCubeRecommendations,
  OperationAction,
  parseOperationsBrief,
} from '../src/services/adminOperations';

const actions: OperationAction[] = [
  {
    id: 'support',
    title: 'Check in',
    detail: '2 Cubes need support.',
    href: '/directory',
    priority: 'high',
    count: 2,
  },
  {
    id: 'documents',
    title: 'Review documents',
    detail: '3 documents await approval.',
    href: '/admin/nda',
    priority: 'medium',
    count: 3,
  },
];

test('a newer continue recommendation clears an older risk flag', () => {
  const rows = latestCubeRecommendations([
    { cube_id: 'a', recommended_next_step: 'Continue_as_Cube' },
    { cube_id: 'b', recommended_next_step: 'Inactive_Risk' },
    { cube_id: 'a', recommended_next_step: 'Inactive_Risk' },
  ]);
  assert.deepEqual(
    rows
      .filter((row) => row.recommended_next_step === 'Inactive_Risk')
      .map((row) => row.cube_id),
    ['b']
  );
});

test('AI priorities cannot invent destinations or repeat the same queue', () => {
  const brief = parseOperationsBrief(
    JSON.stringify({
      overview: 'Two queues need attention.',
      priorities: [
        { actionId: 'support', reason: 'Arrange a check-in.' },
        { actionId: 'unknown', reason: 'Invented action.' },
        { actionId: 'support', reason: 'Duplicate.' },
        { actionId: 'documents', reason: 'Review pending uploads.' },
      ],
    }),
    actions
  );
  assert.deepEqual(
    brief.priorities.map((priority) => priority.actionId),
    ['support', 'documents']
  );
});

test('invalid AI output is rejected so the snapshot fallback can be used', () => {
  for (const raw of [
    'not json',
    'null',
    '{"overview":42,"priorities":[]}',
    '{"overview":"Brief","priorities":[{"actionId":"unknown","reason":"Invented"}]}',
  ]) {
    assert.throws(() => parseOperationsBrief(raw, actions));
  }
});

test('a clear programme has no fabricated priorities', () => {
  assert.deepEqual(
    parseOperationsBrief('{"overview":"Queues are clear.","priorities":[]}', [])
      .priorities,
    []
  );
  const brief = fallbackOperationsBrief(0, 0, []);
  assert.match(brief.overview, /0 Cubes/);
  assert.deepEqual(brief.priorities, []);
});

test('fallback uses actual counts and the server priority order', () => {
  const brief = fallbackOperationsBrief(12, 4, actions);
  assert.match(brief.overview, /12 Cubes.*4 missions/);
  assert.deepEqual(brief.priorities, [
    { actionId: 'support', reason: '2 Cubes need support.' },
    { actionId: 'documents', reason: '3 documents await approval.' },
  ]);
});
