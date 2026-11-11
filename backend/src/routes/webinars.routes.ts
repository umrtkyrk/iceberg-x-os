/**
 * Webinars with guest speakers, and the questions Cubes send before them.
 *
 * Visibility: drafts are staff-only. A published webinar is visible to the
 * Cubes it invites (an empty invite list means every Cube in the programme).
 *
 * Questions: every invited Cube must send at least one. Other Cubes'
 * questions are shown only after the requester has sent their own, and always
 * without names. Staff see names; the list sent to the speaker is anonymous.
 *
 * After the webinar staff take attendance and close it. Each Cube then gets a
 * webinar score (half questions, half attendance), kept apart from the overall
 * performance score. An absent Cube can recover part of the attendance points
 * by watching the recording and writing what they learned.
 */
import { Router } from 'express';
import { Prisma, WebinarStatus } from '@prisma/client';
import prisma from '../services/prisma';
import {
  requireAuth,
  isMentorOrAdmin,
  isCube,
  AuthenticatedRequest
} from '../middlewares/auth.middleware';
import { HttpError, badRequest, conflict, forbidden, notFound, sendError } from '../utils/http';
import { assertCubesAreActive, isCubeActive } from '../services/cubeStatus.service';
import { IN_PROGRAMME_CUBE_LEVELS } from '../config/constants';
import { StorageService } from '../services/storage.service';
import { recalculateQuestsForCubes } from '../services/quest.service';
import { generateWebinarQuestionGroups } from '../services/ai.service';
import { cubesWithQuestions, notifyUsers, requiredCubes } from '../services/webinarAudience.service';
import { cubeEngagement, scoreCubes } from '../services/webinarEngagement.service';
import {
  MAX_QUESTIONS_PER_CUBE,
  MIN_QUESTIONS_TO_GROUP,
  QuestionGroup,
  canSubmitRecovery,
  formatQuestionsForSpeaker,
  parseAttendanceStatus,
  parseCareer,
  parseExpertise,
  parseHttpUrl,
  parseQuestionBody,
  parseRecoveryNote,
  parseSchedule,
  questionWindow,
  recoveryDeadline,
  scoreWebinar,
  summarizeEngagement
} from '../services/webinar';

const router = Router();

const isStaffRole = (role?: string) => role === 'ADMIN' || role === 'MENTOR';

const speakerInclude = {
  speakers: {
    orderBy: { position: 'asc' as const },
    include: { speaker: true }
  }
};

function str(value: any, max: number): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s ? s.slice(0, max) : null;
}

/** Flattens the join rows into an ordered speaker list. */
function withSpeakers<T extends { speakers: { speaker: any }[] }>(webinar: T) {
  return { ...webinar, speakers: webinar.speakers.map(s => s.speaker) };
}

function canCubeSee(
  webinar: { status: WebinarStatus; invited_cube_ids: string[] },
  cubeProfileId?: string
) {
  if (webinar.status === WebinarStatus.Draft) return false;
  const invited = webinar.invited_cube_ids || [];
  return invited.length === 0 || (!!cubeProfileId && invited.includes(cubeProfileId));
}

/** Recalculates quests in the background; a failure never fails the request. */
function refreshQuests(cubeIds: string[], reason: string) {
  if (cubeIds.length === 0) return;
  recalculateQuestsForCubes([...new Set(cubeIds)]).catch(err =>
    console.error(`Quest recalculation failed after ${reason}:`, err)
  );
}

/** Tells absent Cubes they can still recover points with the recording. */
async function notifyRecoveryOpen(webinar: { id: string; title: string; date: Date; completed_at: Date | null }) {
  const absent = await prisma.webinarAttendance.findMany({
    where: { webinar_id: webinar.id, status: 'Absent', recovery_status: null },
    select: { cube: { select: { user_id: true } } }
  });
  const deadline = recoveryDeadline(webinar).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Istanbul'
  });
  await notifyUsers(
    absent.map(a => a.cube.user_id),
    `You missed the "${webinar.title}" webinar. Watch the recording and write what you learned by ${deadline} to recover part of your webinar points.`
  );
}

/** Validates and orders the speaker ids sent with a webinar. */
async function parseSpeakerIds(value: any): Promise<string[]> {
  if (!Array.isArray(value)) return [];
  const ids = [...new Set(value.filter((v: any) => typeof v === 'string' && v))] as string[];
  if (ids.length === 0) return [];
  const found = await prisma.speaker.count({ where: { id: { in: ids } } });
  if (found !== ids.length) throw badRequest('One or more selected speakers no longer exist.');
  return ids;
}

