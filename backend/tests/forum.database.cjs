// Isolated PostgreSQL integration test. Never changes the application's public schema.
require('dotenv').config();
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

async function main() {
  const url = new URL(process.env.DATABASE_URL || '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Integration tests require localhost.');
  const schema = `forum_test_${randomUUID().replaceAll('-', '')}`;
  if (!/^forum_test_[a-f0-9]{32}$/.test(schema)) throw new Error('Invalid test schema');
  const admin = new PrismaClient();
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'iceberg-forum-test-'));
  url.searchParams.set('schema', schema);
  process.env.DATABASE_URL = url.toString();
  process.env.DIRECT_URL = url.toString();
  const run = args => {
    const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), ...args], { encoding: 'utf8', env: process.env });
    if (result.status !== 0) throw new Error(`Prisma ${args[0]} failed: ${result.stderr.replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted]')}`);
    return result.stdout;
  };
  let db;
  let createdSchema = false;
  try {
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    createdSchema = true;
    const current = fs.readFileSync(path.join(__dirname, '../prisma/schema.prisma'), 'utf8');
    const baseline = current.split('model ForumCategory')[0].replace(/^  forum_\w+ .+\r?\n/gm, '');
    const baselineFile = path.join(temp, 'baseline.prisma');
    fs.writeFileSync(baselineFile, baseline);
    const baselineSQL = run(['migrate', 'diff', '--from-empty', '--to-schema-datamodel', baselineFile, '--script']);
    const baselineSQLFile = path.join(temp, 'baseline.sql');
    fs.writeFileSync(baselineSQLFile, baselineSQL);
    run(['db', 'execute', '--file', baselineSQLFile, '--schema', baselineFile]);
    run(['db', 'execute', '--file', path.join(__dirname, '../prisma/migrations/20261028120000_add_forum/migration.sql'), '--schema', baselineFile]);
    run(['db', 'execute', '--file', path.join(__dirname, '../prisma/migrations/20261029120000_english_forum_categories/migration.sql'), '--schema', baselineFile]);
    run(['db', 'execute', '--file', path.join(__dirname, '../prisma/migrations/20261029120000_forum_portal_integration/migration.sql'), '--schema', baselineFile]);
    run(['db', 'execute', '--file', path.join(__dirname, '../prisma/migrations/20261106120000_english_ideas_category/migration.sql'), '--schema', baselineFile]);
    run(['db', 'execute', '--file', path.join(__dirname, '../prisma/migrations/20261109180000_forum_default_categories/migration.sql'), '--schema', baselineFile]);
    run(['db', 'execute', '--file', path.join(__dirname, '../prisma/migrations/20261111120000_forum_likes/migration.sql'), '--schema', baselineFile]);
    run(['db', 'execute', '--file', path.join(__dirname, '../prisma/migrations/20261113120000_forum_private_chat/migration.sql'), '--schema', baselineFile]);
    run(['db', 'execute', '--file', path.join(__dirname, '../prisma/migrations/20261113160000_forum_chat_extras/migration.sql'), '--schema', baselineFile]);
    db = require('../dist/services/prisma').default;
    const forum = require('../dist/services/forum.service');
    const staff = { id: randomUUID(), role: 'MENTOR' }, cube = { id: randomUUID(), role: 'CUBE' }, other = { id: randomUUID(), role: 'CUBE' };
    for (const user of [staff, cube, other]) await db.user.create({ data: { ...user, name: 'Integration test', email: `${user.id}@example.invalid`, password_hash: 'unusable-test-only' } });
    assert.equal(await db.user.count(), 3);
    for (const [index, user] of [cube, other].entries()) await db.cubeProfile.create({ data: { user_id: user.id, cube_number: String(101 + index), cohort: 'QA', university: 'QA', department: 'QA' } });
    const cubeProfile = await db.cubeProfile.findUnique({ where: { user_id: cube.id } });
    const otherProfile = await db.cubeProfile.findUnique({ where: { user_id: other.id } });
    const identity = require('../dist/services/forumIdentity.service');
    const categories = require('../dist/services/forumCategory.service');
    const portalContext = require('../dist/services/forumContext.service');
    const badges = [];
    for (let i = 0; i < 4; i++) { const badge = await db.badge.create({ data: { name: 'Badge ' + i, description: 'QA', icon: 'Award' } }); badges.push(badge); await db.cubeBadge.create({ data: { cube_id: i === 3 ? otherProfile.id : cubeProfile.id, badge_id: badge.id, awarded_by_id: staff.id, reason: 'QA' } }); }
    await identity.saveForumProfile(cube, { signature: 'Stored signature', badge_ids: [badges[1].id, badges[0].id] });
    await assert.rejects(identity.saveForumProfile(cube, { signature: '', badge_ids: badges.map(b => b.id) }), e => e.status === 400);
    await assert.rejects(identity.saveForumProfile(cube, { signature: '', badge_ids: [badges[3].id] }), e => e.status === 400);
    await assert.rejects(identity.saveForumProfile(cube, { signature: '', badge_ids: [badges[0].id, badges[0].id] }), e => e.status === 400);
    assert.deepEqual((await identity.forumViewer(cube)).badge_ids, [badges[1].id, badges[0].id]);
    const quest = await db.quest.create({ data: { title: 'QA quest', description: 'QA', criteria_type: 'custom', criteria_value: 3 } });
    await db.cubeQuest.create({ data: { cube_id: cubeProfile.id, quest_id: quest.id } });
    assert.equal((await portalContext.forumContext(cube)).quests.length, 1);
    const mission = await db.mission.create({ data: { title: 'QA mission', description: 'QA', context: 'QA', problem_statement: 'QA', expected_output: 'QA', difficulty_level: 'Level_4_Integration_Candidate', created_by_id: staff.id } });
    await db.missionContributor.create({ data: { mission_id: mission.id, cube_id: cubeProfile.id } });
    assert.equal((await portalContext.forumContext(cube)).missions[0].id, mission.id);
    await assert.rejects(forum.createForumTopic(other, { category_id: 'help', title: 'A mission I cannot attach', body: 'A sufficiently long test body.', mission_id: mission.id }), e => e.status === 403);
    await assert.rejects(forum.createForumTopic(other, { category_id: 'help', title: 'A quest I do not have', body: 'A sufficiently long test body.', quest_id: quest.id }), e => e.status === 403);
    await assert.rejects(categories.manageForumCategory(staff, undefined, {}), e => e.status === 403);
    await categories.manageForumCategory({ ...staff, role: 'ADMIN' }, undefined, { id: 'qa-category', name: 'QA category', description: 'Temporary category', position: 20, staff_only: false });
    await categories.manageForumCategory({ ...staff, role: 'ADMIN' }, 'qa-category', {}, true);
    assert.equal((await forum.forumCategories()).length, 7);
    await assert.rejects(forum.createForumTopic(cube, { category_id: 'announcements', title: 'Test title', body: 'A sufficiently long test body.' }), e => e.status === 403);
    const topic = await forum.createForumTopic(cube, { category_id: 'help', title: 'A real persistence test', body: 'A sufficiently long original post.', quest_id: quest.id, mission_id: mission.id });
    assert.equal(await require('../dist/services/forumQuests.service').forumQuestValue(cube.id, 'forum_topics'), 1);
    const projected = (await forum.readForumTopic(staff, topic.id, 1)).topic;
    assert.equal(projected.context.quest.id, quest.id);
    assert.equal(projected.context.mission.id, mission.id);
    assert.equal(projected.edited, false);
    assert.equal(projected.author.signature, 'Stored signature');
    assert.deepEqual(projected.author.badges.map(b => b.id), [badges[1].id, badges[0].id]);
    assert.equal((await db.cubeQuest.findFirst({ where: { cube_id: cubeProfile.id, quest_id: quest.id } })).current_value, 0);
    await forum.setForumState(staff, topic.id, { following: true, saved: true });
    const reply = await forum.createForumReply(other, topic.id, { body: 'A helpful reply.' });
    assert.equal(await db.notification.count({ where: { user_id: staff.id } }), 1);
    assert.equal((await forum.readForumTopic(staff, topic.id, 1)).replies.length, 1);
    assert.deepEqual(await forum.likeForumPost(other, topic.id, undefined, { liked: true }), { liked: true, like_count: 1 });
    assert.deepEqual(await forum.likeForumPost(other, topic.id, undefined, { liked: true }), { liked: true, like_count: 1 }); // idempotent
    await forum.likeForumPost(staff, topic.id, reply.id, { liked: true });
    const likeNotes = userId => db.notification.findMany({ where: { user_id: userId, message: { contains: 'liked your' } }, include: { forum_target: true } });
    // Liking notifies the author once per post or comment; the liker's own likes never notify them.
    assert.deepEqual((await likeNotes(cube.id)).map(n => [n.message, n.forum_target.reply_id]), [['Integration test liked your post “A real persistence test”.', null]]);
    assert.deepEqual((await likeNotes(other.id)).map(n => [n.message, n.forum_target.reply_id]), [['Integration test liked your comment on “A real persistence test”.', reply.id]]);
    await forum.likeForumPost(cube, topic.id, undefined, { liked: true });
    assert.equal((await likeNotes(cube.id)).length, 1);
    await forum.likeForumPost(cube, topic.id, undefined, { liked: false });
    const liked = await forum.readForumTopic(other, topic.id, 1);
    assert.equal(liked.topic.liked, true); assert.equal(liked.topic.like_count, 1);
    assert.equal(liked.replies[0].liked, false); assert.equal(liked.replies[0].like_count, 1);
    assert.equal((await forum.listForumTopics(other, { page: 1 })).topics.find(t => t.id === topic.id).like_count, 1);
    assert.deepEqual(await forum.likeForumPost(other, topic.id, undefined, { liked: false }), { liked: false, like_count: 0 });
    // Taking back the only like removes the unread notification.
    assert.equal((await likeNotes(cube.id)).length, 0);
    await assert.rejects(forum.likeForumPost(other, topic.id, undefined, { liked: 'yes' }), e => e.status === 400);
    await assert.rejects(forum.likeForumPost(other, topic.id, 'missing-reply', { liked: true }), e => e.status === 404);
    const beforeMention = await db.notification.count();
    const mentioned = await forum.createForumReply(other, topic.id, { body: '@cube-101 and @user-' + staff.id + ' thanks!' });
    // Owner/follower/mention deduplicate; the owner's unread comment notification is updated, not duplicated.
    assert.equal(await db.notification.count(), beforeMention + 1);
    assert.equal(await db.forumNotificationTarget.count({ where: { reply_id: mentioned.id } }), 2);
    await forum.changeForumReply(other, topic.id, mentioned.id, {}, true);
    for (let i = 0; i < 21; i++) await db.forumReply.create({ data: { topic_id: topic.id, author_id: other.id, body: 'Page test ' + i, created_at: new Date(Date.now() + 1000 + i) } });
    const lastReply = await db.forumReply.findFirst({ where: { topic_id: topic.id }, orderBy: { created_at: 'desc' } });
    assert.equal((await forum.readForumTopic(staff, topic.id, 1, lastReply.id)).page, 2);
    await db.forumReply.deleteMany({ where: { topic_id: topic.id, body: { startsWith: 'Page test ' } } });
    const remainingPage = await forum.readForumTopic(staff, topic.id, 2);
    assert.equal(remainingPage.page, 1);
    assert.equal(remainingPage.replies[0].id, reply.id);
    await forum.acceptForumAnswer(cube, topic.id, { reply_id: reply.id });
    assert.equal((await forum.forumStats()).solved, 1);
    assert.equal((await forum.listForumTopics(cube, { view: 'solved', category: 'help', page: 1 })).topics[0].id, topic.id);
    assert.equal((await forum.listForumTopics(cube, { view: 'solved', category: 'showcase', page: 1 })).total, 0);
    await forum.moderateForumTopic(staff, topic.id, { pinned: true, locked: false, category_id: 'help' });
    assert.equal((await forum.readForumTopic(cube, topic.id, 1)).topic.accepted_reply_id, reply.id);
    await forum.moderateForumTopic(staff, topic.id, { pinned: false, locked: false, category_id: 'ideas' });
    const moved = await forum.readForumTopic(cube, topic.id, 1);
    assert.equal(moved.topic.category_id, 'ideas');
    assert.equal(moved.topic.accepted_reply_id, null);
    assert.equal(moved.replies[0].id, reply.id);
    assert.equal((await forum.forumStats()).solved, 0);
    assert.equal((await forum.listForumTopics(cube, { view: 'solved', page: 1 })).total, 0);
    // A fresh connection sees the same content: this is not browser-local state.
    const second = new PrismaClient();
    try { assert.equal((await second.forumTopic.findUnique({ where: { id: topic.id } })).body, 'A sufficiently long original post.'); }
    finally { await second.$disconnect(); }
    await assert.rejects(forum.changeForumReply(cube, topic.id, reply.id, { body: 'Overwrite' }), e => e.status === 403);
    assert.equal((await forum.readForumTopic(cube, topic.id, 1)).topic.edited, false);
    await forum.changeForumTopic(cube, topic.id, { title: 'A real persistence test', body: 'A sufficiently long original post.' });
    assert.equal((await forum.readForumTopic(cube, topic.id, 1)).topic.edited, true);
    await forum.moderateForumTopic(staff, topic.id, { pinned: true, locked: true });
    await assert.rejects(forum.createForumReply(other, topic.id, { body: 'Blocked reply' }), e => e.status === 403);
    const report = await forum.reportForumPost(cube, topic.id, { reply_id: reply.id, reason: 'Please review this reply.' });
    assert.equal((await forum.listForumReports(staff, 1)).total, 1);
    await forum.resolveForumReport(staff, report.id);
    await forum.changeForumReply(staff, topic.id, reply.id, {}, true);
    assert.equal((await forum.readForumTopic(cube, topic.id, 1)).total, 0);
    assert.equal((await forum.readForumTopic(cube, topic.id, 2)).page, 1);
    assert.ok((await db.forumReply.findUnique({ where: { id: reply.id } })).deleted_at);
    await forum.changeForumTopic(staff, topic.id, {}, true);
    assert.equal((await forum.listForumTopics(staff, { view: 'saved', page: 1 })).total, 0);
    await assert.rejects(forum.readForumTopic(staff, topic.id, 1), e => e.status === 404);
    const unanswered = await forum.createForumTopic(cube, { category_id: 'showcase', title: 'An unanswered project log', body: 'A sufficiently long original post.' });
    const locked = await forum.createForumTopic(staff, { category_id: 'help', title: 'A locked unanswered topic', body: 'A sufficiently long original post.' });
    await forum.moderateForumTopic(staff, locked.id, { pinned: false, locked: true });
    const stats = await forum.forumStats();
    assert.equal(stats.topics, 2); assert.equal(stats.replies, 0);
    assert.deepEqual(stats.unanswered.map(t => t.id), [unanswered.id]);
    assert.deepEqual((await forum.listForumTopics(cube, { view: 'unanswered', page: 1 })).topics.map(t => t.id), [unanswered.id]);
    assert.equal((await forum.listForumTopics(cube, { view: 'unanswered', category: 'help', page: 1 })).total, 0);
    assert.equal(stats.contributors.find(c => c.author.id === cube.id).author.stage, 'cube');
    assert.doesNotMatch(JSON.stringify(stats), /forum_profile|cube_profile|password_hash|nda_status|@example/);
    const report2 = await forum.reportForumPost(staff, unanswered.id, { reason: 'Another report for projection validation.' });
    const reportProjection = (await forum.listForumReports(staff, 1)).reports.find(r => r.id === report2.id);
    assert.equal(reportProjection.reporter.stage, 'mentor');
    assert.doesNotMatch(JSON.stringify(reportProjection.reporter), /forum_profile|cube_profile|password_hash|nda_status|@example/);
    // The post owner gets one notification naming everyone who commented since they last read it.
    await db.user.update({ where: { id: staff.id }, data: { name: 'Mentor Ayla' } });
    const ownerNotes = () => db.notification.findMany({ where: { user_id: cube.id, forum_target: { is: { topic_id: unanswered.id } } }, include: { forum_target: true }, orderBy: { created_at: 'asc' } });
    await forum.createForumReply(other, unanswered.id, { body: 'First thought for [@Integration test](@cube-101) ![x](/uploads/forum/a.png)' });
    let owner = await ownerNotes();
    assert.equal(owner.length, 1);
    assert.equal(owner[0].message, 'Integration test commented on your post “An unanswered project log”: “First thought for @Integration test”');
    const latestReply = await forum.createForumReply(staff, unanswered.id, { body: 'Second **idea**' });
    owner = await ownerNotes();
    assert.equal(owner.length, 1);
    assert.equal(owner[0].message, 'Mentor Ayla and Integration test commented on your post “An unanswered project log”: “Second idea”');
    assert.equal(owner[0].forum_target.reply_id, latestReply.id);
    // Once read, the next comment starts a new notification that counts only newer commenters.
    await db.notification.update({ where: { id: owner[0].id }, data: { read_at: new Date() } });
    await forum.readForumTopic(cube, unanswered.id, 1);
    await forum.createForumReply(other, unanswered.id, { body: 'Third' });
    owner = await ownerNotes();
    assert.equal(owner.length, 2);
    assert.equal(owner[1].message, 'Integration test commented on your post “An unanswered project log”: “Third”');
    // Deleting a comment rewrites the owner's unread summary without it, or removes it when nobody is left.
    const fourth = await forum.createForumReply(staff, unanswered.id, { body: 'Fourth' });
    owner = await ownerNotes();
    assert.equal(owner[1].message, 'Mentor Ayla and Integration test commented on your post “An unanswered project log”: “Fourth”');
    const followerNotes = await db.notification.count({ where: { forum_target: { is: { reply_id: fourth.id } } } });
    assert.ok(followerNotes >= 1);
    await forum.changeForumReply(staff, unanswered.id, fourth.id, {}, true);
    owner = await ownerNotes();
    assert.equal(owner.length, 2);
    assert.equal(owner[1].message, 'Integration test commented on your post “An unanswered project log”: “Third”');
    assert.equal(await db.notification.count({ where: { forum_target: { is: { reply_id: fourth.id } } } }), 0);
    await forum.changeForumReply(other, unanswered.id, owner[1].forum_target.reply_id, {}, true);
    owner = await ownerNotes();
    assert.equal(owner.length, 1);
    // Force mark-read to commit between the grouped lookup and refresh.
    await forum.createForumReply(other, unanswered.id, { body: 'Race seed' });
    const seedNote = (await ownerNotes()).find(n => !n.read_at);
    assert.ok(seedNote);
    const rawTransaction = db.$transaction;
    let readInterleaved = false;
    db.$transaction = function(fn, ...options) {
      return rawTransaction.call(db, async tx => {
        const rawFind = tx.notification.findFirst;
        tx.notification.findFirst = async function(args) {
          const found = await rawFind.call(tx.notification, args);
          if (!readInterleaved && found?.id === seedNote.id) {
            await require('../dist/services/notificationRead.service').markNotificationsRead(cube.id, [found.id]);
            readInterleaved = true;
          }
          return found;
        };
        try { return await fn(tx); } finally { tx.notification.findFirst = rawFind; }
      }, ...options);
    };
    let freshReply;
    try { freshReply = await forum.createForumReply(other, unanswered.id, { body: 'Race fresh event' }); }
    finally { db.$transaction = rawTransaction; }
    assert.ok(readInterleaved);
    const oldRead = await db.notification.findUnique({ where: { id: seedNote.id } });
    assert.ok(oldRead.read_at);
    assert.match(oldRead.message, /Race seed/);
    const freshUnread = (await ownerNotes()).filter(n => !n.read_at);
    assert.equal(freshUnread.length, 1);
    assert.equal(freshUnread[0].forum_target.reply_id, freshReply.id);
    assert.match(freshUnread[0].message, /Race fresh event/);
    // Likes must preserve read history when mark-read wins the lookup/update race.
    const ownReply = await forum.createForumReply(cube, unanswered.id, { body: 'Owner reply for like notification races' });
    const interleaveLikeRead = async (note, action) => {
      const transaction = db.$transaction;
      let interleaved = false;
      db.$transaction = function(fn, ...options) {
        return transaction.call(db, async tx => {
          const findFirst = tx.notification.findFirst;
          tx.notification.findFirst = async function(args) {
            const found = await findFirst.call(tx.notification, args);
            if (!interleaved && found?.id === note.id) {
              await require('../dist/services/notificationRead.service').markNotificationsRead(cube.id, [found.id]);
              interleaved = true;
            }
            return found;
          };
          try { return await fn(tx); } finally { tx.notification.findFirst = findFirst; }
        }, ...options);
      };
      try { await action(); } finally { db.$transaction = transaction; }
      assert.ok(interleaved);
      const history = await db.notification.findUnique({ where: { id: note.id } });
      assert.ok(history?.read_at);
      assert.equal(history.message, note.message);
      assert.deepEqual(history.created_at, note.created_at);
    };
    for (const replyId of [undefined, ownReply.id]) {
      const unreadLikes = () => db.notification.findMany({ where: { user_id: cube.id, read_at: null,
        message: { contains: 'liked your' }, forum_target: { is: { topic_id: unanswered.id, reply_id: replyId || null } } } });
      await forum.likeForumPost(other, unanswered.id, replyId, { liked: true });
      const [seedLike] = await unreadLikes();
      assert.ok(seedLike);
      await interleaveLikeRead(seedLike, () => forum.likeForumPost(staff, unanswered.id, replyId, { liked: true }));
      const freshLikes = await unreadLikes();
      assert.equal(freshLikes.length, 1);
      assert.notEqual(freshLikes[0].id, seedLike.id);
      assert.match(freshLikes[0].message, /Mentor Ayla/);
      // An unlike must neither rewrite read history nor create a fresh notification.
      await interleaveLikeRead(freshLikes[0], () => forum.likeForumPost(staff, unanswered.id, replyId, { liked: false }));
      assert.equal((await unreadLikes()).length, 0);
      await forum.likeForumPost(other, unanswered.id, replyId, { liked: true });
      const [lastLike] = await unreadLikes();
      assert.ok(lastLike);
      await interleaveLikeRead(lastLike, () => forum.likeForumPost(other, unanswered.id, replyId, { liked: false }));
      assert.equal((await unreadLikes()).length, 0);
    }
    await forum.changeForumTopic(staff, unanswered.id, {}, true);
    assert.equal((await forum.forumStats()).unanswered.length, 0);
    // Private room authorization is enforced on real queries, not only in the UI.
    const chat = require('../dist/services/forumChat.service');
    const adminActor = { id: randomUUID(), role: 'ADMIN' };
    const outsiderAdmin = { id: randomUUID(), role: 'ADMIN' };
    for (const actor of [adminActor, outsiderAdmin]) await db.user.create({ data: { ...actor, name: 'Room admin', email: actor.id + '@example.invalid', password_hash: 'unusable-test-only' } });
    await assert.rejects(chat.createChatRoom(cube, { name: 'No', member_ids: [] }), e => e.status === 403);
    await assert.rejects(chat.createChatRoom(staff, { name: 'No', member_ids: [] }), e => e.status === 403);
    await assert.rejects(chat.chatPeople(cube, '', 1), e => e.status === 403);
    await assert.rejects(chat.createChatRoom(adminActor, { name: 'No', member_ids: ['missing'] }), e => e.status === 400);
    const room = await chat.createChatRoom(adminActor, { name: 'SecretRoomSentinel', member_ids: [cube.id, cube.id] });
    assert.equal(room._count.members, 2);
    assert.equal((await chat.listChatRooms(cube, 1)).total, 1);
    assert.equal((await chat.listChatRooms(other, 1)).total, 0);
    assert.equal((await chat.listChatRooms(outsiderAdmin, 1)).total, 0);
    await assert.rejects(chat.listChatRooms(cube, 1, true), e => e.status === 403);
    assert.equal((await chat.listChatRooms(outsiderAdmin, 1, true)).total, 1);
    await assert.rejects(chat.chatRoomDetails(other, room.id), e => e.status === 404);
    await assert.rejects(chat.chatMessages(other, room.id, 1), e => e.status === 404);
    await assert.rejects(chat.chatMessages(outsiderAdmin, room.id, 1), e => e.status === 404);
    await assert.rejects(chat.sendChatMessage(other, room.id, { body: 'Intruder' }), e => e.status === 404);
    await assert.rejects(chat.changeChatMember(cube, room.id, other.id, false), e => e.status === 403);
    await assert.rejects(chat.sendChatMessage(cube, room.id, { body: ' '.repeat(5) }), e => e.status === 400);
    await assert.rejects(chat.sendChatMessage(cube, room.id, { body: 'x'.repeat(5001) }), e => e.status === 400);
    await chat.sendChatMessage(cube, room.id, { body: 'PrivateBodySentinel' });
    const secretMessages = await chat.chatMessages(cube, room.id, 1);
    assert.equal(secretMessages.messages[0].body, 'PrivateBodySentinel');
    assert.doesNotMatch(JSON.stringify(secretMessages), /password_hash|@example|nda_status/);
    assert.equal((await forum.listForumTopics(cube, { query: 'PrivateBodySentinel', page: 1 })).total, 0);
    assert.doesNotMatch(JSON.stringify(await forum.forumStats()), /SecretRoomSentinel|PrivateBodySentinel/);
    assert.equal(await db.notification.count({ where: { message: { contains: 'PrivateBodySentinel' } } }), 0);
    await chat.changeChatMember(adminActor, room.id, other.id, false);
    await chat.changeChatMember(adminActor, room.id, other.id, false); // idempotent add
    assert.equal((await chat.chatRoomDetails(other, room.id)).members.length, 3);
    assert.equal((await chat.chatMessages(other, room.id, 1)).total, 1); // new member sees history
    await chat.changeChatMember(adminActor, room.id, other.id, true);
    await assert.rejects(chat.chatMessages(other, room.id, 1), e => e.status === 404);
    await assert.rejects(chat.sendChatMessage(other, room.id, { body: 'After removal' }), e => e.status === 404);
    assert.equal((await chat.listChatRooms(other, 1)).total, 0);
    // The same room row lock serializes revocation with reads/writes.
    let unlockRemoval, removalLocked;
    const removalReady = new Promise(resolve => { removalLocked = resolve; });
    const removalGate = new Promise(resolve => { unlockRemoval = resolve; });
    const removing = db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "ForumChatRoom" WHERE id = ${room.id} FOR UPDATE`;
      await tx.forumChatMember.delete({ where: { room_id_user_id: { room_id: room.id, user_id: cube.id } } });
      removalLocked(); await removalGate;
    });
    await removalReady;
    const racingRead = assert.rejects(chat.chatMessages(cube, room.id, 1), e => e.status === 404);
    const racingSend = assert.rejects(chat.sendChatMessage(cube, room.id, { body: 'RevocationRaceSentinel' }), e => e.status === 404);
    unlockRemoval(); await Promise.all([removing, racingRead, racingSend]);
    assert.equal(await db.forumChatMessage.count({ where: { body: 'RevocationRaceSentinel' } }), 0);
    await chat.changeChatMember(adminActor, room.id, cube.id, false);
    const secondRoom = await chat.createChatRoom(adminActor, { name: 'Other room', member_ids: [staff.id] });
    await chat.sendChatMessage(staff, secondRoom.id, { body: 'SecondRoomOnlySentinel' });
    assert.doesNotMatch(JSON.stringify(await chat.chatMessages(cube, room.id, 1)), /SecondRoomOnlySentinel/);
    await assert.rejects(chat.chatMessages(cube, secondRoom.id, 1), e => e.status === 404);
    // Real HTTP routes reject direct requests from outsiders, including admin non-members.
    const jwt = require('jsonwebtoken');
    const server = require('../dist/app').default.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    try {
      const root = 'http://127.0.0.1:' + server.address().port + '/api/forum';
      const request = (actor, path, options = {}) => fetch(root + path, { ...options, headers: { 'Content-Type': 'application/json', ...(actor ? { Authorization: 'Bearer ' + jwt.sign(actor, process.env.JWT_SECRET) } : {}) } });
      assert.equal((await request(null, '/chat/rooms')).status, 401);
      const denied = await request(other, '/chat/rooms/' + room.id + '/messages');
      assert.equal(denied.status, 404); assert.match(denied.headers.get('cache-control'), /no-store/);
      assert.doesNotMatch(await denied.text(), /PrivateBodySentinel|SecretRoomSentinel/);
      assert.equal((await request(other, '/chat/admin/rooms')).status, 403);
      assert.equal((await request(outsiderAdmin, '/chat/rooms/' + room.id + '/messages')).status, 404);
      assert.equal((await request(other, '/chat/rooms/' + room.id + '/messages', { method: 'POST', body: JSON.stringify({ body: 'Direct request' }) })).status, 404);
      assert.equal((await request(cube, '/chat/rooms/' + room.id + '/messages')).status, 200);
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    // Pagination and public-safe liker identities cover both post kinds.
    await db.forumChatMessage.createMany({ data: Array.from({ length: 51 }, (_, i) => ({ room_id: room.id, author_id: cube.id, body: 'Page ' + i, created_at: new Date(Date.now() + i) })) });
    const pageOne = await chat.chatMessages(cube, room.id, 1), pageTwo = await chat.chatMessages(cube, room.id, 2);
    assert.equal(pageOne.messages.length, 50); assert.equal(pageTwo.messages.length, 2);
    assert.equal(new Set([...pageOne.messages, ...pageTwo.messages].map(row => row.id)).size, 52);
    const likeTopic = await forum.createForumTopic(cube, { category_id: 'lounge', title: 'Liker list test', body: 'A public post for testing likes.' });
    const likeReply = await forum.createForumReply(other, likeTopic.id, { body: 'A public reply.' });
    await forum.likeForumPost(other, likeTopic.id, undefined, { liked: true });
    await forum.likeForumPost(staff, likeTopic.id, likeReply.id, { liked: true });
    const postLikers = await forum.forumPostLikers(likeTopic.id, undefined, 1);
    assert.deepEqual(postLikers.people.map(person => person.id), [other.id]);
    assert.deepEqual((await forum.forumPostLikers(likeTopic.id, likeReply.id, 1)).people.map(person => person.id), [staff.id]);
    assert.doesNotMatch(JSON.stringify(postLikers), /password_hash|@example|nda_status/);
    assert.equal((await forum.forumPostLikers(likeTopic.id, undefined, 2)).people.length, 0);
    await assert.rejects(forum.forumPostLikers(likeTopic.id, 'missing', 1), e => e.status === 404);
    await forum.changeForumReply(other, likeTopic.id, likeReply.id, {}, true);
    await assert.rejects(forum.forumPostLikers(likeTopic.id, likeReply.id, 1), e => e.status === 404);
    await forum.changeForumTopic(cube, likeTopic.id, {}, true);
    await assert.rejects(forum.forumPostLikers(likeTopic.id, undefined, 1), e => e.status === 404);
    await require('./forumChat.extras.cjs')({ db, chat, room, secondRoom, cube, other, adminActor, outsiderAdmin });
    console.log('PASS: private room roles, API isolation, revocation races, cross-room isolation, history, pagination, safe identities and topic/reply liker lists.');
    // Forum history must not break the portal's existing account-deletion flow.
    await db.user.delete({ where: { id: other.id } });
    assert.equal((await db.forumReply.findUnique({ where: { id: reply.id } })).author_id, null);
    console.log('PASS: profile persistence, badge ownership, quest validation, no reward side effects, deduplicated mentions, reply targets, categories, topic movement, solved-filter intersection, answer cleanup, reply-page clamping, stats privacy and unanswered consistency; additive SQL migrations, permissions, reports, soft deletion and account deletion.');
  } finally {
    if (db) await db.$disconnect();
    if (createdSchema) await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.$disconnect();
    // Only the known files created above are removed; no recursive directory deletion.
    for (const name of ['baseline.prisma', 'baseline.sql']) { const file = path.join(temp, name); if (fs.existsSync(file)) fs.unlinkSync(file); }
    fs.rmdirSync(temp);
  }
}
main().catch(error => { console.error(error.message.replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted]')); process.exitCode = 1; });
