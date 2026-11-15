/**
 * Admin operations, run from /admin/ops (admins only, not in the menu).
 * Each operation is registered here once; every run is recorded in OpsRun with
 * who ran it and what it returned, so the page doubles as an audit trail.
 *
 * Add new operations to OPERATIONS. Keep them idempotent and additive.
 */
import prisma from './prisma';
import { badRequest, notFound } from '../utils/http';
import { backfillSnapshots } from './scoreV2.data';
import { activateV2Quests } from './scoringQuests.service';
import { autoAssignQuestToEligibleCubes } from './quest.service';
import { FORMULA_VERSION } from './scoreV2';

interface Operation {
  key: string;
  title: string;
  description: string;
  /** Shown as a confirmation before running. */
  confirm?: string;
  run: () => Promise<unknown>;
}

const OPERATIONS: Operation[] = [
  {
    key: 'scoring-v2-backfill',
    title: 'Rebuild score history (scoring v2)',
    description: `Recomputes every Cube's weekly v2 score (formula ${FORMULA_VERSION}) from the raw records and replaces the stored history for this formula version. Reads only; never changes a scorecard, note or mission. Safe to re-run.`,
    run: () => backfillSnapshots(),
  },
  {
    key: 'scoring-v2-activate-quests',
    title: 'Switch quests to scoring v2',
    description:
      'Retires the old average-score quests (High Achiever, Iceberg Elite Fellow); earned badges stay. Creates the v2 quests and badges and assigns them to Cubes in the programme. Needs SCORING_V2_LIVE=true. Idempotent.',
    confirm: 'This changes which quests Cubes see. Run it only when the v2 score goes live. Continue?',
    run: () => activateV2Quests(autoAssignQuestToEligibleCubes),
  },
];

export async function listOperations() {
  const runs = await prisma.opsRun.findMany({ orderBy: { started_at: 'desc' }, take: 50 });
  return {
    operations: OPERATIONS.map(({ key, title, description, confirm }) => ({ key, title, description, confirm: confirm ?? null })),
    runs,
  };
}

/** Runs an operation and records the outcome. One run per operation at a time. */
export async function runOperation(key: string, userId: string) {
  const op = OPERATIONS.find(o => o.key === key);
  if (!op) throw notFound('Unknown operation.');
  const running = await prisma.opsRun.findFirst({
    where: { operation: key, status: 'running', started_at: { gt: new Date(Date.now() - 30 * 60_000) } },
  });
  if (running) throw badRequest('This operation is already running.');

  const run = await prisma.opsRun.create({ data: { operation: key, started_by: userId, status: 'running' } });
  try {
    const result = await op.run();
    return prisma.opsRun.update({
      where: { id: run.id },
      data: { status: 'succeeded', result: (result ?? null) as any, finished_at: new Date() },
    });
  } catch (error: any) {
    await prisma.opsRun.update({
      where: { id: run.id },
      data: { status: 'failed', error: String(error?.message || error).slice(0, 2000), finished_at: new Date() },
    });
    throw error;
  }
}
