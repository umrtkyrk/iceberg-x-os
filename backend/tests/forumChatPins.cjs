// Runs inside forum.database.cjs's disposable PostgreSQL schema.
module.exports = async ({ db, chat, room, cube, other, adminActor }) => {
  const assert = require('node:assert/strict');
  const roleOf = async user => (await db.forumChatMember.findUnique({ where: { room_id_user_id: { room_id: room.id, user_id: user.id } } })).role;
  const admin = (await roleOf(cube)) === 'ADMIN' ? cube : adminActor;
  const member = admin === cube ? adminActor : cube;
  assert.equal(await roleOf(admin), 'ADMIN'); assert.equal(await roleOf(member), 'MEMBER');

  // Pins: group admins only, newest first, at most three, cleared when the message is deleted.
  const ids = [];
  for (const text of ['Pin one', 'Pin two', 'Pin three', 'Pin four']) ids.push((await chat.sendChatMessage(admin, room.id, { body: text })).id);
  await assert.rejects(chat.pinChatMessage(member, room.id, ids[0], { pinned: true }), e => e.status === 403);
  await assert.rejects(chat.pinChatMessage(other, room.id, ids[0], { pinned: true }), e => e.status === 404);
  for (const id of ids) { await chat.pinChatMessage(admin, room.id, id, { pinned: true }); await new Promise(resolve => setTimeout(resolve, 5)); }
  let pinned = (await chat.chatRoomDetails(member, room.id)).pinned;
  assert.deepEqual(pinned.map(row => row.body), ['Pin four', 'Pin three', 'Pin two']);
  await chat.editChatMessage(admin, room.id, ids[3], {}, true);
  await chat.pinChatMessage(admin, room.id, ids[2], { pinned: false });
  pinned = (await chat.chatRoomDetails(member, room.id)).pinned;
  assert.deepEqual(pinned.map(row => row.body), ['Pin two']);
  assert.ok((await chat.chatMessages(member, room.id, 1)).messages.find(row => row.id === ids[1]).pinned_at);

  // Repositories: up to five, de-duplicated, stored encrypted; only listed ones can be fetched.
  const saved = await chat.setChatRepo(member, room.id, { repos: ['team/app', 'https://github.com/team/api', 'team/app'] });
  assert.deepEqual(saved.github_repos, ['team/app', 'team/api']);
  assert.match((await db.forumChatRoom.findUnique({ where: { id: room.id } })).github_repo, /^enc:v1:/);
  assert.deepEqual((await chat.chatRoomDetails(member, room.id)).github_repos, ['team/app', 'team/api']);
  await assert.rejects(chat.setChatRepo(member, room.id, { repos: ['a/1', 'a/2', 'a/3', 'a/4', 'a/5', 'a/6'] }), e => e.status === 400);
  await assert.rejects(chat.chatGithub(member, room.id, 'someone/else'), e => e.status === 404);
  await chat.setChatRepo(member, room.id, { repos: [] });
  assert.equal((await chat.chatRoomDetails(member, room.id)).github_repo, null);
  console.log('PASS: group admins pin up to three messages; rooms keep up to five encrypted repositories and fetch only their own.');
};
