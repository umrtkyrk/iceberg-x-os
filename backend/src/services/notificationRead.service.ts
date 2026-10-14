import prisma from './prisma';

export async function markNotificationsRead(userId: string, ids?: string[]) {
  const readAt = new Date();
  const result = await prisma.notification.updateMany({
    where: {
      user_id: userId,
      read_at: null,
      ...(ids ? { id: { in: ids } } : {}),
      created_at: { lte: readAt },
    },
    data: { read_at: readAt },
  });
  return { success: true, count: result.count, read_at: readAt.toISOString() };
}
