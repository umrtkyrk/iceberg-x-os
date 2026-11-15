import assert from 'node:assert/strict';
import test from 'node:test';
import prisma from '../src/services/prisma';
import { getTrackingStartedAt, listActivitySummaries } from '../src/services/activity.service';
import {
  activityState,
  countByStatus,
  formatDaysAgo,
  sortActivityRows
} from '../../frontend/src/utils/activityStatus';

const now = new Date('2026-11-20T12:00:00Z');
const daysBefore = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();
const oldTracking = daysBefore(30);

test('status follows the most recent of last seen and last login', () => {
  assert.equal(activityState({ last_seen_at: daysBefore(2) }, now, oldTracking).status, 'active');
  assert.equal(activityState({ last_seen_at: daysBefore(7) }, now, oldTracking).status, 'active');
  assert.equal(activityState({ last_seen_at: daysBefore(8) }, now, oldTracking).status, 'slowing');
  assert.equal(activityState({ last_seen_at: daysBefore(21) }, now, oldTracking).status, 'slowing');
  assert.equal(activityState({ last_seen_at: daysBefore(22) }, now, oldTracking).status, 'inactive');
  assert.equal(activityState({}, now, oldTracking).status, 'never');

  // An old last_seen does not hide a newer login, and the reverse.
  const newerLogin = activityState({ last_seen_at: daysBefore(40), last_login_at: daysBefore(1) }, now, oldTracking);
  assert.equal(newerLogin.status, 'active');
  assert.equal(newerLogin.daysAgo, 1);
  const newerSeen = activityState({ last_seen_at: daysBefore(1), last_login_at: daysBefore(40) }, now, oldTracking);
  assert.equal(newerSeen.daysAgo, 1);
});

test('bad dates are treated as never seen instead of crashing', () => {
  assert.equal(activityState({ last_seen_at: 'not a date' }, now, oldTracking).status, 'never');
});

test('while tracking is new, anything below active is flagged provisional', () => {
  const fresh = daysBefore(2);
  assert.equal(activityState({ last_seen_at: daysBefore(1) }, now, fresh).provisional, false);
  assert.equal(activityState({ last_seen_at: daysBefore(30) }, now, fresh).provisional, true);
  assert.equal(activityState({}, now, fresh).provisional, true);
  // No tracking row at all yet counts as brand new.
  assert.equal(activityState({ last_login_at: daysBefore(30) }, now, null).provisional, true);
  // Once tracking is a week old the statuses are trusted.
  assert.equal(activityState({ last_seen_at: daysBefore(30) }, now, oldTracking).provisional, false);
});

test('rows sort least-recently-seen first, with never-seen at the very top', () => {
  const row = (name: string, seen?: string, days = 0) => ({
    name,
    activeDays: days,
    state: activityState({ last_seen_at: seen }, now, oldTracking)
  });
  const rows = [row('Cem', daysBefore(1), 9), row('Ada', daysBefore(30), 1), row('Bora', undefined, 0), row('Deniz', daysBefore(30), 4)];

  assert.deepEqual(sortActivityRows(rows, 'last_seen').map((r) => r.name), ['Bora', 'Ada', 'Deniz', 'Cem']);
  assert.deepEqual(sortActivityRows(rows, 'active_days').map((r) => r.name), ['Bora', 'Ada', 'Deniz', 'Cem']);
  assert.deepEqual(sortActivityRows(rows, 'name').map((r) => r.name), ['Ada', 'Bora', 'Cem', 'Deniz']);
  // The input array is left alone.
  assert.equal(rows[0].name, 'Cem');
});

test('counts and day labels', () => {
  const states = [
    activityState({ last_seen_at: daysBefore(1) }, now, oldTracking),
    activityState({ last_seen_at: daysBefore(10) }, now, oldTracking),
    activityState({ last_seen_at: daysBefore(40) }, now, oldTracking),
    activityState({}, now, oldTracking),
    activityState({}, now, oldTracking)
  ];
  assert.deepEqual(countByStatus(states), { active: 1, slowing: 1, inactive: 1, never: 2 });
  assert.equal(formatDaysAgo(null), 'Never');
  assert.equal(formatDaysAgo(0), 'Today');
  assert.equal(formatDaysAgo(1), 'Yesterday');
  assert.equal(formatDaysAgo(5), '5 days ago');
});

test('activity summaries cover the last 30 Istanbul days and default missing people to nothing', async () => {
  let where: any;
  const original = prisma.userActivityDay.groupBy;
  prisma.userActivityDay.groupBy = (async (args: any) => {
    where = args.where;
    return [
      { user_id: 'a', _count: { _all: 12 }, _sum: { page_views: 80, active_minutes: 95 } },
      { user_id: 'b', _count: { _all: 1 }, _sum: { page_views: null, active_minutes: null } }
    ];
  }) as any;

  try {
    const map = await listActivitySummaries(new Date('2026-11-20T10:00:00Z'));
    // 30 days including today: Nov 20 back to Oct 22.
    assert.equal(where.day.gte.toISOString(), '2026-10-22T00:00:00.000Z');
    assert.deepEqual(map.get('a'), { active_days: 12, page_views: 80, active_minutes: 95 });
    assert.deepEqual(map.get('b'), { active_days: 1, page_views: 0, active_minutes: 0 });
    assert.equal(map.get('nobody'), undefined);
  } finally {
    prisma.userActivityDay.groupBy = original;
  }
});

test('tracking start is the earliest recorded day, or null before any data', async () => {
  const original = prisma.userActivityDay.aggregate;
  try {
    const started = new Date('2026-11-12T13:30:00Z');
    prisma.userActivityDay.aggregate = (async () => ({ _min: { first_seen_at: started } })) as any;
    assert.equal((await getTrackingStartedAt())?.toISOString(), started.toISOString());

    prisma.userActivityDay.aggregate = (async () => ({ _min: { first_seen_at: null } })) as any;
    assert.equal(await getTrackingStartedAt(), null);
  } finally {
    prisma.userActivityDay.aggregate = original;
  }
});
