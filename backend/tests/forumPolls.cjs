// Runs inside forum.database.cjs's disposable PostgreSQL schema.
module.exports = async ({ db, forum, chat, room, cube, other, staff, adminActor }) => {
  const assert = require('node:assert/strict');
  const poll = { question: 'Which day suits the demo?', options: ['Monday', 'Tuesday', ''], allow_multiple: false };

  // Validation: two distinct options at least, no more than twelve.
  await assert.rejects(forum.createForumTopic(cube, { category_id: 'help', title: 'Poll test', body: 'A sufficiently long test body.', poll: { question: 'Q?', options: ['Only one'] } }), e => e.status === 400);
  await assert.rejects(forum.createForumTopic(cube, { category_id: 'help', title: 'Poll test', body: 'A sufficiently long test body.', poll: { question: 'Q?', options: ['Same', 'same'] } }), e => e.status === 400);
  await assert.rejects(forum.createForumTopic(cube, { category_id: 'help', title: 'Poll test', body: 'A sufficiently long test body.', poll: { question: 'Q?', options: Array.from({ length: 13 }, (_, i) => `Option ${i}`) } }), e => e.status === 400);

  // Topic poll: single answer, revote replaces, empty choice withdraws, foreign option rejected.
  const topic = await forum.createForumTopic(cube, { category_id: 'help', title: 'Demo day poll', body: 'A sufficiently long test body.', poll });
  let read = (await forum.readForumTopic(other, topic.id, 1)).topic.poll;
  assert.equal(read.question, poll.question); assert.deepEqual(read.options.map(option => option.text), ['Monday', 'Tuesday']);
  const [monday, tuesday] = read.options.map(option => option.id);
  await assert.rejects(forum.voteForumPoll(other, topic.id, { option_ids: [monday, tuesday] }), e => e.status === 400);
  await forum.voteForumPoll(other, topic.id, { option_ids: [monday] });
  read = await forum.voteForumPoll(other, topic.id, { option_ids: [tuesday] });
  assert.deepEqual(read.options.map(option => option.votes), [0, 1]); assert.equal(read.options[1].voted, true);
  await forum.voteForumPoll(staff, topic.id, { option_ids: [tuesday] });
  read = (await forum.readForumTopic(cube, topic.id, 1)).topic.poll;
  assert.equal(read.total_voters, 2); assert.equal(read.options[1].voted, false);
  assert.doesNotMatch(JSON.stringify(read), /password_hash|@example/);
  await forum.voteForumPoll(other, topic.id, { option_ids: [] });
  assert.equal(await db.forumPollVote.count({ where: { user_id: other.id } }), 0);
  const listed = (await forum.listForumTopics(cube, { page: 1 })).topics.find(row => row.id === topic.id);
  assert.equal(listed.has_poll, true);
  const plainTopic = await forum.createForumTopic(cube, { category_id: 'help', title: 'No poll here', body: 'A sufficiently long test body.' });
  await assert.rejects(forum.voteForumPoll(cube, plainTopic.id, { option_ids: [] }), e => e.status === 404);
  await forum.moderateForumTopic(staff, topic.id, { locked: true, pinned: false });
  await assert.rejects(forum.voteForumPoll(other, topic.id, { option_ids: [monday] }), e => e.status === 403);

  // Comment poll: the comment may be just the poll; votes, deletion and locking follow the comment.
  const host = await forum.createForumTopic(cube, { category_id: 'help', title: 'Comment poll host', body: 'A sufficiently long test body.' });
  await assert.rejects(forum.createForumReply(other, host.id, { body: '' }), e => e.status === 400);
  const pollReply = await forum.createForumReply(other, host.id, { body: '', poll: { question: 'Tabs or spaces?', options: ['Tabs', 'Spaces'] } });
  let comment = (await forum.readForumTopic(cube, host.id, 1)).replies.find(row => row.id === pollReply.id);
  assert.equal(comment.body, ''); assert.equal(comment.poll.question, 'Tabs or spaces?');
  const [tabs] = comment.poll.options.map(option => option.id);
  const afterVote = await forum.voteForumReplyPoll(cube, host.id, pollReply.id, { option_ids: [tabs] });
  assert.equal(afterVote.options[0].votes, 1);
  await assert.rejects(forum.voteForumReplyPoll(cube, host.id, 'missing', { option_ids: [] }), e => e.status === 404);
  await forum.changeForumReply(other, host.id, pollReply.id, { body: 'Added context later' });
  await forum.changeForumReply(other, host.id, pollReply.id, { body: '' });
  await forum.changeForumReply(other, host.id, pollReply.id, {}, true);
  comment = (await forum.readForumTopic(cube, host.id, 1)).replies.find(row => row.id === pollReply.id);
  assert.equal(comment, undefined);

  // Anonymous poll: totals and the viewer's own choice, never who voted.
  const secret = await forum.createForumTopic(cube, { category_id: 'help', title: 'Anonymous poll', body: 'A sufficiently long test body.', poll: { question: 'Honest feedback?', options: ['Good', 'Bad'], hide_voters: true } });
  const secretPoll = (await forum.readForumTopic(staff, secret.id, 1)).topic.poll;
  await forum.voteForumPoll(staff, secret.id, { option_ids: [secretPoll.options[1].id] });
  const seenByOther = (await forum.readForumTopic(cube, secret.id, 1)).topic.poll;
  assert.equal(seenByOther.hide_voters, true); assert.equal(seenByOther.total_voters, 1); assert.equal(seenByOther.options[1].votes, 1);
  assert.ok(seenByOther.options.every(option => option.voters.length === 0 && !option.voted));
  assert.doesNotMatch(JSON.stringify(seenByOther), new RegExp(staff.id));
  assert.equal((await forum.readForumTopic(staff, secret.id, 1)).topic.poll.options[1].voted, true);

  // Chat poll: encrypted at rest, multiple answers, members only, not editable, removed with the message.
  const sent = await chat.sendChatMessage(cube, room.id, { poll: { question: 'Pizza toppings?', options: ['Cheese', 'Olives', 'Basil'], allow_multiple: true } });
  const stored = await db.forumPoll.findUnique({ where: { message_id: sent.id }, include: { options: true } });
  assert.match(stored.question, /^enc:v1:/); assert.ok(stored.options.every(option => option.text.startsWith('enc:v1:')));
  let message = (await chat.chatMessages(adminActor, room.id, 1)).messages.find(row => row.id === sent.id);
  assert.equal(message.poll.question, 'Pizza toppings?'); assert.equal(message.body, '');
  const ids = message.poll.options.map(option => option.id);
  const voted = await chat.voteChatPoll(adminActor, room.id, sent.id, { option_ids: [ids[0], ids[2]] });
  assert.deepEqual(voted.options.map(option => option.votes), [1, 0, 1]);
  await assert.rejects(chat.voteChatPoll(other, room.id, sent.id, { option_ids: [ids[0]] }), e => e.status === 404);
  await assert.rejects(chat.voteChatPoll(adminActor, room.id, sent.id, { option_ids: [monday] }), e => e.status === 400);
  await assert.rejects(chat.editChatMessage(cube, room.id, sent.id, { body: 'Changed' }), e => e.status === 400);
  assert.match((await chat.listChatRooms(cube, 1)).rooms.find(row => row.id === room.id).last_message.body, /Pizza toppings/);
  assert.equal((await chat.chatMessages(cube, room.id, 1, 'toppings')).total, 1);
  await assert.rejects(chat.sendChatMessage(cube, room.id, { poll: { question: 'Q?', options: ['A', 'B'] }, attachment_ids: ['x'] }), e => e.status === 400);
  await chat.editChatMessage(cube, room.id, sent.id, {}, true);
  assert.equal(await db.forumPoll.count({ where: { message_id: sent.id } }), 0);
  assert.equal((await chat.chatMessages(cube, room.id, 1)).messages.find(row => row.id === sent.id).poll, null);
  console.log('PASS: topic and chat polls: validation, single/multiple answers, revoting, withdrawal, locking, encryption, membership and deletion.');
};
