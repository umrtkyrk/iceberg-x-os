import assert from 'node:assert/strict';
import test from 'node:test';
import prisma from '../src/services/prisma';
import { markNotificationsRead } from '../src/services/notificationRead.service';

test('marking read preserves history, scopes writes to the owner, and keeps the first read time', async () => {
  const firstRead = new Date('2026-10-01T10:00:00Z');
  const rows = [
    {
      id: 'one',
      user_id: 'alice',
      read_at: null as Date | null,
      message: 'Unread message',
    },
    { id: 'two', user_id: 'alice', read_at: firstRead, message: 'Old message' },
    {
      id: 'three',
      user_id: 'bob',
      read_at: null as Date | null,
      message: 'Private message',
    },
  ];
  const original = prisma.notification.updateMany;
  let where: any;
  prisma.notification.updateMany = (async (args: any) => {
    where = args.where;
    let count = 0;
    rows.forEach((row) => {
      if (
        row.user_id === args.where.user_id &&
        !row.read_at &&
        (!args.where.id || args.where.id.in.includes(row.id))
      ) {
        row.read_at = args.data.read_at;
        count++;
      }
    });
    return { count };
  }) as typeof original;
  try {
    const result = await markNotificationsRead('alice', ['one', 'three']);
    assert.equal(result.count, 1);
    assert.equal(where.user_id, 'alice');
    assert.equal(where.read_at, null);
    assert.ok(where.created_at.lte instanceof Date);
    assert.equal(rows.length, 3);
    assert.ok(rows[0].read_at instanceof Date);
    assert.equal(rows[1].read_at, firstRead);
    assert.equal(rows[2].read_at, null);
    assert.equal((await markNotificationsRead('alice')).count, 0);
    assert.equal(rows[0].message, 'Unread message');
  } finally {
    prisma.notification.updateMany = original;
    await prisma.$disconnect();
  }
});
