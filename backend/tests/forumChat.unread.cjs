module.exports = async ({ db, chat, outsiderAdmin }) => {
  const assert = require('node:assert/strict');
  const { randomUUID } = require('node:crypto');
  const reader = { id: randomUUID(), role: 'MENTOR' }, sender = { id: randomUUID(), role: 'ADMIN' };
  for (const actor of [reader, sender]) await db.user.create({ data: { ...actor, name: 'Unread test', email: actor.id + '@example.invalid', password_hash: 'unusable-test-only' } });
  const a = await chat.createChatRoom(sender, { name: 'Unread A', member_ids: [reader.id] });
  const b = await chat.createChatRoom(sender, { name: 'Unread B', member_ids: [reader.id] });
  assert.equal((await chat.chatUnread(reader)).total, 0);
  const stamp = new Date(Date.now() - 10000), prefix = randomUUID().slice(0, -1);
  const first = await db.forumChatMessage.create({ data: { id: prefix + 'a', room_id: a.id, author_id: sender.id, body: 'First', created_at: stamp } });
  const second = await db.forumChatMessage.create({ data: { id: prefix + 'b', room_id: a.id, author_id: sender.id, body: 'Second', created_at: stamp } });
  await db.forumChatMessage.create({ data: { room_id: a.id, author_id: reader.id, body: 'My own message', created_at: stamp } });
  await db.forumChatMessage.create({ data: { room_id: a.id, author_id: sender.id, body: '', deleted_at: stamp, created_at: stamp } });
  const otherRoomMessage = await chat.sendChatMessage(sender, b.id, { body: 'Different room' });
  let unread = await chat.chatUnread(reader);
  assert.equal(unread.total, 3);
  assert.equal(unread.rooms.find(row => row.id === a.id).count, 2);
  assert.equal(unread.rooms.find(row => row.id === b.id).count, 1);
  assert.equal((await chat.chatUnread(sender)).total, 1); // only the reader's own message
  assert.equal((await chat.chatUnread(outsiderAdmin)).total, 0); // admin management is not membership
  await chat.chatMessages(reader, a.id, 1); // loading data alone is not a read acknowledgement
  assert.equal((await chat.chatUnread(reader)).total, 3);
  await chat.chatPresence(reader, a.id, { typing: false, read_message_id: first.id });
  assert.equal((await chat.chatUnread(reader)).total, 2);
  const partial = (await chat.chatMessages(sender, a.id, 1)).messages;
  assert.ok(partial.find(row => row.id === first.id).read_by.includes(reader.id));
  assert.equal(partial.find(row => row.id === second.id).read_by.includes(reader.id), false);
  await chat.chatPresence(reader, a.id, { typing: false, read_message_id: second.id });
  unread = await chat.chatUnread(reader);
  assert.equal(unread.total, 1); assert.equal(unread.rooms.some(row => row.id === a.id), false);
  await chat.chatPresence(reader, a.id, { typing: false, read_message_id: first.id });
  assert.equal((await chat.chatUnread(reader)).total, 1); // an older acknowledgement cannot restore a badge
  const fileOnly = await db.forumChatMessage.create({ data: { room_id: a.id, author_id: sender.id, body: '' } });
  assert.equal((await chat.chatUnread(reader)).total, 2); // attachment-only bodies count too
  await chat.chatPresence(reader, a.id, { typing: false, read_message_id: fileOnly.id });
  await chat.editChatMessage(sender, b.id, otherRoomMessage.id, {}, true);
  assert.deepEqual(await chat.chatUnread(reader), { total: 0, rooms: [] });
  await chat.sendChatMessage(sender, b.id, { body: 'New unread after clearing' });
  assert.equal((await chat.chatUnread(reader)).total, 1);
  const server = require('../dist/app').default.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const jwt = require('jsonwebtoken');
    const url = 'http://127.0.0.1:' + server.address().port + '/api/forum/chat/unread';
    assert.equal((await fetch(url)).status, 401);
    const response = await fetch(url, { headers: { Authorization: 'Bearer ' + jwt.sign(reader, process.env.JWT_SECRET) } });
    assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal((await response.json()).total, 1);
    const denied = await fetch(url + '?user_id=' + reader.id, { headers: { Authorization: 'Bearer ' + jwt.sign(outsiderAdmin, process.env.JWT_SECRET) } });
    assert.deepEqual(await denied.json(), { total: 0, rooms: [] });
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  await chat.changeChatMember(sender, b.id, reader.id, true);
  assert.deepEqual(await chat.chatUnread(reader), { total: 0, rooms: [] });
  console.log('PASS: unread totals/per-room counts, own/deleted message exclusion, attachment-only messages, exact timestamp ties, monotonic read cursors, authenticated private counts and membership revocation.');
};
