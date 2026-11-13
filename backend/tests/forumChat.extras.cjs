// Runs inside forum.database.cjs's disposable PostgreSQL schema.
module.exports = async ({ db, chat, room, secondRoom, cube, other, adminActor, outsiderAdmin }) => {
  const assert = require('node:assert/strict');
  const fs = require('node:fs/promises');
  const path = require('node:path');
  const files = require('../dist/services/forumChatFiles.service');
  const uploaded = [];
  const upload = async (buffer, originalname = 'test.txt') => {
    const file = await files.uploadChatFile(cube, room.id, { buffer, originalname });
    uploaded.push((await db.forumChatAttachment.findUnique({ where: { id: file.id } })).storage_key);
    return file;
  };
  try {
    const original = await chat.sendChatMessage(cube, room.id, { body: 'Emoji 🚀❤️ and a searchable phrase' });
    const reply = await chat.sendChatMessage(adminActor, room.id, { body: 'Quoted reply', reply_to_id: original.id });
    let messages = (await chat.chatMessages(cube, room.id, 1)).messages;
    assert.equal(messages.find(row => row.id === reply.id).reply_to.body, 'Emoji 🚀❤️ and a searchable phrase');
    const foreign = (await chat.chatMessages(adminActor, secondRoom.id, 1)).messages[0];
    await assert.rejects(chat.sendChatMessage(cube, room.id, { body: 'Cross-room', reply_to_id: foreign.id }), e => e.status === 404);
    await assert.rejects(chat.editChatMessage(adminActor, room.id, original.id, { body: 'Admin overwrite' }), e => e.status === 403);
    await assert.rejects(chat.editChatMessage(other, room.id, original.id, { body: 'Outsider overwrite' }), e => e.status === 404);
    await chat.editChatMessage(cube, room.id, original.id, { body: 'Edited searchable phrase 🚀' });
    const found = await chat.chatMessages(cube, room.id, 1, 'searchable');
    assert.equal(found.total, 1); assert.ok(found.messages[0].edited_at);
    assert.equal((await chat.chatMessages(cube, room.id, 1, 'SecondRoomOnlySentinel')).total, 0);
    await chat.reactToChatMessage(adminActor, room.id, original.id, { emoji: '👍' });
    await chat.reactToChatMessage(adminActor, room.id, original.id, { emoji: '❤️' });
    assert.equal(await db.forumChatReaction.count({ where: { message_id: original.id } }), 1);
    await assert.rejects(chat.reactToChatMessage(other, room.id, original.id, { emoji: '👍' }), e => e.status === 404);
    await assert.rejects(chat.reactToChatMessage(cube, room.id, original.id, { emoji: 'not-an-emoji' }), e => e.status === 400);
    await chat.reactToChatMessage(adminActor, room.id, original.id, { emoji: null });
    assert.equal(await db.forumChatReaction.count({ where: { message_id: original.id } }), 0);
    await chat.chatPresence(adminActor, room.id, { typing: true, read_message_id: original.id });
    assert.deepEqual((await chat.chatRoomDetails(cube, room.id)).typing.map(person => person.id), [adminActor.id]);
    assert.ok((await chat.chatMessages(cube, room.id, 1)).messages.find(row => row.id === original.id).read_by.includes(adminActor.id));
    const readBefore = (await db.forumChatMember.findUnique({ where: { room_id_user_id: { room_id: room.id, user_id: adminActor.id } } })).read_at;
    await chat.chatPresence(adminActor, room.id, { typing: false, read_message_id: (await chat.chatMessages(adminActor, room.id, 2)).messages[0].id });
    const readAfter = (await db.forumChatMember.findUnique({ where: { room_id_user_id: { room_id: room.id, user_id: adminActor.id } } })).read_at;
    assert.deepEqual(readAfter, readBefore); // read cursor never goes backwards
    assert.equal((await chat.chatRoomDetails(cube, room.id)).typing.length, 0);
    await db.forumChatMember.update({ where: { room_id_user_id: { room_id: room.id, user_id: adminActor.id } }, data: { typing_until: new Date(Date.now() - 1) } });
    assert.equal((await chat.chatRoomDetails(cube, room.id)).typing.length, 0);
    await assert.rejects(chat.chatPresence(other, room.id, { typing: true }), e => e.status === 404);
    await assert.rejects(chat.chatPresence(cube, room.id, { typing: false, read_message_id: foreign.id }), e => e.status === 404);
    await assert.rejects(files.uploadChatFile(other, room.id, { buffer: Buffer.from('no'), originalname: 'no.txt' }), e => e.status === 404);
    await assert.rejects(upload(Buffer.alloc(files.CHAT_FILE_MAX_BYTES + 1)), e => e.status === 400);
    const exact = await upload(Buffer.alloc(files.CHAT_FILE_MAX_BYTES), '../boundary.bin');
    assert.equal(exact.byte_size, 10 * 1024 * 1024); assert.equal(exact.original_name, 'boundary.bin');
    assert.equal('storage_key' in exact, false);
    const exactPath = (await files.chatFile(cube, room.id, exact.id)).path;
    assert.equal((await fs.stat(exactPath)).size, files.CHAT_FILE_MAX_BYTES);
    await files.discardChatFile(cube, room.id, exact.id);
    await assert.rejects(fs.stat(exactPath), e => e.code === 'ENOENT');
    const file = await upload(Buffer.from('PrivateAttachmentSentinel'), '..\\private.txt');
    assert.equal(file.original_name, 'private.txt');
    await assert.rejects(files.chatFile(adminActor, room.id, file.id), e => e.status === 404); // staged file is uploader-only
    await assert.rejects(chat.sendChatMessage(adminActor, room.id, { body: '', attachment_ids: [file.id] }), e => e.status === 400);
    const fileMessage = await chat.sendChatMessage(cube, room.id, { body: '', attachment_ids: [file.id], reply_to_id: original.id });
    assert.equal((await chat.chatMessages(cube, room.id, 1)).messages.find(row => row.id === fileMessage.id).attachments[0].id, file.id);
    await assert.rejects(chat.sendChatMessage(cube, room.id, { body: 'Reuse', attachment_ids: [file.id] }), e => e.status === 400);
    await assert.rejects(files.chatFile(cube, secondRoom.id, file.id), e => e.status === 404);
    await assert.rejects(files.chatFile(other, room.id, file.id), e => e.status === 404);
    const jwt = require('jsonwebtoken');
    const server = require('../dist/app').default.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    try {
      const root = 'http://127.0.0.1:' + server.address().port;
      const headers = actor => ({ Authorization: 'Bearer ' + jwt.sign(actor, process.env.JWT_SECRET) });
      for (let tick = 0; tick < 21; tick++) {
        const beat = await fetch(root + '/api/forum/chat/rooms/' + room.id + '/presence', { method: 'PUT', headers: { ...headers(cube), 'Content-Type': 'application/json' }, body: JSON.stringify({ typing: false }) });
        assert.equal(beat.status, 200, 'Typing/read heartbeats have a separate rate limit');
      }
      const afterHeartbeats = await fetch(root + '/api/forum/chat/rooms/' + room.id + '/messages', { method: 'POST', headers: { ...headers(cube), 'Content-Type': 'application/json' }, body: JSON.stringify({ body: 'Presence budget check.' }) });
      assert.equal(afterHeartbeats.status, 201);
      const url = root + '/api/forum/chat/rooms/' + room.id + '/files/' + file.id;
      assert.equal((await fetch(url)).status, 401);
      assert.equal((await fetch(url, { headers: headers(other) })).status, 404);
      assert.equal((await fetch(url, { headers: headers(outsiderAdmin) })).status, 404);
      const download = await fetch(url, { headers: headers(adminActor) });
      assert.equal(download.status, 200); assert.match(download.headers.get('content-disposition'), /^attachment/);
      assert.match(download.headers.get('cache-control'), /no-store/); assert.equal(download.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(await download.text(), 'PrivateAttachmentSentinel');
      const boundaryForm = new FormData(); boundaryForm.append('file', new Blob([Buffer.alloc(files.CHAT_FILE_MAX_BYTES)]), 'exact.bin');
      const boundaryResponse = await fetch(root + '/api/forum/chat/rooms/' + room.id + '/files', { method: 'POST', headers: headers(cube), body: boundaryForm });
      assert.equal(boundaryResponse.status, 201, 'Exactly 10 MB must be accepted by the HTTP upload');
      const boundaryFile = await boundaryResponse.json();
      uploaded.push((await db.forumChatAttachment.findUnique({ where: { id: boundaryFile.id } })).storage_key);
      // The 10 MB limit is enforced by multipart parsing, not just a browser check.
      const form = new FormData(); form.append('file', new Blob([Buffer.alloc(files.CHAT_FILE_MAX_BYTES + 1)]), 'oversize.bin');
      const rejected = await fetch(root + '/api/forum/chat/rooms/' + room.id + '/files', { method: 'POST', headers: headers(cube), body: form });
      assert.equal(rejected.status, 413); assert.match(await rejected.text(), /10 MB/);
      await chat.changeChatMember(adminActor, room.id, cube.id, true);
      assert.equal((await fetch(url, { headers: headers(cube) })).status, 404);
      await chat.changeChatMember(adminActor, room.id, cube.id, false);
      await chat.editChatMessage(cube, room.id, fileMessage.id, {}, true);
      assert.equal((await fetch(url, { headers: headers(cube) })).status, 404);
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await chat.editChatMessage(cube, room.id, original.id, {}, true);
    messages = (await chat.chatMessages(cube, room.id, 1)).messages;
    assert.equal(messages.find(row => row.id === original.id).body, '');
    assert.equal(messages.find(row => row.id === reply.id).reply_to.body, '');
    assert.equal((await chat.chatMessages(cube, room.id, 1, 'searchable')).total, 0);
    await assert.rejects(chat.reactToChatMessage(cube, room.id, original.id, { emoji: '👍' }), e => e.status === 404);
    console.log('PASS: emoji text, replies, owner-only edits/deletion, reaction replacement/removal, read receipts, expiring typing, room-scoped search, private file delivery/revocation and 10 MB service/HTTP boundaries.');
  } finally {
    const { STORAGE_PATH } = require('../dist/config/env');
    for (const key of uploaded) await fs.unlink(path.join(STORAGE_PATH, 'private-chat', key)).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
};
