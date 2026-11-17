// Fills local private rooms with demo content: a to-do board, pinned links, a connected GitHub
// repository and a short conversation. Local development only; it never deletes anything and only
// tops up rooms that have little or no content, so running it again adds nothing new.
//   npm run db:forum:demo --prefix backend            (every room)
//   npm run db:forum:demo --prefix backend -- room1   (rooms whose name contains "room1")
require('dotenv').config();
require('ts-node').register({ transpileOnly: true, project: require('node:path').join(__dirname, '../tsconfig.json') });
const { PrismaClient } = require('@prisma/client');
const { forumChatKeyProblem, openText, sealText } = require('../src/services/forumChatCrypto.service');

const REPO = 'umrtkyrk/iceberg-x-os';
const TASKS = [
  ['TODO', 'Write the onboarding checklist for new Cubes'],
  ['TODO', 'Add dark mode screenshots to the README'],
  ['DOING', 'Threaded replies: review the notification wording'],
  ['DOING', 'Hook the room board up to mission deadlines'],
  ['DONE', 'Private rooms: board, pinned links and GitHub panel'],
  ['DONE', 'Fix sidebar scrolling in the forum'],
];
const LINKS = [
  ['Repository', `https://github.com/${REPO}`],
  ['Pull requests', `https://github.com/${REPO}/pulls`],
  ['Design file', 'https://www.figma.com/'],
  ['Team notes', 'https://www.notion.so/'],
];
const MESSAGES = [
  'Morning! I pushed the thread changes to forum-mvp last night.',
  'Nice, I will review the PR after lunch.',
  'Can someone take the onboarding checklist? It is on the board under To do.',
  'I can pick it up tomorrow.',
  'Reminder: demo day prep call at 16:00.',
  'Pinned the design file so we stop hunting for the link.',
];

function assertLocal() {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo data is for local databases only.');
  const host = new URL(process.env.DATABASE_URL || '').hostname;
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) throw new Error(`Refusing to write demo data to ${host || 'an unknown host'}.`);
}

async function main() {
  assertLocal();
  const problem = forumChatKeyProblem();
  if (problem) throw new Error(problem);
  const filter = process.argv[2];
  const db = new PrismaClient();
  try {
    // Room names are encrypted, so the name filter runs after decryption.
    const all = await db.forumChatRoom.findMany({
      include: { members: { orderBy: { joined_at: 'asc' }, select: { user_id: true } }, _count: { select: { tasks: true, links: true, messages: true } } } });
    const rooms = all.map(room => ({ ...room, name: openText(room.id, room.name) })).filter(room => !filter || room.name.toLowerCase().includes(filter.toLowerCase()));
    if (!rooms.length) { console.log('No matching rooms. Create a room in the forum first.'); return; }
    for (const room of rooms) {
      const people = room.members.map(member => member.user_id);
      const author = index => people.length ? people[index % people.length] : null;
      const added = [];
      if (room._count.tasks < 3) {
        const start = Date.now() - TASKS.length * 60000;
        await db.forumChatTask.createMany({ data: TASKS.map(([status, title], index) => ({ room_id: room.id, status, title: sealText(room.id, title), created_by_id: author(index), created_at: new Date(start + index * 60000) })) });
        added.push(`${TASKS.length} tasks`);
      }
      if (room._count.links < 2) {
        const start = Date.now() - LINKS.length * 60000;
        await db.forumChatLink.createMany({ data: LINKS.map(([title, url], index) => ({ room_id: room.id, title: sealText(room.id, title), url: sealText(room.id, url), created_by_id: author(0), created_at: new Date(start + index * 60000) })) });
        added.push(`${LINKS.length} links`);
      }
      if (!room.github_repo) { await db.forumChatRoom.update({ where: { id: room.id }, data: { github_repo: sealText(room.id, REPO) } }); added.push(`repo ${REPO}`); }
      if (room._count.messages < 3 && people.length) {
        const start = Date.now() - MESSAGES.length * 7 * 60000;
        for (const [index, body] of MESSAGES.entries()) {
          await db.forumChatMessage.create({ data: { room_id: room.id, author_id: author(index), body: sealText(room.id, body), created_at: new Date(start + index * 7 * 60000) } });
        }
        await db.forumChatRoom.update({ where: { id: room.id }, data: { updated_at: new Date() } });
        added.push(`${MESSAGES.length} messages`);
      }
      console.log(`${room.name}: ${added.length ? 'added ' + added.join(', ') : 'already has demo content'}`);
    }
  } finally { await db.$disconnect(); }
}

main().catch(error => { console.error(error.message); process.exit(1); });
