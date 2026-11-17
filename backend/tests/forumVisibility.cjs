// Runs inside forum.database.cjs's disposable PostgreSQL schema.
module.exports = async ({ db, forum, room, cube, other, staff, adminActor }) => {
  const assert = require('node:assert/strict');
  const body = 'A sufficiently long test body.';
  const members = (await db.forumChatMember.findMany({ where: { room_id: room.id }, select: { user_id: true } })).map(row => row.user_id);
  const author = [cube, adminActor].find(user => members.includes(user.id));
  const roomMate = [cube, adminActor].find(user => user !== author && members.includes(user.id));
  assert.ok(author && roomMate && !members.includes(other.id) && !members.includes(staff.id));
  const missing = e => e.status === 404;

  // Validation
  await assert.rejects(forum.createForumTopic(author, { category_id: 'help', title: 'Bad scope', body, visibility: 'SECRET' }), e => e.status === 400);
  await assert.rejects(forum.createForumTopic(other, { category_id: 'help', title: 'Not my group', body, visibility: 'GROUP', audience_room_id: room.id }), e => e.status === 400);
  await assert.rejects(forum.createForumTopic(author, { category_id: 'help', title: 'Nobody', body, visibility: 'PRIVATE', audience_user_ids: [author.id] }), e => e.status === 400);
  await assert.rejects(forum.createForumTopic(author, { category_id: 'help', title: 'Ghost', body, visibility: 'PRIVATE', audience_user_ids: ['00000000-0000-0000-0000-000000000000'] }), e => e.status === 400);

  // GROUP: members only
  const groupPost = await forum.createForumTopic(author, { category_id: 'help', title: 'Group only post', body: `${body} @user-${other.id}`, visibility: 'GROUP', audience_room_id: room.id });
  const groupRead = await forum.readForumTopic(roomMate, groupPost.id, 1);
  assert.equal(groupRead.topic.visibility, 'GROUP'); assert.equal(groupRead.topic.audience.room.id, room.id);
  assert.ok(!groupRead.topic.audience.room.name.startsWith('enc:'));
  await assert.rejects(forum.readForumTopic(other, groupPost.id, 1), missing);
  await assert.rejects(forum.readForumTopic(staff, groupPost.id, 1), missing); // portal staff get no special access
  assert.equal((await forum.listForumTopics(other, { page: 1 })).topics.some(row => row.id === groupPost.id), false);
  assert.equal((await forum.listForumTopics(other, { query: 'Group only post', page: 1 })).total, 0);
  assert.ok((await forum.listForumTopics(roomMate, { page: 1 })).topics.some(row => row.id === groupPost.id));
  await assert.rejects(forum.createForumReply(other, groupPost.id, { body: 'Sneaky reply' }), missing);
  await assert.rejects(forum.likeForumPost(other, groupPost.id, undefined, { liked: true }), missing);
  await assert.rejects(forum.forumTopicPreview(other, groupPost.id), missing);
  await assert.rejects(forum.forumPostLikers(other, groupPost.id, undefined, 1), missing);
  await assert.rejects(forum.repostForumTopic(roomMate, groupPost.id, { reposted: true }), e => e.status === 400);
  assert.equal(await db.notification.count({ where: { user_id: other.id, forum_target: { is: { topic_id: groupPost.id } } } }), 0); // mention of an outsider is dropped
  const stats = await forum.forumStats();
  assert.equal(stats.unanswered.some(row => row.id === groupPost.id), false);
  const help = (await forum.forumCategories()).find(row => row.id === 'help');
  assert.notEqual(help.topics[0]?.id, groupPost.id);

  // PRIVATE: author plus the chosen people
  const privatePost = await forum.createForumTopic(author, { category_id: 'help', title: 'Private post', body, visibility: 'PRIVATE', audience_user_ids: [other.id, author.id, other.id] });
  const seen = await forum.readForumTopic(other, privatePost.id, 1);
  assert.deepEqual(seen.topic.audience.people.map(person => person.id), [other.id]);
  await assert.rejects(forum.readForumTopic(roomMate, privatePost.id, 1), missing);
  const reply = await forum.createForumReply(other, privatePost.id, { body: `Thanks @user-${roomMate.id}` });
  assert.ok(reply.id);
  assert.equal(await db.notification.count({ where: { user_id: roomMate.id, forum_target: { is: { topic_id: privatePost.id } } } }), 0);
  assert.ok(await db.notification.count({ where: { user_id: author.id, forum_target: { is: { topic_id: privatePost.id } } } }));

  // Changing the audience takes effect at once; reposts disappear when a post stops being public.
  const opened = await forum.createForumTopic(author, { category_id: 'help', title: 'Starts public', body });
  await forum.repostForumTopic(other, opened.id, { reposted: true });
  await forum.changeForumTopic(author, opened.id, { title: 'Now private', body, visibility: 'PRIVATE', audience_user_ids: [roomMate.id] });
  await assert.rejects(forum.readForumTopic(other, opened.id, 1), missing);
  assert.equal(await db.forumTopicRepost.count({ where: { topic_id: opened.id } }), 0);
  await forum.changeForumTopic(author, opened.id, { title: 'Public again', body, visibility: 'PUBLIC' });
  assert.ok((await forum.readForumTopic(other, opened.id, 1)).topic);
  assert.equal(await db.forumTopicAudience.count({ where: { topic_id: opened.id } }), 0);
  console.log('PASS: post visibility (public, group, chosen people) applied to reads, lists, search, stats, replies, likes, previews, reposts, notifications and edits.');
};
