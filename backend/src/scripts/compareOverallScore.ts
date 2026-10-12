/**
 * Proves the new server-side overall score equals the legacy browser formula
 * for every Cube wherever no peer data exists.
 *
 * Read-only. Run before relying on the server value:
 *
 *   npx ts-node src/scripts/compareOverallScore.ts
 *
 * Exits non-zero if any Cube without peer influence differs by more than 1e-9.
 */
import prisma from '../services/prisma';
import { computeScoreBreakdown, SCORECARD_KEYS } from '../services/score.service';

/** Verbatim port of the calculation in frontend/src/pages/Profile.tsx. */
function legacyCombined(feedback: any[], notes: { score: number | null }[]): number | null {
  let fSum = 0;
  let fCount = 0;
  for (const fb of feedback) {
    for (const k of SCORECARD_KEYS) {
      if (fb[k] !== undefined && fb[k] !== null) {
        fSum += fb[k];
        fCount++;
      }
    }
  }
  const fPct = ((fCount > 0 ? fSum / fCount : 0) / 5) * 100;

  let pSum = 0;
  let pCount = 0;
  for (const n of notes) {
    if (n.score !== undefined && n.score !== null) {
      pSum += n.score;
      pCount++;
    }
  }
  const pPct = ((pCount > 0 ? pSum / pCount : 0) / 10) * 100;

  if (fCount > 0 && pCount > 0) return (fPct + pPct) / 2;
  if (fCount > 0) return fPct;
  if (pCount > 0) return pPct;
  return null;
}

async function main() {
  const cubes = await prisma.cubeProfile.findMany({ select: { id: true, user_id: true } });
  let compared = 0;
  let peerAffected = 0;
  const mismatches: string[] = [];

  for (const cube of cubes) {
    const [feedback, notes, breakdown] = await Promise.all([
      prisma.mentorFeedback.findMany({ where: { cube_id: cube.user_id } }),
      prisma.privateNote.findMany({ where: { cube_id: cube.id }, select: { score: true } }),
      computeScoreBreakdown(cube.id)
    ]);

    if (breakdown.peer.applied) {
      peerAffected++;
      continue;
    }

    const legacy = legacyCombined(feedback as any[], notes);
    const now = breakdown.overall;
    compared++;

    const same =
      legacy === null || now === null
        ? legacy === now
        : Math.abs(legacy - now) < 1e-9;
    if (!same) mismatches.push(`${cube.id}: legacy=${legacy} server=${now}`);
  }

  console.log(`Cubes: ${cubes.length}, compared: ${compared}, peer-affected (skipped): ${peerAffected}`);
  if (mismatches.length > 0) {
    console.error(`MISMATCH on ${mismatches.length} Cube(s):`);
    mismatches.forEach(m => console.error('  ' + m));
    process.exit(1);
  }
  console.log('OK: server overall score equals the legacy formula for every compared Cube.');
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