function parseWebinarFields(body: any) {
  const duration = Number(body.duration_minutes);
  return {
    title: str(body.title, 200),
    description: str(body.description, 20000),
    duration_minutes: Number.isFinite(duration) && duration > 0 ? Math.min(Math.trunc(duration), 600) : 60,
    meeting_url: parseHttpUrl(body.meeting_url, 'Meeting link'),
    recording_url: parseHttpUrl(body.recording_url, 'Recording link'),
    slides_url: parseHttpUrl(body.slides_url, 'Slides link'),
    summary: str(body.summary, 20000)
  };
}

// ---------------------------------------------------------------------------
// Speakers (staff)
// ---------------------------------------------------------------------------

function parseSpeakerFields(body: any) {
  const name = str(body.name, 160);
  if (!name) throw badRequest('Speaker name is required.');
  return {
    name,
    headline: str(body.headline, 200),
    company: str(body.company, 200),
    bio: str(body.bio, 20000),
    linkedin_url: parseHttpUrl(body.linkedin_url, 'LinkedIn link'),
    website_url: parseHttpUrl(body.website_url, 'Website link'),
    career: parseCareer(body.career) as unknown as Prisma.InputJsonValue,
    expertise: parseExpertise(body.expertise)
  };
}

router.get('/webinar-speakers', requireAuth, isMentorOrAdmin, async (_req, res) => {
  try {
    const speakers = await prisma.speaker.findMany({
      include: { _count: { select: { webinars: true } } },
      orderBy: { name: 'asc' }
    });
    return res.json(speakers);
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/webinar-speakers', requireAuth, isMentorOrAdmin, async (req, res) => {
  try {
    const speaker = await prisma.speaker.create({ data: parseSpeakerFields(req.body) });
    return res.status(201).json(speaker);
  } catch (error) {
    return sendError(res, error);
  }
});

router.put('/webinar-speakers/:id', requireAuth, isMentorOrAdmin, async (req, res) => {
  try {
    const existing = await prisma.speaker.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Speaker not found');
    const speaker = await prisma.speaker.update({
      where: { id: req.params.id },
      data: parseSpeakerFields(req.body)
    });
    return res.json(speaker);
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/webinar-speakers/:id/photo', requireAuth, isMentorOrAdmin, async (req, res) => {
  try {
    const existing = await prisma.speaker.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Speaker not found');

    const match = String(req.body?.photo_base64 || '').match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    if (!match) throw badRequest('Invalid image data.');
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowed.includes(match[1])) throw badRequest('Only PNG, JPEG and WEBP images are allowed.');

    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 5 * 1024 * 1024) throw badRequest('The image must be smaller than 5 MB.');

    const { relativeUrl } = await StorageService.saveAvatar(
      `speaker_${existing.id}`,
      buffer,
      match[1].split('/')[1] || 'png'
    );
    const speaker = await prisma.speaker.update({
      where: { id: existing.id },
      data: { photo_url: relativeUrl }
    });
    return res.json(speaker);
  } catch (error) {
    return sendError(res, error);
  }
});

router.delete('/webinar-speakers/:id', requireAuth, isMentorOrAdmin, async (req, res) => {
  try {
    const used = await prisma.webinarSpeaker.count({ where: { speaker_id: req.params.id } });
    if (used > 0) {
      throw conflict(`This speaker is linked to ${used} webinar(s). Remove them from those webinars first.`);
    }
    await prisma.speaker.delete({ where: { id: req.params.id } });
    return res.json({ message: 'Speaker deleted' });
  } catch (error) {
    return sendError(res, error);
  }
});

// ---------------------------------------------------------------------------
// Webinars
// ---------------------------------------------------------------------------

