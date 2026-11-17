// Encrypts private room content written before rooms were encrypted: room names, descriptions and
// repositories, messages, attachment names and files, tasks and links. Already encrypted values are
// skipped, so it is safe to run again. Requires FORUM_CHAT_KEY, the same key the server uses.
// Conditional writes preserve concurrent edits/deletions. Rerun to pick up changed legacy values.
//   npm run db:forum:encrypt-chat --prefix backend
require('dotenv').config();
require('ts-node').register({ transpileOnly: true, project: require('node:path').join(__dirname, '../tsconfig.json') });
const fs = require('node:fs/promises');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const crypto = require('../src/services/forumChatCrypto.service');

async function main() {
  const problem = crypto.forumChatKeyProblem();
  if (problem) throw new Error(problem);
  const db = new PrismaClient();
  const counts = { rooms: 0, messages: 0, attachments: 0, files: 0, tasks: 0, links: 0 };
  const seal = (roomId, value) => value && !crypto.isSealedText(value) ? crypto.sealText(roomId, value) : null;
  try {
    for (const room of await db.forumChatRoom.findMany({ select: { id: true, name: true, description: true, github_repo: true } })) {
      const data = {};
      for (const key of ['name', 'description', 'github_repo']) { const sealed = seal(room.id, room[key]); if (sealed) data[key] = sealed; }
      let changedRoom = false;
      for (const field of Object.keys(data)) { const changed = await db.forumChatRoom.updateMany({ where: { id: room.id, [field]: room[field] }, data: { [field]: data[field] } }); changedRoom ||= changed.count > 0; }
      if (changedRoom) counts.rooms++;
    }
    for (const row of await db.forumChatMessage.findMany({ where: { body: { not: '' }, NOT: { body: { startsWith: 'enc:v1:' } } }, select: { id: true, room_id: true, body: true } })) {
      const changed = await db.forumChatMessage.updateMany({ where: { id: row.id, body: row.body }, data: { body: crypto.sealText(row.room_id, row.body) } }); counts.messages += changed.count;
    }
    for (const row of await db.forumChatTask.findMany({ where: { NOT: { title: { startsWith: 'enc:v1:' } } }, select: { id: true, room_id: true, title: true } })) {
      const changed = await db.forumChatTask.updateMany({ where: { id: row.id, title: row.title }, data: { title: crypto.sealText(row.room_id, row.title) } }); counts.tasks += changed.count;
    }
    for (const row of await db.forumChatLink.findMany({ select: { id: true, room_id: true, title: true, url: true } })) {
      const data = {};
      for (const key of ['title', 'url']) { const sealed = seal(row.room_id, row[key]); if (sealed) data[key] = sealed; }
      let changedLink = false;
      for (const field of Object.keys(data)) { const changed = await db.forumChatLink.updateMany({ where: { id: row.id, [field]: row[field] }, data: { [field]: data[field] } }); changedLink ||= changed.count > 0; }
      if (changedLink) counts.links++;
    }
    const { STORAGE_PATH } = require('../src/config/env');
    const directory = path.resolve(STORAGE_PATH, 'private-chat');
    for (const row of await db.forumChatAttachment.findMany({ select: { id: true, room_id: true, original_name: true, storage_key: true } })) {
      const sealed = seal(row.room_id, row.original_name);
      if (sealed) { const changed = await db.forumChatAttachment.updateMany({ where: { id: row.id, original_name: row.original_name }, data: { original_name: sealed } }); counts.attachments += changed.count; }
      if (!/^[a-f0-9-]{36}$/.test(row.storage_key)) continue;
      const file = path.join(directory, row.storage_key);
      const data = await fs.readFile(file).catch(() => null);
      if (data && !crypto.isSealedFile(data)) {
        // Write next to the original and swap, so an interruption never leaves a half-written file.
        await fs.writeFile(file + '.enc', crypto.sealFile(row.room_id, data));
        await fs.rename(file + '.enc', file);
        counts.files++;
      }
    }
    console.log('Encrypted:', Object.entries(counts).map(([key, value]) => `${value} ${key}`).join(', '));
  } finally { await db.$disconnect(); }
}

main().catch(error => { console.error(error.message); process.exit(1); });
