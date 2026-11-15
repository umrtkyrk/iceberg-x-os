import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveSignalItems,
  deriveStatus,
  QUIET_DAYS,
  UPDATE_STALE_DAYS,
  type SignalInput
} from '../src/services/cubeSignals.service';

const NOW = new Date('2026-11-16T12:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const base = (overrides: Partial<SignalInput> = {}): SignalInput => ({
  now: NOW,
  account_created_at: daysAgo(60),
  nda_status: 'signed',
  missions: [{ id: 'm1', title: 'Search revamp', joined_at: daysAgo(30) }],
  last_active_at: daysAgo(0),
  last_contribution_at: daysAgo(1),
  last_update: { at: daysAgo(1), mission_id: 'm1', blockers: null },
  last_update_by_mission: new Map([['m1', daysAgo(1)]]),
  rejected_documents: 0,
  webinar_due: null,
  ...overrides
});

const kinds = (input: SignalInput) => deriveSignalItems(input).map(i => i.kind);

test('an active Cube with a recent update is on track', () => {
  const items = deriveSignalItems(base());
  assert.deepEqual(items, []);
  assert.equal(deriveStatus(items), 'on_track');
});

test('an update is asked for once the last one is UPDATE_STALE_DAYS old', () => {
  assert.deepEqual(kinds(base({ last_update_by_mission: new Map([['m1', daysAgo(UPDATE_STALE_DAYS - 1)]]) })), []);
  const items = deriveSignalItems(base({ last_update_by_mission: new Map([['m1', daysAgo(UPDATE_STALE_DAYS)]]) }));
  assert.deepEqual(items.map(i => i.kind), ['update_overdue']);
  assert.equal(deriveStatus(items), 'needs_attention');
});

test('a Cube who just joined a mission is not chased for an update yet', () => {
  const input = base({
    missions: [{ id: 'm2', title: 'New', joined_at: daysAgo(2) }],
    last_update: null,
    last_update_by_mission: new Map()
  });
  assert.deepEqual(kinds(input), []);
});

test('no visit or no contribution for QUIET_DAYS marks a Cube quiet, which outranks attention', () => {
  const noVisits = deriveSignalItems(base({ last_active_at: daysAgo(QUIET_DAYS) }));
  assert.ok(noVisits.some(i => i.kind === 'quiet_no_visits'));
  assert.equal(deriveStatus(noVisits), 'quiet');

  const visitsButSilent = deriveSignalItems(base({ last_contribution_at: daysAgo(QUIET_DAYS + 2), nda_status: 'pending' }));
  assert.deepEqual(visitsButSilent.map(i => i.kind), ['quiet_no_contribution', 'nda_pending']);
  assert.equal(deriveStatus(visitsButSilent), 'quiet');
});

test('a brand-new account is never quiet', () => {
  const input = base({ account_created_at: daysAgo(3), last_active_at: null, last_contribution_at: null });
  assert.deepEqual(kinds(input), []);
});

test('a blocker in the latest update stays open until a newer update or BLOCKER_OPEN_DAYS', () => {
  const open = deriveSignalItems(base({ last_update: { at: daysAgo(2), mission_id: 'm1', blockers: 'API keys missing' } }));
  assert.deepEqual(open.map(i => i.kind), ['open_blocker']);
  assert.deepEqual(kinds(base({ last_update: { at: daysAgo(2), mission_id: 'm1', blockers: '   ' } })), []);
  // Old blocker, and a blocker on a mission the Cube has left, no longer count.
  assert.ok(!kinds(base({ last_update: { at: daysAgo(20), mission_id: 'm1', blockers: 'x' } })).includes('open_blocker'));
  assert.ok(!kinds(base({ last_update: { at: daysAgo(1), mission_id: 'gone', blockers: 'x' } })).includes('open_blocker'));
});

test('no mission, pending NDA, rejected documents and a due webinar question each ask for action', () => {
  const items = deriveSignalItems(
    base({
      missions: [],
      last_update_by_mission: new Map(),
      nda_status: 'pending',
      rejected_documents: 2,
      webinar_due: { id: 'w1', title: 'Career talk', closes_at: daysAgo(-1), starts_at: daysAgo(-2) }
    })
  );
  assert.deepEqual(items.map(i => i.kind), ['no_mission', 'nda_pending', 'document_rejected', 'webinar_question_due']);
  assert.equal(deriveStatus(items), 'needs_attention');
});
