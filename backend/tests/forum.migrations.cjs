// Exercises the actual setup CLI on two disposable localhost schemas, never public.
require('dotenv').config();
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const backend = path.resolve(__dirname, '..');
const cli = path.join(backend, 'scripts/forum-migrate.cjs');
const defaults = '20261109180000_forum_default_categories';
const likes = '20261111120000_forum_likes';
const original = '20261028120000_add_forum';
const integration = '20261029120000_forum_portal_integration';
const labels = ['20261029120000_english_forum_categories', '20261106120000_english_ideas_category'];
const redact = text => text.replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted]');
const invoke = (mode, url, extra = {}) => spawnSync(process.execPath, [cli, mode], {
  cwd: backend, encoding: 'utf8', env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url, NODE_ENV: 'test', ...extra },
});
const passed = result => assert.equal(result.status, 0, redact(result.stdout + result.stderr));
const rejected = (result, pattern) => { assert.notEqual(result.status, 0); assert.match(redact(result.stdout + result.stderr), pattern); };

async function main() {
  const url = new URL(process.env.DATABASE_URL || '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Tests require a localhost database.');
  rejected(invoke('--init-empty', 'postgresql://example:secret@example.invalid/db'), /localhost/);
  rejected(invoke('--apply', url.toString(), { DIRECT_URL: 'postgresql://example:secret@example.invalid/db' }), /localhost/);
  const different = new URL(url); different.searchParams.set('schema', 'wrong_target');
  rejected(invoke('--apply', url.toString(), { DIRECT_URL: different.toString() }), /same local database and schema/);
  rejected(invoke('--init-empty', url.toString(), { NODE_ENV: 'production' }), /local fork databases only/);
  console.log('PASS: remote and mismatched migration targets rejected before connecting.');
  const names = ['fresh', 'upgrade', 'guard'].map(kind => `forum_setup_${kind}_${randomUUID().replaceAll('-', '')}`);
  for (const name of names) assert.match(name, /^forum_setup_(fresh|upgrade|guard)_[a-f0-9]{32}$/);
  const admin = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  const clients = [];
  const created = [];
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cube-forum-migration-test-'));
  const connect = name => { const target = new URL(url); target.searchParams.set('schema', name); const db = new PrismaClient({ datasources: { db: { url: target.toString() } } }); clients.push(db); return { db, url: target.toString() }; };
  const prisma = (args, target) => {
    const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), ...args], { cwd: backend, env: { ...process.env, DATABASE_URL: target, DIRECT_URL: target }, encoding: 'utf8' });
    passed(result);
  };
  try {
    for (const name of names) { await admin.$executeRawUnsafe(`CREATE SCHEMA "${name}"`); created.push(name); }
    const guarded = connect(names[2]);
    await guarded.db.$executeRawUnsafe('CREATE TYPE "LocalSentinel" AS ENUM (\'keep\')');
    rejected(invoke('--init-empty', guarded.url), /non-empty/);
    console.log('PASS: a schema containing only a type is not mistaken for an empty schema.');
    const fresh = connect(names[0]);
    passed(invoke('--init-empty', fresh.url));
    assert.equal(await fresh.db.user.count(), 0);
    assert.equal(await fresh.db.forumTopic.count(), 0);
    assert.equal(await fresh.db.forumCategory.count(), 7);
    assert.equal((await fresh.db.forumCategory.findUnique({ where: { id: 'help' } })).name, 'Tech Support');
    assert.equal((await fresh.db.forumCategory.findUnique({ where: { id: 'announcements' } })).staff_only, true);
    const folders = fs.readdirSync(path.join(backend, 'prisma/migrations')).filter(name => fs.existsSync(path.join(backend, 'prisma/migrations', name, 'migration.sql')));
    const history = await fresh.db.$queryRawUnsafe('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL');
    assert.equal(history.length, folders.length);
    prisma(['migrate', 'diff', '--from-url', fresh.url, '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code'], fresh.url);
    rejected(invoke('--init-empty', fresh.url), /non-empty/);
    passed(invoke('--apply', fresh.url));
    console.log('PASS: real empty install, complete migration history, no schema drift, repeat-install refusal and idempotent upgrade.');

    // Older portal+forum fixture. Reuse the proven baseline records for portal/initial-forum only.
    const older = connect(names[1]);
    const current = fs.readFileSync(path.join(backend, 'prisma/schema.prisma'), 'utf8');
    const baseline = path.join(temp, 'baseline.prisma');
    const sql = path.join(temp, 'baseline.sql');
    fs.writeFileSync(baseline, current.split('model ForumCategory')[0].replace(/^  forum_\w+ .+\r?\n/gm, ''));
    prisma(['migrate', 'diff', '--from-empty', '--to-schema-datamodel', baseline, '--script', '--output', sql], older.url);
    prisma(['db', 'execute', '--file', sql, '--schema', baseline], older.url);
    prisma(['db', 'execute', '--file', path.join(backend, 'prisma/migrations', original, 'migration.sql'), '--schema', baseline], older.url);
    await admin.$executeRawUnsafe(`CREATE TABLE "${names[1]}"."_prisma_migrations" (LIKE "${names[0]}"."_prisma_migrations" INCLUDING ALL)`);
    const pending = [integration, ...labels, defaults, likes, '20261113120000_forum_private_chat', '20261113160000_forum_chat_extras'];
    await admin.$executeRawUnsafe(`INSERT INTO "${names[1]}"."_prisma_migrations" SELECT * FROM "${names[0]}"."_prisma_migrations" WHERE NOT (migration_name = ANY($1::text[]))`, pending);
    const user = await older.db.user.create({ data: { name: 'Local migration sentinel', email: `${randomUUID()}@example.invalid`, password_hash: 'unusable-test-only', role: 'ADMIN' } });
    await older.db.forumCategory.update({ where: { id: 'help' }, data: { name: 'Admin-owned title', description: 'Admin-owned description', position: 42 } });
    await older.db.forumCategory.delete({ where: { id: 'resources' } });
    const topic = await older.db.forumTopic.create({ data: { title: 'Preserve this topic', body: 'Original stored content', category_id: 'help', author_id: user.id } });
    const categories = await older.db.forumCategory.findMany({ orderBy: { id: 'asc' } });
    const beforeHistory = await older.db.$queryRawUnsafe('SELECT count(*)::int AS count FROM "_prisma_migrations"');
    passed(invoke('--plan', older.url));
    assert.deepEqual(await older.db.$queryRawUnsafe('SELECT count(*)::int AS count FROM "_prisma_migrations"'), beforeHistory);
    passed(invoke('--apply', older.url));
    for (const category of categories) assert.deepEqual(await older.db.forumCategory.findUnique({ where: { id: category.id } }), category);
    assert.deepEqual(await older.db.forumTopic.findUnique({ where: { id: topic.id } }), topic);
    assert.deepEqual(await older.db.user.findUnique({ where: { id: user.id } }), user);
    assert.equal(await older.db.forumProfile.count(), 0);
    assert.equal(await older.db.forumCategory.count(), categories.length + 1); // integration adds Ideas
    assert.equal(await older.db.forumCategory.findUnique({ where: { id: 'resources' } }), null);
    assert.equal(await older.db.forumTopicLike.count(), 0);
    passed(invoke('--apply', older.url));
    console.log('PASS: older forum upgraded through real CLI without changing any existing category, user or topic; plan is read only.');

    // A pending portal migration must never be silently included in the forum upgrade.
    const portalName = folders.filter(name => name < original).sort()[0];
    await older.db.$executeRawUnsafe('DELETE FROM "_prisma_migrations" WHERE migration_name = $1', portalName);
    rejected(invoke('--apply', older.url), /Portal migrations need a separate reviewed upgrade/);
    assert.deepEqual(await older.db.forumTopic.findUnique({ where: { id: topic.id } }), topic);
    console.log('PASS: unknown portal upgrade refused without changing forum data.');
  } finally {
    for (const client of clients) await client.$disconnect();
    for (const name of created.reverse()) await admin.$executeRawUnsafe(`DROP SCHEMA "${name}" CASCADE`);
    await admin.$disconnect();
    for (const name of ['baseline.prisma', 'baseline.sql']) { const file = path.join(temp, name); if (fs.existsSync(file)) fs.unlinkSync(file); }
    fs.rmdirSync(temp);
  }
}
main().catch(error => { console.error(redact(error.message)); process.exitCode = 1; });