router.get('/webinars', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const staff = isStaffRole(req.user?.role);
    const cubeProfileId = req.user?.cubeProfileId;

    const webinars = await prisma.webinar.findMany({
      where: staff
        ? {}
        : {
            status: { not: WebinarStatus.Draft },
            OR: [
              { invited_cube_ids: { isEmpty: true } },
              { invited_cube_ids: { has: cubeProfileId || '' } }
            ]
          },
      include: { ...speakerInclude, _count: { select: { questions: true } } },
      orderBy: { date: 'desc' }
    });

    let ownCounts = new Map<string, number>();
    if (!staff && cubeProfileId && webinars.length > 0) {
      const grouped = await prisma.webinarQuestion.groupBy({
        by: ['webinar_id'],
        where: { cube_id: cubeProfileId, webinar_id: { in: webinars.map(w => w.id) } },
        _count: { _all: true }
      });
      ownCounts = new Map(grouped.map(g => [g.webinar_id, g._count._all]));
    }
    const ownScores = new Map<string, number>();
    if (!staff && cubeProfileId) {
      for (const w of (await scoreCubes([cubeProfileId])).get(cubeProfileId) || []) {
        ownScores.set(w.webinar_id, w.result.score);
      }
    }

    const now = new Date();
    return res.json(
      webinars.map(w => {
        const { meeting_url, ...rest } = withSpeakers(w);
        return {
          ...rest,
          // The join link is only handed out once the webinar is published.
          meeting_url: staff || w.status === WebinarStatus.Published ? meeting_url : null,
          question_window: questionWindow(w, now),
          question_count: w._count.questions,
          my_question_count: staff ? undefined : ownCounts.get(w.id) || 0,
          my_score: staff ? undefined : ownScores.get(w.id) ?? null
        };
      })
    );
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/webinars/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const staff = isStaffRole(req.user?.role);
    const cubeProfileId = req.user?.cubeProfileId;

    const webinar = await prisma.webinar.findUnique({
      where: { id: req.params.id },
      include: speakerInclude
    });
    if (!webinar) throw notFound('Webinar not found');
    if (!staff && !canCubeSee(webinar, cubeProfileId)) {
      throw forbidden('You were not invited to this webinar.');
    }

    const base = {
      ...withSpeakers(webinar),
      question_window: questionWindow(webinar)
    };

    if (staff) {
      const [questions, cubes, attendance] = await Promise.all([
        prisma.webinarQuestion.findMany({
          where: { webinar_id: webinar.id },
          include: {
            cube: {
              select: { id: true, cube_number: true, avatar_url: true, user: { select: { name: true } } }
            },
            _count: { select: { votes: true } }
          },
          orderBy: { created_at: 'asc' }
        }),
        requiredCubes(webinar),
        prisma.webinarAttendance.findMany({ where: { webinar_id: webinar.id } })
      ]);
      const byCube = new Map<string, typeof questions>();
      questions.forEach(q => byCube.set(q.cube_id, [...(byCube.get(q.cube_id) || []), q]));
      const attendanceBy = new Map(attendance.map(a => [a.cube_id, a]));

      // Everyone expected now, plus anyone recorded earlier who has since left
      // the invite list or the programme, so a saved record never disappears.
      const roster: { id: string; cube_number: string | null; avatar_url: string | null; name: string }[] =
        cubes.map(c => ({ id: c.id, cube_number: c.cube_number, avatar_url: c.avatar_url, name: c.user?.name || 'Unknown' }));
      const missing = attendance.filter(a => !roster.some(r => r.id === a.cube_id)).map(a => a.cube_id);
      if (missing.length > 0) {
        const extra = await prisma.cubeProfile.findMany({
          where: { id: { in: missing } },
          select: { id: true, cube_number: true, avatar_url: true, user: { select: { name: true } } }
        });
        extra.forEach(c => roster.push({ id: c.id, cube_number: c.cube_number, avatar_url: c.avatar_url, name: c.user?.name || 'Unknown' }));
      }

      const completed = webinar.status === WebinarStatus.Completed;
      const participation = roster.map(c => {
        const att = attendanceBy.get(c.id) || null;
        const own = byCube.get(c.id) || [];
        return {
          cube_id: c.id,
          cube_number: c.cube_number,
          name: c.name,
          avatar_url: c.avatar_url,
          question_count: own.length,
          attendance: att,
          score: completed ? scoreWebinar(own, att) : null
        };
      });
      const scored = participation.map(p => p.score).filter(Boolean) as NonNullable<(typeof participation)[number]['score']>[];

      return res.json({
        ...base,
        questions: questions.map(({ _count, ...q }) => ({ ...q, vote_count: _count.votes })),
        participation,
        attendance_taken: attendance.length > 0,
        engagement: completed ? summarizeEngagement(scored) : null,
        recovery_deadline: completed ? recoveryDeadline(webinar) : null
      });
    }

    const me = cubeProfileId || '';
    const ownRows = await prisma.webinarQuestion.findMany({
      where: { webinar_id: webinar.id, cube_id: me },
      include: { _count: { select: { votes: true } } },
      orderBy: { created_at: 'asc' }
    });
    const own = ownRows.map(({ _count, ...q }) => ({ ...q, vote_count: _count.votes }));

    // Others' questions are revealed only after the Cube has sent one, so
    // nobody can copy instead of thinking. They are always anonymous: no
    // names, and who voted is never exposed.
    let others: { id: string; body: string; created_at: Date; vote_count: number; voted: boolean }[] = [];
    if (own.length > 0) {
      const rows = await prisma.webinarQuestion.findMany({
        where: { webinar_id: webinar.id, cube_id: { not: me } },
        select: {
          id: true,
          body: true,
          created_at: true,
          _count: { select: { votes: true } },
          votes: { where: { cube_id: me }, select: { cube_id: true } }
        },
        orderBy: { created_at: 'asc' }
      });
      others = rows.map(r => ({
        id: r.id,
        body: r.body,
        created_at: r.created_at,
        vote_count: r._count.votes,
        voted: r.votes.length > 0
      }));
    }
    const [total, attendance] = await Promise.all([
      prisma.webinarQuestion.count({ where: { webinar_id: webinar.id } }),
      prisma.webinarAttendance.findUnique({
        where: { webinar_id_cube_id: { webinar_id: webinar.id, cube_id: me } },
        select: {
          id: true,
          status: true,
          recovery_note: true,
          recovery_status: true,
          recovery_submitted_at: true,
          recovery_reviewed_at: true,
          recovery_feedback: true
        }
      })
    ]);
    const completed = webinar.status === WebinarStatus.Completed;

    return res.json({
      ...base,
      // Staff-only fields that are not meant for Cubes.
      question_groups: undefined,
      deadline_reminder_sent_at: undefined,
      start_reminder_sent_at: undefined,
      invited_cube_ids: undefined,
      meeting_url: webinar.status === WebinarStatus.Published ? webinar.meeting_url : null,
      my_questions: own,
      other_questions: others,
      question_count: total,
      others_locked: own.length === 0,
      my_attendance: completed ? attendance : null,
      my_result: completed ? scoreWebinar(own, attendance) : null,
      can_recover: canSubmitRecovery(webinar, attendance),
      recovery_deadline: completed ? recoveryDeadline(webinar) : null
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/webinars', requireAuth, isMentorOrAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const fields = parseWebinarFields(req.body);
    if (!fields.title) throw badRequest('Title is required.');
    const schedule = parseSchedule(req.body.date, req.body.questions_close_at);
    const speakerIds = await parseSpeakerIds(req.body.speaker_ids);
    const invited: string[] = Array.isArray(req.body.invited_cube_ids) ? req.body.invited_cube_ids : [];
    await assertCubesAreActive(invited, 'be invited to a webinar');

    const webinar = await prisma.webinar.create({
      data: {
        ...fields,
        title: fields.title,
        ...schedule,
        invited_cube_ids: invited,
        created_by_id: req.user?.id,
        speakers: { create: speakerIds.map((speaker_id, position) => ({ speaker_id, position })) }
      },
      include: speakerInclude
    });
    return res.status(201).json(withSpeakers(webinar));
  } catch (error) {
    return sendError(res, error);
  }
});

