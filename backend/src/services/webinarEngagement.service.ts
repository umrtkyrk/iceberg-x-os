/**
 * Webinar engagement read from the database: per-webinar scores for a Cube and
 * the summary shown on the Profile and Webinars pages. The webinar score is a
 * separate metric; it is NOT part of the overall performance score.
 *
 * Only completed webinars with an attendance record for the Cube are scored,
 * so a Cube who joined the programme later is never penalised for them.
 */
import { WebinarStatus } from '@prisma/client';
import prisma from './prisma';
import { EngagementSummary, WebinarScore, scoreWebinar, summarizeEngagement } from './webinar';

export interface ScoredWebinar {
  webinar_id: string;
  title: string;
  date: Date;
  result: WebinarScore;
}

/** Scores for every cube in `cubeIds` (or every cube with attendance when omitted). */
export async function scoreCubes(cubeIds?: string[]): Promise<Map<string, ScoredWebinar[]>> {
  const attendance = await prisma.webinarAttendance.findMany({
    where: {
      webinar: { status: WebinarStatus.Completed },
      ...(cubeIds ? { cube_id: { in: cubeIds } } : {})
    },
    include: { webinar: { select: { id: true, title: true, date: true } } }
  });
  if (attendance.length === 0) return new Map();

  const questions = await prisma.webinarQuestion.findMany({
    where: {
      webinar_id: { in: [...new Set(attendance.map(a => a.webinar_id))] },
      cube_id: { in: [...new Set(attendance.map(a => a.cube_id))] }
    },
    select: { webinar_id: true, cube_id: true, is_late: true, is_strong: true }
  });
  const questionsBy = new Map<string, { is_late: boolean; is_strong: boolean }[]>();
  for (const q of questions) {
    const key = `${q.cube_id}:${q.webinar_id}`;
    const list = questionsBy.get(key) || [];
    list.push(q);
    questionsBy.set(key, list);
  }

  const result = new Map<string, ScoredWebinar[]>();
  for (const a of attendance) {
    const score = scoreWebinar(questionsBy.get(`${a.cube_id}:${a.webinar_id}`) || [], a);
    if (!score) continue;
    const list = result.get(a.cube_id) || [];
    list.push({ webinar_id: a.webinar.id, title: a.webinar.title, date: a.webinar.date, result: score });
    result.set(a.cube_id, list);
  }
  for (const list of result.values()) list.sort((x, y) => y.date.getTime() - x.date.getTime());
  return result;
}

export async function cubeEngagement(
  cubeId: string
): Promise<{ summary: EngagementSummary; webinars: ScoredWebinar[] }> {
  const webinars = (await scoreCubes([cubeId])).get(cubeId) || [];
  return { summary: summarizeEngagement(webinars.map(w => w.result)), webinars };
}

/** Webinars with at least one on-time question, among completed webinars. */
export async function countWebinarsWithOnTimeQuestion(cubeId: string): Promise<number> {
  const rows = await prisma.webinarQuestion.findMany({
    where: { cube_id: cubeId, is_late: false, webinar: { status: WebinarStatus.Completed } },
    select: { webinar_id: true },
    distinct: ['webinar_id']
  });
  return rows.length;
}

export async function countStrongQuestions(cubeId: string): Promise<number> {
  return prisma.webinarQuestion.count({ where: { cube_id: cubeId, is_strong: true } });
}
