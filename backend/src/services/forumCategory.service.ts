import prisma from './prisma';
import { badRequest, conflict, forbidden, notFound } from '../utils/http';
import { ForumActor, forumText } from './forumPolicy';

export async function manageForumCategory(actor: ForumActor, id: string | undefined, input: Record<string, unknown>, remove = false) {
  if (actor.role !== 'ADMIN') throw forbidden('Kategorileri yalnızca Admin yönetebilir.');
  if (remove) {
    if (id === 'announcements') throw badRequest('Duyurular kategorisi kaldırılamaz.');
    // Topics also acquire this lock at creation, so an empty-category deletion cannot race a new topic.
    return prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "ForumCategory" WHERE id = ${id} FOR UPDATE`;
      if (await tx.forumTopic.count({ where: { category_id: id } })) throw conflict('Önce bu kategorideki konuları başka bir kategoriye taşı. Silinen konuların geçmişi de korunur.');
      if (!(await tx.forumCategory.deleteMany({ where: { id } })).count) throw notFound('Kategori bulunamadı.');
      return { ok: true };
    });
  }
  const categoryId = id || forumText(input.id, 'Kategori kodu', 2, 60);
  if (!/^[a-z][a-z0-9-]+$/.test(categoryId)) throw badRequest('Kategori kodunda küçük harf, sayı ve tire kullan.');
  const name = forumText(input.name, 'Kategori adı', 2, 80);
  const description = forumText(input.description, 'Açıklama', 1, 300);
  if (!Number.isInteger(input.position) || Number(input.position) < 0 || Number(input.position) > 999) throw badRequest('Sıra 0–999 arasında olmalı.');
  if (typeof input.staff_only !== 'boolean') throw badRequest('Paylaşım iznini seç.');
  const data = { name, description, position: Number(input.position), staff_only: categoryId === 'announcements' || input.staff_only };
  if (!id) {
    // Unique constraint errors remain sanitized; never overwrite another category.
    if (await prisma.forumCategory.findUnique({ where: { id: categoryId }, select: { id: true } })) throw conflict('Bu kategori kodu kullanılıyor.');
    return prisma.forumCategory.create({ data: { id: categoryId, ...data } });
  }
  if (!(await prisma.forumCategory.updateMany({ where: { id }, data })).count) throw notFound('Kategori bulunamadı.');
  return { ok: true };
}