router.put('/webinars/:id', requireAuth, isMentorOrAdmin, async (req, res) => {
  try {
    const existing = await prisma.webinar.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Webinar not found');

    const fields = parseWebinarFields(req.body);
    if (!fields.title) throw badRequest('Title is required.');
    const schedule = parseSchedule(req.body.date, req.body.questions_close_at);
    const speakerIds = await parseSpeakerIds(req.body.speaker_ids);
    const invited: string[] = Array.isArray(req.body.invited_cube_ids)
      ? req.body.invited_cube_ids
      : existing.invited_cube_ids;
    await assertCubesAreActive(invited, 'be invited to a webinar');

    const webinar = await prisma.$transaction(async tx => {
      await tx.webinarSpeaker.deleteMany({ where: { webinar_id: existing.id } });
      return tx.webinar.update({
        where: { id: existing.id },
        data: {
          ...fields,
          title: fields.title!,
          ...schedule,
          invited_cube_ids: invited,
          speakers: { create: speakerIds.map((speaker_id, position) => ({ speaker_id, position })) }
        },
        include: speakerInclude
      });
    });
    if (webinar.status === WebinarStatus.Completed && !existing.recording_url && webinar.recording_url) {
      await notifyRecoveryOpen(webinar);
    }
    return res.json(withSpeakers(webinar));
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/webinars/:id/publish', requireAuth, isMentorOrAdmin, async (req, res) => {
  try {
    const webinar = await prisma.webinar.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { speakers: true } } }
    });
    if (!webinar) throw notFound('Webinar not found');
    if (webinar.status !== WebinarStatus.Draft) throw badRequest('Only a draft can be published.');
    if (webinar._count.speakers === 0) throw badRequest('Add at least one speaker before publishing.');
    if (webinar.date.getTime() <= Date.now()) throw badRequest('The webinar date is in the past.');

    const updated = await prisma.webinar.update({
      where: { id: webinar.id },
      data: { status: WebinarStatus.Published, published_at: new Date() }
    });

    if (req.body?.notify !== false) {
      const cubes = await requiredCubes(webinar);
      await notifyUsers(
        cubes.map(c => c.user.id),
        `New webinar: "${webinar.title}". Send at least one question for the speaker on the Webinars page.`
      );
    }
    return res.json(updated);
  } catch (error) {
    return sendError(res, error);
  }
});

