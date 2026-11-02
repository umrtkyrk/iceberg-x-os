import prisma from './prisma';
import { badRequest, conflict, forbidden, notFound } from '../utils/http';
import { ForumActor, forumText } from './forumPolicy';

export async function manageForumCategory(actor: ForumActor, id: string | undefined, input: Record<string, unknown>, remove = false) {
  if (actor.role !== 'ADMIN') throw forbidden('Only Admins can manage communities.');
  if (remove) {
    if (id === 'announcements') throw badRequest('The announcements community cannot be removed.');
    // Topics also acquire this lock at creation, so an empty-category deletion cannot race a new topic.
    return prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "ForumCategory" WHERE id = ${id} FOR UPDATE`;
      if (await tx.forumTopic.count({ where: { category_id: id } })) throw conflict('Move the topics first. Communities with deleted topic history must also be retained.');
      if (!(await tx.forumCategory.deleteMany({ where: { id } })).count) throw notFound('Community not found.');
      return { ok: true };
    });
  }
  const categoryId = id || forumText(input.id, 'Community code', 2, 60);
  if (!/^[a-z][a-z0-9-]+$/.test(categoryId)) throw badRequest('Use lowercase letters, numbers and hyphens in the community code.');
  const name = forumText(input.name, 'Community name', 2, 80);
  const description = forumText(input.description, 'Description', 1, 300);
  if (!Number.isInteger(input.position) || Number(input.position) < 0 || Number(input.position) > 999) throw badRequest('Position must be between 0 and 999.');
  if (typeof input.staff_only !== 'boolean') throw badRequest('Choose who can post.');
  const data = { name, description, position: Number(input.position), staff_only: categoryId === 'announcements' || input.staff_only };
  if (!id) {
    // Unique constraint errors remain sanitized; never overwrite another category.
    if (await prisma.forumCategory.findUnique({ where: { id: categoryId }, select: { id: true } })) throw conflict('This community code is already in use.');
    return prisma.forumCategory.create({ data: { id: categoryId, ...data } });
  }
  if (!(await prisma.forumCategory.updateMany({ where: { id }, data })).count) throw notFound('Community not found.');
  return { ok: true };
}
