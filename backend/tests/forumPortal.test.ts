import assert from 'node:assert/strict';
import test from 'node:test';
import { forumStage, publicForumAuthor, validateForumPreferences, assertForumPosting } from '../src/services/forumIdentity.service';
import { forumMentionHandles } from '../src/services/forumNotifications.service';
import { manageForumCategory } from '../src/services/forumCategory.service';
import prisma from '../src/services/prisma';
import { HttpError } from '../src/utils/http';
const status = (value: number) => (error: unknown) => error instanceof HttpError && error.status === value;

test('showcase rejects foreign, duplicate and fourth badges, accepts zero, preserves selected order', () => {
  assert.deepEqual(validateForumPreferences({ signature: ' hello ', badge_ids: ['b', 'a'] }, ['a', 'b']), { signature: 'hello', badge_ids: ['b', 'a'] });
  assert.deepEqual(validateForumPreferences({ signature: '', badge_ids: [] }, []), { signature: '', badge_ids: [] });
  for (const ids of [['a', 'a'], ['foreign'], ['a', 'b', 'c', 'd'], [null]]) assert.throws(() => validateForumPreferences({ signature: '', badge_ids: ids }, ['a', 'b', 'c', 'd']), status(400));
  assert.throws(() => validateForumPreferences({ signature: 'x'.repeat(141), badge_ids: [] }, []), status(400));
  assert.throws(() => validateForumPreferences({ signature: {}, badge_ids: [] }, []), status(400));
});

test('author projection has no private profile data and hides a revoked showcase badge', () => {
  const user: any = { id: 'u', name: 'Cube', role: 'CUBE', email: 'private', password_hash: 'private', forum_profile: { signature: 'Hello', badge_ids: ['revoked', 'b'] }, cube_profile: {
    id: 'p', cube_number: '018', current_level: 'Cube', is_senior_candidate: true, is_founding_cube: true, nda_status: 'private', phone_number: 'private', cube_badges: [{ badge: { id: 'b', name: 'Badge', rarity: 'Rare', icon: 'Award' } }],
  } };
  const projected = publicForumAuthor(user)!;
  assert.equal(projected.stage, 'candidate'); assert.equal(projected.founding, true);
  assert.deepEqual(projected.badges.map(b => b.id), ['b']);
  assert.doesNotMatch(JSON.stringify(projected), /private|nda_status|password_hash|phone_number|email/);
  assert.equal(forumStage('Iceberger', false, 'CUBE'), 'iceberger');
  assert.equal(forumStage('Iceberger', false, 'MENTOR'), 'mentor');
  assert.equal(forumStage('Senior_Cube', true), 'senior');
  assert.equal(forumStage('Alumni', true), 'alumni');
});

test('mentions use stable handles and ignore code, quotations, unknown syntax and repeated recipients', () => {
  assert.deepEqual(forumMentionHandles('Hi @cube-018 @cube-018\n> @cube-019\n`@cube-020`\n```js\n@cube-021\n```\n@someone @cube-022extra'), ['cube-018']);
  assert.equal(forumMentionHandles(Array.from({ length: 15 }, (_, i) => `@cube-${i}`).join(' ')).length, 10);
  assert.deepEqual(forumMentionHandles('~~~js\n@cube-030\n~~~\n````\n```\n@cube-031\n````\n``@cube-032``\n    @cube-033\n@cube-034'), ['cube-034']);
});

test('posting policy permits staff and Icebergers, but exited Cubes and missing profiles are read-only', async () => {
  const original = prisma.cubeProfile.findUnique;
  let level: string | null = 'Iceberger';
  prisma.cubeProfile.findUnique = (async () => level ? { current_level: level } : null) as any;
  try {
    await assertForumPosting({ id: 'u', role: 'CUBE' });
    for (level of ['Alumni', 'Former_Cube', null]) await assert.rejects(assertForumPosting({ id: 'u', role: 'CUBE' }), status(403));
    await assertForumPosting({ id: 'u', role: 'MENTOR' });
  } finally { prisma.cubeProfile.findUnique = original; }
});

test('Mentors and Cubes cannot create, edit or delete categories', async () => {
  for (const role of ['MENTOR', 'CUBE'] as const) {
    await assert.rejects(manageForumCategory({ id: 'u', role }, undefined, {}), status(403));
    await assert.rejects(manageForumCategory({ id: 'u', role }, 'help', {}, true), status(403));
  }
});