/** Completes or cancels a published webinar, or reopens a cancelled one as a draft. */
router.patch('/webinars/:id/status', requireAuth, isMentorOrAdmin, async (req, res) => {
  try {
    const webinar = await prisma.webinar.findUnique({ where: { id: req.params.id } });
    if (!webinar) throw notFound('Webinar not found');

    const next = req.body?.status as WebinarStatus;
    const allowed: Partial<Record<WebinarStatus, WebinarStatus[]>> = {
      [WebinarStatus.Published]: [WebinarStatus.Completed, WebinarStatus.Cancelled],
      [WebinarStatus.Cancelled]: [WebinarStatus.Draft],
      [WebinarStatus.Completed]: [WebinarStatus.Published]
    };
    if (!(allowed[webinar.status] || []).includes(next)) {
      throw badRequest(`A ${webinar.status} webinar cannot be moved to ${next || 'that status'}.`);
    }

    const updated = await prisma.webinar.update({
      where: { id: webinar.id },
      data: {
        status: next,
        completed_at: next === WebinarStatus.Completed ? new Date() : null
      }
    });
    // Completing or reopening changes which webinars count for scores and quests.
    const recorded = await prisma.webinarAttendance.findMany({
      where: { webinar_id: webinar.id },
      select: { cube_id: true }
    });
    refreshQuests(recorded.map(r => r.cube_id), `webinar ${webinar.id} status change`);
    return res.json(updated);
  } catch (error) {
    return sendError(res, error);
  }
});

router.delete('/webinars/:id', requireAuth, isMentorOrAdmin, async (req, res) => {
  try {
    const webinar = await prisma.webinar.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { questions: true } } }
    });
    if (!webinar) throw notFound('Webinar not found');
    if (webinar._count.questions > 0 && req.query.force !== 'true') {
      throw conflict(
        `This webinar has ${webinar._count.questions} question(s) from Cubes. Deleting it removes them too.`,
        { requiresForce: true, questionCount: webinar._count.questions }
      );
    }
    await prisma.webinar.delete({ where: { id: webinar.id } });
    return res.json({ message: 'Webinar deleted' });
  } catch (error) {
    return sendError(res, error);
  }
});

/** Notifies every invited Cube that has not sent a question yet. */
router.post('/webinars/:id/remind', requireAuth, isMentorOrAdmin, async (req, res) => {
  try {
    const webinar = await prisma.webinar.findUnique({ where: { id: req.params.id } });
    if (!webinar) throw notFound('Webinar not found');
    const window = questionWindow(webinar);
    if (window !== 'open' && window !== 'late') throw badRequest('Questions are not open for this webinar.');

    const [cubes, asked] = await Promise.all([requiredCubes(webinar), cubesWithQuestions(webinar.id)]);
    const missing = cubes.filter(c => !asked.has(c.id));
    await notifyUsers(
      missing.map(c => c.user.id),
      `Reminder: you have not sent a question for the "${webinar.title}" webinar yet. At least one question is required.`
    );
    return res.json({ reminded: missing.length });
  } catch (error) {
    return sendError(res, error);
  }
});

/** Anonymous, numbered question list to share with the speaker. */
router.get('/webinars/:id/speaker-export', requireAuth, isMentorOrAdmin, async (req, res) => {
  try {
    const webinar = await prisma.webinar.findUnique({ where: { id: req.params.id } });
    if (!webinar) throw notFound('Webinar not found');
    const rows = await prisma.webinarQuestion.findMany({
      where: { webinar_id: webinar.id },
      select: { id: true, body: true, is_late: true, _count: { select: { votes: true } } },
      orderBy: { created_at: 'asc' }
    });
    const questions = rows.map(r => ({ id: r.id, body: r.body, is_late: r.is_late, votes: r._count.votes }));
    const groups = Array.isArray(webinar.question_groups)
      ? (webinar.question_groups as unknown as QuestionGroup[])
      : null;
    return res.json({ text: formatQuestionsForSpeaker(webinar.title, questions, groups) });
  } catch (error) {
    return sendError(res, error);
  }
});

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

router.post('/webinars/:id/questions', requireAuth, isCube, async (req: AuthenticatedRequest, res) => {
  try {
    const cubeProfileId = req.user?.cubeProfileId;
    if (!cubeProfileId) throw forbidden('Only Cubes can send questions.');

    const webinar = await prisma.webinar.findUnique({ where: { id: req.params.id } });
    if (!webinar || !canCubeSee(webinar, cubeProfileId)) throw notFound('Webinar not found');
    if (!(await isCubeActive(cubeProfileId))) throw forbidden('Only Cubes in the programme can send questions.');

    const window = questionWindow(webinar);
    if (window !== 'open' && window !== 'late') throw badRequest('Questions are closed for this webinar.');

    const body = parseQuestionBody(req.body?.body);
    const count = await prisma.webinarQuestion.count({
      where: { webinar_id: webinar.id, cube_id: cubeProfileId }
    });
    if (count >= MAX_QUESTIONS_PER_CUBE) {
      throw badRequest(`You can send at most ${MAX_QUESTIONS_PER_CUBE} questions per webinar.`);
    }

    const question = await prisma.webinarQuestion.create({
      data: { webinar_id: webinar.id, cube_id: cubeProfileId, body, is_late: window === 'late' }
    });
    return res.status(201).json(question);
  } catch (error) {
    return sendError(res, error);
  }
});

