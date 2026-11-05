/**
 * Webinars with guest speakers, and the questions Cubes send before them.
 *
 * Visibility: drafts are staff-only. A published webinar is visible to the
 * Cubes it invites (an empty invite list means every Cube in the programme).
 *
 * Questions: every invited Cube must send at least one. Other Cubes'
 * questions are shown only after the requester has sent their own, and always
 * without names. Staff see names; the list sent to the speaker is anonymous.
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
import { badRequest, conflict, forbidden, notFound, sendError } from '../utils/http';
import { assertCubesAreActive, isCubeActive } from '../services/cubeStatus.service';
import { IN_PROGRAMME_CUBE_LEVELS } from '../config/constants';
import { StorageService } from '../services/storage.service';
import {
  MAX_QUESTIONS_PER_CUBE,
  formatQuestionsForSpeaker,
  parseCareer,
  parseExpertise,
  parseHttpUrl,
  parseQuestionBody,
  parseSchedule,
  questionWindow
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

/** Cubes expected to send a question: the invite list, or every active Cube. */
async function requiredCubes(webinar: { invited_cube_ids: string[] }) {
  const invited = webinar.invited_cube_ids || [];
  return prisma.cubeProfile.findMany({
    where: {
      current_level: { in: IN_PROGRAMME_CUBE_LEVELS },
      ...(invited.length > 0 ? { id: { in: invited } } : {})
    },
    select: {
      id: true,
      cube_number: true,
      avatar_url: true,
      user: { select: { id: true, name: true } }
    },
    orderBy: { cube_number: 'asc' }
  });
}

async function notifyCubes(userIds: string[], message: string) {
  if (userIds.length === 0) return;
  try {
    await prisma.notification.createMany({
      data: userIds.map(user_id => ({ user_id, message }))
    });
  } catch (err) {
    console.error('Failed to create webinar notifications:', err);
  }
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
          my_question_count: staff ? undefined : ownCounts.get(w.id) || 0
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
      const [questions, cubes] = await Promise.all([
        prisma.webinarQuestion.findMany({
          where: { webinar_id: webinar.id },
          include: {
            cube: {
              select: { id: true, cube_number: true, avatar_url: true, user: { select: { name: true } } }
            }
          },
          orderBy: { created_at: 'asc' }
        }),
        requiredCubes(webinar)
      ]);
      const askedBy = new Map<string, number>();
      questions.forEach(q => askedBy.set(q.cube_id, (askedBy.get(q.cube_id) || 0) + 1));
      return res.json({
        ...base,
        questions,
        participation: cubes.map(c => ({
          cube_id: c.id,
          cube_number: c.cube_number,
          name: c.user?.name || 'Unknown',
          avatar_url: c.avatar_url,
          question_count: askedBy.get(c.id) || 0
        }))
      });
    }

    const own = await prisma.webinarQuestion.findMany({
      where: { webinar_id: webinar.id, cube_id: cubeProfileId || '' },
      orderBy: { created_at: 'asc' }
    });

    // Others' questions are revealed only after the Cube has sent one, so
    // nobody can copy instead of thinking. They are always anonymous.
    let others: { id: string; body: string; created_at: Date }[] = [];
    if (own.length > 0) {
      others = await prisma.webinarQuestion.findMany({
        where: { webinar_id: webinar.id, cube_id: { not: cubeProfileId || '' } },
        select: { id: true, body: true, created_at: true },
        orderBy: { created_at: 'asc' }
      });
    }
    const total = await prisma.webinarQuestion.count({ where: { webinar_id: webinar.id } });

    return res.json({
      ...base,
      meeting_url: webinar.status === WebinarStatus.Published ? webinar.meeting_url : null,
      my_questions: own,
      other_questions: others,
      question_count: total,
      others_locked: own.length === 0
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
      await notifyCubes(
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

    const updated = await prisma.webinar.update({ where: { id: webinar.id }, data: { status: next } });
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

    const [cubes, askers] = await Promise.all([
      requiredCubes(webinar),
      prisma.webinarQuestion.findMany({
        where: { webinar_id: webinar.id },
        select: { cube_id: true },
        distinct: ['cube_id']
      })
    ]);
    const asked = new Set(askers.map(a => a.cube_id));
    const missing = cubes.filter(c => !asked.has(c.id));
    await notifyCubes(
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
    const questions = await prisma.webinarQuestion.findMany({
      where: { webinar_id: webinar.id },
      select: { body: true, is_late: true },
      orderBy: { created_at: 'asc' }
    });
    return res.json({ text: formatQuestionsForSpeaker(webinar.title, questions) });
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
    return res.json(updated);
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
