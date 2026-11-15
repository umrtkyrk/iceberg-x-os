import assert from 'node:assert/strict';
import test from 'node:test';
// Pure frontend helpers, loaded through the CJS runner (see run.cjs).
import { describeForMentor, sortForMentor, type CubeSignals } from '../../frontend/src/utils/cubeSignals';

const cube = (name: string, status: CubeSignals['status'], lastContribution: string | null) =>
  ({ name, status, activity: { last_contribution_at: lastContribution } }) as Pick<CubeSignals, 'name' | 'status' | 'activity'>;

test('quiet Cubes come first, then those needing attention, then on track', () => {
  const sorted = sortForMentor([
    cube('Ada', 'on_track', '2026-11-14T10:00:00Z'),
    cube('Ben', 'needs_attention', '2026-11-10T10:00:00Z'),
    cube('Cem', 'quiet', '2026-10-01T10:00:00Z'),
  ]);
  assert.deepEqual(sorted.map(c => c.name), ['Cem', 'Ben', 'Ada']);
});

test('within a group, the longest-silent Cube comes first and never-contributed is the oldest', () => {
  const sorted = sortForMentor([
    cube('Recent', 'quiet', '2026-11-01T10:00:00Z'),
    cube('Never', 'quiet', null),
    cube('Older', 'quiet', '2026-10-01T10:00:00Z'),
  ]);
  assert.deepEqual(sorted.map(c => c.name), ['Never', 'Older', 'Recent']);
});

test('sorting does not mutate the input', () => {
  const input = [cube('B', 'on_track', null), cube('A', 'quiet', null)];
  sortForMentor(input);
  assert.deepEqual(input.map(c => c.name), ['B', 'A']);
});

test('signals read as plain sentences for the mentor', () => {
  const now = new Date('2026-11-16T12:00:00');
  assert.equal(describeForMentor({ kind: 'quiet_no_contribution', severity: 'quiet', last_contribution_at: null, days: null }, now), 'No visible contribution yet');
  assert.equal(
    describeForMentor({ kind: 'update_overdue', severity: 'attention', mission_id: 'm', mission_title: 'Search', last_update_at: '2026-11-10T12:00:00', days: 6 }, now),
    'No update on Search for 6 days'
  );
  assert.equal(
    describeForMentor({ kind: 'open_blocker', severity: 'attention', mission_id: 'm', mission_title: 'Search', blockers: 'keys', reported_at: '2026-11-15T09:00:00' }, now),
    'Blocked on Search (reported yesterday)'
  );
  assert.equal(describeForMentor({ kind: 'document_rejected', severity: 'attention', count: 2 }, now), '2 rejected documents to re-upload');
});