/** Loads a question the requesting Cube owns, while editing is still allowed. */
async function loadOwnEditableQuestion(id: string, cubeProfileId?: string) {
  const question = await prisma.webinarQuestion.findUnique({
    where: { id },
    include: { webinar: true }
  });
  if (!question || !cubeProfileId || question.cube_id !== cubeProfileId) {
    throw notFound('Question not found');
  }
  if (questionWindow(question.webinar) !== 'open') {
    throw badRequest('The question deadline has passed; questions can no longer be changed.');
  }
  return question;
}

router.put('/webinar-questions/:id', requireAuth, isCube, async (req: AuthenticatedRequest, res) => {
  try {
    const question = await loadOwnEditableQuestion(req.params.id, req.user?.cubeProfileId);
    const updated = await prisma.webinarQuestion.update({
      where: { id: question.id },
      data: { body: parseQuestionBody(req.body?.body) }
    });
    return res.json(updated);
  } catch (error) {
    return sendError(res, error);
  }
});

router.delete('/webinar-questions/:id', requireAuth, isCube, async (req: AuthenticatedRequest, res) => {
  try {
    const question = await loadOwnEditableQuestion(req.params.id, req.user?.cubeProfileId);
    await prisma.webinarQuestion.delete({ where: { id: question.id } });
    return res.json({ message: 'Question deleted' });
  } catch (error) {
    return sendError(res, error);
  }
});

/** Staff flags used later for scoring: asked live, strong question. */
router.patch('/webinar-questions/:id/flags', requireAuth, isMentorOrAdmin, async (req, res) => {
  try {
    const existing = await prisma.webinarQuestion.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Question not found');
    const data: { asked_live?: boolean; is_strong?: boolean } = {};
    if (typeof req.body?.asked_live === 'boolean') data.asked_live = req.body.asked_live;
    if (typeof req.body?.is_strong === 'boolean') data.is_strong = req.body.is_strong;
    const updated = await prisma.webinarQuestion.update({ where: { id: existing.id }, data });
    if (data.is_strong !== undefined && data.is_strong !== existing.is_strong) {
      refreshQuests([existing.cube_id], 'a question flag change');
    }
    return res.json(updated);
  } catch (error) {
    return sendError(res, error);
  }
});

// ---------------------------------------------------------------------------
// Upvotes
// ---------------------------------------------------------------------------

/** Toggles the Cube's upvote on another Cube's question, while questions are open. */
router.post('/webinar-questions/:id/vote', requireAuth, isCube, async (req: AuthenticatedRequest, res) => {
  try {
    const me = req.user?.cubeProfileId;
    if (!me) throw forbidden('Only Cubes can upvote questions.');
    const question = await prisma.webinarQuestion.findUnique({
      where: { id: req.params.id },
      include: { webinar: true }
    });
    if (!question || !canCubeSee(question.webinar, me)) throw notFound('Question not found');
    if (question.cube_id === me) throw badRequest('You cannot upvote your own question.');
    const window = questionWindow(question.webinar);
    if (window !== 'open' && window !== 'late') throw badRequest('Voting has closed for this webinar.');
    const asked = await prisma.webinarQuestion.count({
      where: { webinar_id: question.webinar_id, cube_id: me }
    });
    if (asked === 0) throw forbidden('Send your own question first.');

    const key = { question_id_cube_id: { question_id: question.id, cube_id: me } };
    const existing = await prisma.webinarQuestionVote.findUnique({ where: key });
    if (existing) await prisma.webinarQuestionVote.delete({ where: key });
    else await prisma.webinarQuestionVote.create({ data: { question_id: question.id, cube_id: me } });

    const vote_count = await prisma.webinarQuestionVote.count({ where: { question_id: question.id } });
    return res.json({ voted: !existing, vote_count });
  } catch (error) {
    return sendError(res, error);
  }
});

// ---------------------------------------------------------------------------
// AI themes
// ---------------------------------------------------------------------------

router.post('/webinars/:id/question-groups', requireAuth, isMentorOrAdmin, async (req, res) => {
  try {
    const webinar = await prisma.webinar.findUnique({ where: { id: req.params.id } });
    if (!webinar) throw notFound('Webinar not found');
    const questions = await prisma.webinarQuestion.findMany({
      where: { webinar_id: webinar.id },
      select: { id: true, body: true },
      orderBy: { created_at: 'asc' }
    });
    if (questions.length < MIN_QUESTIONS_TO_GROUP) {
      throw badRequest(`At least ${MIN_QUESTIONS_TO_GROUP} questions are needed to group them into themes.`);
    }
    const groups = await generateWebinarQuestionGroups(webinar.title, questions);
    if (!groups) throw new HttpError(503, 'AI grouping is not available right now. Try again later.');

    const updated = await prisma.webinar.update({
      where: { id: webinar.id },
      data: { question_groups: groups as unknown as Prisma.InputJsonValue, question_groups_at: new Date() },
      select: { question_groups: true, question_groups_at: true }
    });
    return res.json(updated);
  } catch (error) {
    return sendError(res, error);
  }
});

