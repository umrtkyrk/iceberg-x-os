/**
 * One-off: QuizAttempt.badge_awarded_id still points at badges from the old random logic
 * (e.g. "No Ghosting"). Point each completed attempt at the tier badge for its own score.
 *
 *   node scripts/fix-attempt-badges.js          # dry-run (writes nothing)
 *   node scripts/fix-attempt-badges.js --apply  # applies
 *
 * Only QuizAttempt.badge_awarded_id is updated. Nothing is deleted.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TIERS = [
  { name: 'Grand Archmage of the Stack', minScore: 90 },
  { name: 'Lorekeeper of the Protocol', minScore: 75 },
  { name: 'Initiate of the Outer Gates', minScore: 0 }
];
const APPLY = process.argv.includes('--apply');

async function main() {
  const badges = await prisma.badge.findMany({
    where: { OR: TIERS.map((t) => ({ name: { equals: t.name, mode: 'insensitive' } })) }
  });
  const byTier = new Map(TIERS.map((t) => [t.name, badges.find((b) => b.name.toLowerCase() === t.name.toLowerCase())]));
  const missing = TIERS.filter((t) => !byTier.get(t.name));
  if (missing.length) {
    console.error('Badges not found in DB, aborting:', missing.map((t) => t.name).join(', '));
    process.exit(1);
  }

  const attempts = await prisma.quizAttempt.findMany({
    where: { status: 'completed' },
    include: { badge_awarded: true, cube: { select: { user: { select: { name: true } } } } },
    orderBy: { completed_at: 'asc' }
  });

  let ok = 0, fix = 0;
  for (const a of attempts) {
    const tier = TIERS.find((t) => a.score >= t.minScore);
    const expected = byTier.get(tier.name);
    if (a.badge_awarded_id === expected.id) {
      ok++;
      continue;
    }
    fix++;
    console.log(
      `FIX  ${a.cube?.user?.name || a.cube_id} | score ${a.score} | ${a.badge_awarded?.name || '(none)'} -> ${expected.name}`
    );
    if (APPLY) {
      await prisma.quizAttempt.update({ where: { id: a.id }, data: { badge_awarded_id: expected.id } });
    }
  }
  console.log(`\n${APPLY ? 'APPLIED' : 'DRY-RUN'}: ${attempts.length} attempts | already correct ${ok} | to fix ${fix}`);
  if (!APPLY) console.log('Nothing written. Re-run with --apply to commit.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
