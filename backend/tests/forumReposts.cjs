// Runs inside forum.database.cjs's disposable PostgreSQL schema.
module.exports = async ({ db, forum, cube, other, staff }) => {
  const assert = require('node:assert/strict');
  const topic = await forum.createForumTopic(cube, { category_id: 'help', title: 'Worth sharing', body: 'Intro text ![shot](/uploads/forum/a.png) and [a link](https://example.com) **bold**.' });
  await assert.rejects(forum.repostForumTopic(cube, topic.id, { reposted: true }), e => e.status === 400);
  await assert.rejects(forum.repostForumTopic(other, topic.id, {}), e => e.status === 400);
  assert.deepEqual(await forum.repostForumTopic(other, topic.id, { reposted: true }), { reposted: true, repost_count: 1 });
  await forum.repostForumTopic(other, topic.id, { reposted: true }); // idempotent
  await forum.repostForumTopic(staff, topic.id, { reposted: true });
  const note = () => db.notification.findMany({ where: { user_id: cube.id, read_at: null, message: { contains: 'reposted your post' } } });
  assert.equal((await note()).length, 1);
  const read = (await forum.readForumTopic(other, topic.id, 1)).topic;
  assert.equal(read.reposted, true); assert.equal(read.repost_count, 2); assert.equal(read.reposted_by.length, 2);
  const listed = (await forum.listForumTopics(cube, { page: 1 })).topics.find(row => row.id === topic.id);
  assert.equal(listed.reposted, false); assert.equal(listed.repost_count, 2);
  await forum.repostForumTopic(other, topic.id, { reposted: false });
  await forum.repostForumTopic(staff, topic.id, { reposted: false });
  assert.equal((await note()).length, 0);

  const preview = await forum.forumTopicPreview(cube, topic.id);
  assert.equal(preview.image, '/uploads/forum/a.png'); assert.equal(preview.title, 'Worth sharing');
  assert.equal(preview.snippet, 'Intro text and a link bold .');
  assert.doesNotMatch(JSON.stringify(preview), /email|password_hash/);
  const tracker = await forum.createForumTopic(cube, { category_id: 'help', title: 'Tracker', body: 'x ![p](//evil.example/p.png)' });
  assert.equal((await forum.forumTopicPreview(cube, tracker.id)).image, null);
  await forum.changeForumTopic(cube, topic.id, {}, true);
  await assert.rejects(forum.forumTopicPreview(cube, topic.id), e => e.status === 404);
  console.log('PASS: reposts (self-repost refused, idempotent, notification kept in step) and safe topic link previews.');
};