router.delete('/webinars/:id/question-groups', requireAuth, isMentorOrAdmin, async (req, res) => {
  try {
    const webinar = await prisma.webinar.findUnique({ where: { id: req.params.id } });
    if (!webinar) throw notFound('Webinar not found');
    await prisma.webinar.update({
      where: { id: webinar.id },
      data: { question_groups: Prisma.DbNull, question_groups_at: null }
    });
    return res.json({ question_groups: null, question_groups_at: null });
  } catch (error) {
    return sendError(res, error);
  }
});

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

/**
 * Saves attendance. With `complete: true` it also closes the webinar, which
 * makes the scores final and tells every Cube their result.
 */
router.put('/webinars/:id/attendance', requireAuth, isMentorOrAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const webinar = await prisma.webinar.findUnique({ where: { id: req.params.id } });
    if (!webinar) throw notFound('Webinar not found');
    if (webinar.status !== WebinarStatus.Published && webinar.status !== WebinarStatus.Completed) {
      throw badRequest('Attendance can only be taken for a published or completed webinar.');
    }
    if (webinar.date.getTime() > Date.now()) {
      throw badRequest('Attendance can be taken once the webinar has started.');
    }
    if (!Array.isArray(req.body?.attendance) || req.body.attendance.length === 0) {
      throw badRequest('attendance must be a non-empty list.');
    }

    const [expected, existing] = await Promise.all([
      requiredCubes(webinar),
      prisma.webinarAttendance.findMany({ where: { webinar_id: webinar.id }, select: { cube_id: true } })
    ]);
    const allowed = new Set([...expected.map(c => c.id), ...existing.map(e => e.cube_id)]);

    const rows = new Map<string, { status: ReturnType<typeof parseAttendanceStatus>; note: string | null }>();
    for (const item of req.body.attendance) {
      const cubeId = typeof item?.cube_id === 'string' ? item.cube_id : '';
      if (!allowed.has(cubeId)) throw badRequest('Attendance includes a Cube who is not part of this webinar.');
      rows.set(cubeId, { status: parseAttendanceStatus(item.status), note: str(item.note, 1000) });
    }

    const complete = req.body?.complete === true && webinar.status === WebinarStatus.Published;
    if (complete) {
      const recorded = new Set([...existing.map(e => e.cube_id), ...rows.keys()]);
      const unmarked = expected.filter(c => !recorded.has(c.id));
      if (unmarked.length > 0) {
        throw badRequest(`Mark attendance for every Cube before closing the webinar (${unmarked.length} missing).`);
      }
    }

    const recordedBy = req.user?.id || null;
    await prisma.$transaction(async tx => {
      for (const [cube_id, row] of rows) {
        await tx.webinarAttendance.upsert({
          where: { webinar_id_cube_id: { webinar_id: webinar.id, cube_id } },
          update: { status: row.status, note: row.note, recorded_by_id: recordedBy },
          create: { webinar_id: webinar.id, cube_id, status: row.status, note: row.note, recorded_by_id: recordedBy }
        });
      }
      if (complete) {
        await tx.webinar.update({
          where: { id: webinar.id },
          data: { status: WebinarStatus.Completed, completed_at: new Date() }
        });
      }
    });

    const affected = [...rows.keys()];
    refreshQuests(affected, `attendance for webinar ${webinar.id}`);

    if (complete) {
      const closed = await prisma.webinar.findUniqueOrThrow({ where: { id: webinar.id } });
      await notifyResults(closed);
      if (closed.recording_url) await notifyRecoveryOpen(closed);
    }
    return res.json({ saved: rows.size, status: complete ? WebinarStatus.Completed : webinar.status });
  } catch (error) {
    return sendError(res, error);
  }
});

/** Tells each scored Cube their result once the webinar is closed. */
async function notifyResults(webinar: { id: string; title: string }) {
  try {
    const attendance = await prisma.webinarAttendance.findMany({
      where: { webinar_id: webinar.id },
      select: { cube_id: true, cube: { select: { user_id: true } } }
    });
    const scores = await scoreCubes(attendance.map(a => a.cube_id));
    const data = attendance
      .map(a => {
        const result = (scores.get(a.cube_id) || []).find(w => w.webinar_id === webinar.id)?.result;
        return result
          ? { user_id: a.cube.user_id, message: `The "${webinar.title}" webinar is closed. Your webinar score: ${result.score}/100.` }
          : null;
      })
      .filter(Boolean) as { user_id: string; message: string }[];
    if (data.length > 0) await prisma.notification.createMany({ data });
  } catch (err) {
    console.error('Failed to send webinar result notifications:', err);
  }
}

// ---------------------------------------------------------------------------
// Recovery: an absent Cube watches the recording and writes what they learned
// ---------------------------------------------------------------------------

