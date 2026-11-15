import assert from 'node:assert/strict';
import test from 'node:test';
import prisma from '../src/services/prisma';
import {
  istanbulDay,
  normalizeActivityPath,
  recordActivity
} from '../src/services/activity.service';

test('paths are reduced to a route shape with no ids, queries or tokens', () => {
  assert.equal(normalizeActivityPath('/missions'), '/missions');
  assert.equal(
    normalizeActivityPath('/missions/3f2b8c1e-1d4a-4c5e-9a77-0b1c2d3e4f50?tab=updates#top'),
    '/missions/:id'
  );
  assert.equal(normalizeActivityPath('/cubes/042'), '/cubes/:id');
  assert.equal(normalizeActivityPath('/Forum/Topic/abcdef0123456789abcdef'), '/forum/topic/:id');
  assert.equal(normalizeActivityPath('/accept-invite/some token with spaces'), '/accept-invite/:x');
  assert.equal(normalizeActivityPath('/' + 'z'.repeat(60)), '/:x');
});

test('anything that is not a plain in-app path is rejected', () => {
  assert.equal(normalizeActivityPath(undefined), null);
  assert.equal(normalizeActivityPath(42), null);
  assert.equal(normalizeActivityPath('missions'), null);
  assert.equal(normalizeActivityPath('//evil.example/path'), null);
  assert.equal(normalizeActivityPath('https://evil.example/'), null);
});

test('the activity day follows Istanbul time, not UTC', () => {
  // 21:30 UTC on the 1st is already 00:30 on the 2nd in Istanbul (UTC+3).
  assert.equal(istanbulDay(new Date('2026-11-01T21:30:00Z')).toISOString(), '2026-11-02T00:00:00.000Z');
  assert.equal(istanbulDay(new Date('2026-11-01T20:30:00Z')).toISOString(), '2026-11-01T00:00:00.000Z');
});

test('views and heartbeats roll up into one row and respect their minimum gaps', async () => {
  const upserts: any[] = [];
  const userUpdates: any[] = [];
  const originalUpsert = prisma.userActivityDay.upsert;
  const originalUpdate = prisma.user.update;
  prisma.userActivityDay.upsert = (async (args: any) => {
    upserts.push(args);
    return {};
  }) as any;
  prisma.user.update = (async (args: any) => {
    userUpdates.push(args);
    return {};
  }) as any;

  try {
    const t0 = new Date('2026-11-12T10:00:00Z');
    const at = (ms: number) => new Date(t0.getTime() + ms);

    assert.equal(await recordActivity('u-1', 'view', '/missions', at(0)), true);
    // A double fire a moment later is dropped.
    assert.equal(await recordActivity('u-1', 'view', '/missions', at(500)), false);
    assert.equal(await recordActivity('u-1', 'view', '/webinars', at(5_000)), true);

    assert.equal(await recordActivity('u-1', 'heartbeat', '/webinars', at(6_000)), true);
    // A second heartbeat inside 50 seconds would inflate the active minutes.
    assert.equal(await recordActivity('u-1', 'heartbeat', '/webinars', at(30_000)), false);
    assert.equal(await recordActivity('u-1', 'heartbeat', '/webinars', at(70_000)), true);

    // Another person is throttled independently.
    assert.equal(await recordActivity('u-2', 'heartbeat', '/webinars', at(30_000)), true);

    // A bad path writes nothing.
    assert.equal(await recordActivity('u-1', 'view', 'https://evil.example', at(200_000)), false);

    assert.equal(upserts.length, 5);
    assert.equal(userUpdates.length, 5);

    const first = upserts[0];
    assert.deepEqual(first.where, {
      user_id_day: { user_id: 'u-1', day: new Date('2026-11-12T00:00:00.000Z') }
    });
    assert.equal(first.create.page_views, 1);
    assert.equal(first.create.active_minutes, 0);
    assert.deepEqual(first.update.page_views, { increment: 1 });
    assert.deepEqual(first.update.active_minutes, { increment: 0 });
    assert.equal(first.update.last_path, '/missions');

    const heartbeat = upserts[2];
    assert.equal(heartbeat.create.active_minutes, 1);
    assert.deepEqual(heartbeat.update.active_minutes, { increment: 1 });
    assert.deepEqual(heartbeat.update.page_views, { increment: 0 });

    assert.deepEqual(userUpdates[0], { where: { id: 'u-1' }, data: { last_seen_at: at(0) } });
  } finally {
    prisma.userActivityDay.upsert = originalUpsert;
    prisma.user.update = originalUpdate;
  }
});
