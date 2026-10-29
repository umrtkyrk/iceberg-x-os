import 'dotenv/config';
import prisma from '../services/prisma';
import { forumStarterTopics } from '../data/forumStarterTopics';

async function main() {
  const url = new URL(process.env.DATABASE_URL || '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('This content seed is for a local database only.');
  const id = process.env.FORUM_SEED_AUTHOR_ID;
  if (!id) throw new Error('Set FORUM_SEED_AUTHOR_ID to the local staff account publishing these posts.');
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!user || !['ADMIN', 'MENTOR'].includes(user.role)) throw new Error('The selected author must be an existing Admin or Mentor.');
  await prisma.$transaction(async tx => {
    for (const post of forumStarterTopics) {
      await tx.forumTopic.upsert({ where: { id: post.id }, update: {}, create: { ...post, author_id: user.id } });
    }
  });
  console.log('Six starter topics are ready. Existing posts were not overwritten; no fictional replies were created.');
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Forum seed failed.'); process.exitCode = 1; }).finally(() => prisma.$disconnect());