router.post('/webinars/:id/recovery', requireAuth, isCube, async (req: AuthenticatedRequest, res) => {
  try {
    const me = req.user?.cubeProfileId;
    if (!me) throw forbidden('Only Cubes can send a recovery note.');
    const webinar = await prisma.webinar.findUnique({ where: { id: req.params.id } });
    if (!webinar || !canCubeSee(webinar, me)) throw notFound('Webinar not found');
    const attendance = await prisma.webinarAttendance.findUnique({
      where: { webinar_id_cube_id: { webinar_id: webinar.id, cube_id: me } }
    });
    if (!canSubmitRecovery(webinar, attendance)) {
      if (!attendance || attendance.status !== 'Absent') throw badRequest('Recovery is only for Cubes who missed the webinar.');
      if (attendance.recovery_status === 'Approved') throw badRequest('Your recovery note was already approved.');
      if (!webinar.recording_url) throw badRequest('The recording is not available yet.');
      throw badRequest('The recovery window for this webinar has closed.');
    }

    const updated = await prisma.webinarAttendance.update({
      where: { id: attendance!.id },
      data: {
        recovery_note: parseRecoveryNote(req.body?.note),
        recovery_status: 'Pending',
        recovery_submitted_at: new Date(),
        recovery_reviewed_at: null,
        recovery_reviewed_by_id: null,
        recovery_feedback: null
      },
      select: {
        id: true,
        status: true,
        recovery_note: true,
        recovery_status: true,
        recovery_submitted_at: true,
        recovery_reviewed_at: true,
        recovery_feedback: true
      }
    });
    if (webinar.created_by_id) {
      await notifyUsers(
        [webinar.created_by_id],
        `A Cube sent a recovery note for the "${webinar.title}" webinar. Review it on the webinar page.`
      );
    }
    return res.json(updated);
  } catch (error) {
    return sendError(res, error);
  }
});

router.patch('/webinar-attendance/:id/recovery', requireAuth, isMentorOrAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const attendance = await prisma.webinarAttendance.findUnique({
      where: { id: req.params.id },
      include: { webinar: { select: { title: true } }, cube: { select: { user_id: true } } }
    });
    if (!attendance) throw notFound('Attendance record not found');
    if (!attendance.recovery_note) throw badRequest('There is no recovery note to review.');
    const decision = req.body?.decision;
    if (decision !== 'Approved' && decision !== 'Rejected') {
      throw badRequest('decision must be Approved or Rejected.');
    }
    const feedback = str(req.body?.feedback, 2000);

    const updated = await prisma.webinarAttendance.update({
      where: { id: attendance.id },
      data: {
        recovery_status: decision,
        recovery_feedback: feedback,
        recovery_reviewed_at: new Date(),
        recovery_reviewed_by_id: req.user?.id || null
      }
    });
    await notifyUsers(
      [attendance.cube.user_id],
      decision === 'Approved'
        ? `Your recovery note for "${attendance.webinar.title}" was approved. Part of your attendance points are back.`
        : `Your recovery note for "${attendance.webinar.title}" needs more work.${feedback ? ` Feedback: ${feedback}` : ''} You can send it again.`
    );
    refreshQuests([attendance.cube_id], 'a recovery review');
    return res.json(updated);
  } catch (error) {
    return sendError(res, error);
  }
});

// ---------------------------------------------------------------------------
// Engagement (a separate metric; not part of the overall performance score)
// ---------------------------------------------------------------------------

router.get('/webinar-engagement/me', requireAuth, isCube, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user?.cubeProfileId) throw forbidden('Only Cubes have a webinar score.');
    return res.json(await cubeEngagement(req.user.cubeProfileId));
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/webinar-engagement/cubes/:cubeId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const own = req.user?.cubeProfileId === req.params.cubeId;
    if (!own && !isStaffRole(req.user?.role)) throw forbidden('You can only see your own webinar score.');
    return res.json(await cubeEngagement(req.params.cubeId));
  } catch (error) {
    return sendError(res, error);
  }
});

/** Every Cube in the programme with their webinar summary. */
router.get('/webinar-engagement', requireAuth, isMentorOrAdmin, async (_req, res) => {
  try {
    const cubes = await prisma.cubeProfile.findMany({
      where: { current_level: { in: IN_PROGRAMME_CUBE_LEVELS } },
      select: { id: true, cube_number: true, avatar_url: true, user: { select: { name: true } } },
      orderBy: { cube_number: 'asc' }
    });
    const scores = await scoreCubes(cubes.map(c => c.id));
    return res.json(
      cubes.map(c => ({
        cube_id: c.id,
        cube_number: c.cube_number,
        avatar_url: c.avatar_url,
        name: c.user?.name || 'Unknown',
        summary: summarizeEngagement((scores.get(c.id) || []).map(w => w.result))
      }))
    );
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
