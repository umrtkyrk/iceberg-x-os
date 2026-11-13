// Local fork setup only. No reset, db push, remote database, or historical SQL edits.
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env') });
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');

const backend = path.resolve(__dirname, '..');
const schemaFile = path.join(backend, 'prisma/schema.prisma');
const migrations = path.join(backend, 'prisma/migrations');
const defaults = '20261109180000_forum_default_categories';
const likes = '20261111120000_forum_likes';
// Reviewed recruitment/webinar migrations are included in the current-schema empty baseline.
const baselineLast = '20261106120000_webinar_attendance_votes';
// Additive forum migrations newer than the baseline. A fresh install already gets their tables from
// the current schema, so --init-empty records them as applied instead of running them.
const additive = new Set([likes, '20261113120000_forum_private_chat']);
// These two historical files contain label-only UPDATEs, not schema changes.
// Resolve them without executing them, but only if their reviewed contents match.
const labelOnly = new Map([
  ['20261029120000_english_forum_categories', '93dc4ee50f1e4d911cfbcb87a77e053e6263807a49e302544926c1fee402eb61'],
  ['20261106120000_english_ideas_category', 'e302448a5549a2c51bff254cb70bfcee55a990c23c68ca5f773ca7e813eb6e59'],
]);
const forumMigrations = new Set([
  '20261028120000_add_forum', '20261029120000_forum_portal_integration',
  ...labelOnly.keys(), defaults, ...additive,
]);
const digest = source => createHash('sha256').update(source.replace(/\r\n/g, '\n')).digest('hex');

function localTarget() {
  if (process.env.NODE_ENV === 'production') throw new Error('This command is for local fork databases only.');
  const parse = value => {
    let url;
    try { url = new URL(value); } catch { throw new Error('Set DATABASE_URL and DIRECT_URL to the same local PostgreSQL database.'); }
    if (!['postgresql:', 'postgres:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      throw new Error('Only a localhost PostgreSQL database is allowed.');
    }
    const schema = url.searchParams.get('schema') || 'public';
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema) || schema.startsWith('pg_') || schema === 'information_schema') throw new Error('Invalid local schema.');
    return { url, schema, key: `${url.hostname}:${url.port || '5432'}${url.pathname}?schema=${schema}` };
  };
  const target = parse(process.env.DATABASE_URL);
  const direct = parse(process.env.DIRECT_URL || process.env.DATABASE_URL);
  if (target.key !== direct.key) throw new Error('DATABASE_URL and DIRECT_URL must address the same local database and schema.');
  process.env.DIRECT_URL ||= process.env.DATABASE_URL;
  return target;
}

function runPrisma(args) {
  const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), ...args], {
    cwd: backend, env: process.env, encoding: 'utf8',
  });
  // Prisma output may include connection details. Keep errors actionable without logging credentials.
  if (result.status !== 0) throw new Error(`Prisma ${args.slice(0, 2).join(' ')} failed. No reset was attempted. Check the local database and migration history.`);
}

const objectsIn = (db, schema) => db.$queryRawUnsafe(`
  SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1
  UNION ALL SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = $1
  UNION ALL SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = $1`, schema);

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args[0] && !['--plan', '--apply', '--init-empty'].includes(args[0]))) throw new Error('Use --plan (read only), --apply, or --init-empty.');
  const mode = args[0] || '--plan';
  const target = localTarget();
  const names = fs.readdirSync(migrations).filter(name => fs.existsSync(path.join(migrations, name, 'migration.sql'))).sort();
  for (const [name, hash] of labelOnly) {
    if (digest(fs.readFileSync(path.join(migrations, name, 'migration.sql'), 'utf8')) !== hash) throw new Error(`Reviewed label migration changed: ${name}. Nothing was applied.`);
  }
  const db = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
  let temp;
  try {
    const exists = await db.$queryRawUnsafe('SELECT nspname FROM pg_namespace WHERE nspname = $1', target.schema);
    if (!exists.length) throw new Error('Create the named empty local schema first; no schema was changed.');
    const objects = await objectsIn(db, target.schema);
    if (mode === '--init-empty') {
      if (objects.length) throw new Error('Refusing to initialize a non-empty schema. Use --plan / --apply for an existing migrated portal.');
      if (names.some(name => name > baselineLast && name !== defaults && !additive.has(name))) throw new Error('A newer migration needs review before updating the local baseline procedure.');
      temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cube-forum-baseline-'));
      const sql = path.join(temp, 'baseline.sql');
      runPrisma(['migrate', 'diff', '--from-empty', '--to-schema-datamodel', schemaFile, '--script', '--output', sql]);
      // A second emptiness check immediately before DDL. Run this with local dev servers stopped.
      if ((await objectsIn(db, target.schema)).length) throw new Error('Schema changed during preflight. Nothing was applied.');
      runPrisma(['db', 'execute', '--file', sql, '--schema', schemaFile]);
      console.log('Created current schema from additive SQL on an empty local target.');
      for (const name of names.filter(name => name !== defaults)) {
        runPrisma(['migrate', 'resolve', '--applied', name, '--schema', schemaFile]);
      }
      // Only the new empty-forum seed runs; historical UPDATEs never execute.
      runPrisma(['migrate', 'deploy', '--schema', schemaFile]);
      console.log('PASS: empty local baseline recorded; default communities added without sample accounts or posts.');
      return;
    }
    if (!objects.some(row => row.name === '_prisma_migrations')) throw new Error('No Prisma migration history. For an empty local schema use db:forum:init; do not baseline an existing portal blindly.');
    const history = await db.$queryRawUnsafe(`SELECT migration_name, finished_at, rolled_back_at FROM "${target.schema}"."_prisma_migrations"`);
    if (history.some(row => !row.finished_at && !row.rolled_back_at)) throw new Error('A failed migration requires review before continuing. No changes were made.');
    const applied = new Set(history.filter(row => row.finished_at && !row.rolled_back_at).map(row => row.migration_name));
    if ([...applied].some(name => !names.includes(name))) throw new Error('Database has migration history absent from this checkout. Use its matching branch.');
    const pending = names.filter(name => !applied.has(name));
    const unknown = pending.filter(name => !forumMigrations.has(name));
    if (unknown.length) throw new Error(`Portal migrations need a separate reviewed upgrade: ${unknown.join(', ')}. Nothing was applied.`);
    for (const name of pending) console.log(`${labelOnly.has(name) ? 'PRESERVE LABELS (resolve only)' : 'APPLY'} ${name}`);
    if (mode === '--plan') { console.log(pending.length ? 'Read-only plan; run db:forum:migrate to apply.' : 'Already up to date.'); return; }
    for (const name of pending.filter(name => labelOnly.has(name))) runPrisma(['migrate', 'resolve', '--applied', name, '--schema', schemaFile]);
    runPrisma(['migrate', 'deploy', '--schema', schemaFile]);
    console.log('PASS: local forum migrations applied; existing category names and descriptions preserved.');
  } finally {
    await db.$disconnect();
    if (temp) {
      const file = path.join(temp, 'baseline.sql');
      if (fs.existsSync(file)) fs.unlinkSync(file);
      fs.rmdirSync(temp);
    }
  }
}
main().catch(error => {
  const message = String(error.message).replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, '[redacted]');
  console.error(message.startsWith('Prisma') || !message.includes('\n') ? message : 'Local database check failed. Verify the connection and schema; no reset was attempted.');
  process.exitCode = 1;
});
