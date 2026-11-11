/**
 * Recruitment pipeline: send a case through a single-use public link, collect
 * the candidate's answers, get an AI scoring suggestion, and let an admin
 * confirm or override it. AI only suggests; every decision is made by a person.
 */
import { Router } from 'express';
import prisma from '../services/prisma';
import { requireAuth, isAdmin, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { rateLimit } from '../middlewares/rateLimit.middleware';
import { sendError, badRequest, notFound, conflict } from '../utils/http';
import { generateInviteToken, hashInviteToken } from '../services/invite.service';
import { resolvePublicOrigin } from '../config/env';
import { generateCaseEvaluation } from '../services/ai.service';
import {
  CASE_DECISIONS,
  CASE_QUESTIONS,
  CASE_SCENARIO,
  RUBRIC,
  CaseDecisionValue,
  parseAnswers,
  parseRubricScores
} from '../services/caseEvaluation';
import { CaseDecision, RecruitmentStage } from '@prisma/client';

const router = Router();

const CASE_DEFAULT_DAYS = 7;
const CASE_MAX_DAYS = 30;

const caseLookupRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: 'Too many attempts. Please try again in a few minutes.'
});
const caseSubmitRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many submissions. Please try again later.'
});

/** Admin view of a case without the token hash or the raw answers. */
const caseSummarySelect = {
  expires_at: true,
  created_at: true,
  consent_at: true,
  submitted_at: true,
  ai_model: true,
  ai_scored_at: true,
  ai_scores: true,
  ai_reduction: true,
  ai_interview_focus: true,
  final_scores: true,
  decision: true,
  reviewer_note: true,
  reviewed_at: true
} as const;

const unusableLink = () => notFound('This link is invalid or has expired.');

async function findOpenCase(token: string) {
  if (!token) return null;
  const found = await prisma.applicationCase.findUnique({
    where: { token_hash: hashInviteToken(token) },
    include: { application: { select: { id: true, name: true, status: true, university: true, degree: true, year_of_study: true } } }
  });
  if (!found || found.submitted_at || found.expires_at.getTime() < Date.now()) return null;
  if (found.application.status !== 'pending') return null;
  return found;
}

/**
 * Runs the AI suggestion for a submitted case. Safe to call again; returns
 * false when AI is unavailable so the case stays open for manual scoring.
 */
async function runEvaluation(caseId: string): Promise<boolean> {
  const record = await prisma.applicationCase.findUnique({
    where: { id: caseId },
    include: { application: { select: { id: true, university: true, degree: true, year_of_study: true, stage: true } } }
  });
  if (!record || !record.submitted_at || !record.answers) return false;

  const evaluation = await generateCaseEvaluation(record.answers as Record<string, string>, {
    university: record.application.university,
    degree: record.application.degree,
    year_of_study: record.application.year_of_study
  });
  if (!evaluation) return false;

  await prisma.$transaction(async tx => {
    await tx.applicationCase.update({
      where: { id: caseId },
      data: {
        ai_model: evaluation.model,
        ai_scored_at: new Date(),
        ai_scores: evaluation.scores,
        ai_reduction: evaluation.reduction,
        ai_interview_focus: evaluation.interviewFocus
      }
    });
    await tx.cubeApplication.updateMany({
      where: { id: record.application.id, stage: RecruitmentStage.CaseSubmitted },
      data: { stage: RecruitmentStage.Evaluated }
    });
  });
  return true;
}

// ---------------------------------------------------------------------------
// Public: candidate-facing case
// ---------------------------------------------------------------------------

router.get('/case/:token', caseLookupRateLimit, async (req, res) => {
  try {
    const found = await findOpenCase(req.params.token);
    if (!found) throw unusableLink();
    return res.json({
      name: found.application.name,
      expiresAt: found.expires_at,
      scenario: CASE_SCENARIO,
      questions: CASE_QUESTIONS
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/case/:token/submit', caseSubmitRateLimit, async (req, res) => {
  try {
    const found = await findOpenCase(req.params.token);
    if (!found) throw unusableLink();

    if (req.body?.consent !== true) {
      throw badRequest('You must agree to AI-assisted evaluation to submit your case.');
    }
    let answers: Record<string, string>;
    try {
      answers = parseAnswers(req.body?.answers);
    } catch (e: any) {
      throw badRequest(e.message);
    }
    if (!Object.values(answers).some(a => a.length > 0)) throw badRequest('Please answer at least one question.');

    const now = new Date();
    // Re-check submitted_at inside the write so a double submit cannot win twice.
    const claimed = await prisma.$transaction(async tx => {
      const result = await tx.applicationCase.updateMany({
        where: { id: found.id, submitted_at: null },
        data: { submitted_at: now, consent_at: now, answers }
      });
      if (result.count === 0) return false;
      await tx.cubeApplication.update({
        where: { id: found.application_id },
        data: { stage: RecruitmentStage.CaseSubmitted }
      });
      return true;
    });
    if (!claimed) throw conflict('This case has already been submitted.');

    // Respond first; scoring can take a while and the candidate does not need it.
    void runEvaluation(found.id).catch(() => console.error('[recruitment-case] evaluation failed'));

    return res.status(201).json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

router.get('/admin/recruitment/rubric', requireAuth, isAdmin, (_req, res) => {
  res.json({ rubric: RUBRIC, questions: CASE_QUESTIONS });
});

router.get('/admin/recruitment/candidates', requireAuth, isAdmin, async (_req, res) => {
  try {
    const candidates = await prisma.cubeApplication.findMany({
      where: { status: 'pending' },
      orderBy: { created_at: 'desc' },
      include: { case: { select: caseSummarySelect } }
    });
    return res.json(candidates);
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/admin/recruitment/candidates/:id', requireAuth, isAdmin, async (req, res) => {
  try {
    const candidate = await prisma.cubeApplication.findUnique({
      where: { id: req.params.id },
      include: { case: { select: { ...caseSummarySelect, answers: true } } }
    });
    if (!candidate) throw notFound('Application not found');
    return res.json(candidate);
  } catch (error) {
    return sendError(res, error);
  }
});

// Issue (or re-issue) the case link. The raw token is returned only here.
router.post('/admin/recruitment/candidates/:id/case', requireAuth, isAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const application = await prisma.cubeApplication.findUnique({
      where: { id: req.params.id },
      include: { case: { select: { submitted_at: true } } }
    });
    if (!application) throw notFound('Application not found');
    if (application.status !== 'pending') throw badRequest('Only pending applications can receive a case');
    if (application.case?.submitted_at) throw conflict('This candidate has already submitted the case');

    const days = req.body?.days === undefined ? CASE_DEFAULT_DAYS : Number(req.body.days);
    if (!Number.isInteger(days) || days < 1 || days > CASE_MAX_DAYS) {
      throw badRequest(`Days must be a whole number between 1 and ${CASE_MAX_DAYS}`);
    }

    const { token, tokenHash } = generateInviteToken();
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await prisma.$transaction(async tx => {
      await tx.applicationCase.upsert({
        where: { application_id: application.id },
        create: { application_id: application.id, token_hash: tokenHash, expires_at: expiresAt, created_by_id: req.user!.id },
        update: { token_hash: tokenHash, expires_at: expiresAt, created_by_id: req.user!.id }
      });
      // Only move forward from Applied; never pull a later stage back.
      await tx.cubeApplication.updateMany({
        where: { id: application.id, stage: RecruitmentStage.Applied },
        data: { stage: RecruitmentStage.CaseSent }
      });
    });

    return res.status(201).json({
      url: `${resolvePublicOrigin(req)}/case/${token}`,
      expiresAt,
      message: 'No email is sent. Copy this single-use link and send it to the candidate yourself — it is shown only once.'
    });
  } catch (error) {
    return sendError(res, error);
  }
});

// Re-run the AI suggestion (e.g. when it was unavailable on submit).
router.post('/admin/recruitment/candidates/:id/case/evaluate', requireAuth, isAdmin, async (req, res) => {
  try {
    const record = await prisma.applicationCase.findUnique({ where: { application_id: req.params.id } });
    if (!record || !record.submitted_at) throw badRequest('The candidate has not submitted the case yet');
    const ok = await runEvaluation(record.id);
    if (!ok) throw conflict('AI evaluation is unavailable right now. You can score the case manually.');
    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
});

// Confirm or override the scores and record the decision.
router.patch('/admin/recruitment/candidates/:id/review', requireAuth, isAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const record = await prisma.applicationCase.findUnique({ where: { application_id: req.params.id } });
    if (!record || !record.submitted_at) throw badRequest('The candidate has not submitted the case yet');

    const data: Record<string, any> = { reviewed_by_id: req.user!.id, reviewed_at: new Date() };
    const body = req.body || {};

    if (body.scores !== undefined) {
      try {
        data.final_scores = parseRubricScores(body.scores);
      } catch (e: any) {
        throw badRequest(e.message);
      }
    }
    if (body.decision !== undefined) {
      if (body.decision !== null && !CASE_DECISIONS.includes(body.decision as CaseDecisionValue)) throw badRequest('Invalid decision');
      data.decision = body.decision as CaseDecision | null;
    }
    if (body.note !== undefined) {
      if (body.note !== null && typeof body.note !== 'string') throw badRequest('Note must be text');
      const note = (body.note || '').trim();
      if (note.length > 2000) throw badRequest('Note must be at most 2000 characters');
      data.reviewer_note = note || null;
    }
    if (Object.keys(data).length === 2) throw badRequest('Nothing to update');

    await prisma.$transaction(async tx => {
      await tx.applicationCase.update({ where: { id: record.id }, data });
      await tx.cubeApplication.updateMany({
        where: { id: req.params.id, stage: RecruitmentStage.CaseSubmitted },
        data: { stage: RecruitmentStage.Evaluated }
      });
    });
    return res.json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
});

// Move a candidate to a manual stage and keep the interview date/note.
const MANUAL_STAGES: RecruitmentStage[] = [
  RecruitmentStage.Applied,
  RecruitmentStage.Evaluated,
  RecruitmentStage.Interview,
  RecruitmentStage.Offer
];

router.patch('/admin/recruitment/candidates/:id/stage', requireAuth, isAdmin, async (req, res) => {
  try {
    const application = await prisma.cubeApplication.findUnique({ where: { id: req.params.id } });
    if (!application) throw notFound('Application not found');
    if (application.status !== 'pending') throw badRequest('Only pending applications can be moved in the pipeline');

    const body = req.body || {};
    const data: Record<string, any> = {};

    if (body.stage !== undefined) {
      if (!MANUAL_STAGES.includes(body.stage)) throw badRequest('Invalid stage');
      data.stage = body.stage;
    }
    if (body.interview_at !== undefined) {
      if (body.interview_at === null || body.interview_at === '') {
        data.interview_at = null;
      } else {
        const when = new Date(body.interview_at);
        if (Number.isNaN(when.getTime())) throw badRequest('Invalid interview date');
        data.interview_at = when;
      }
    }
    if (body.interview_note !== undefined) {
      if (body.interview_note !== null && typeof body.interview_note !== 'string') throw badRequest('Interview note must be text');
      const note = (body.interview_note || '').trim();
      if (note.length > 2000) throw badRequest('Interview note must be at most 2000 characters');
      data.interview_note = note || null;
    }
    if (Object.keys(data).length === 0) throw badRequest('Nothing to update');

    const updated = await prisma.cubeApplication.update({ where: { id: application.id }, data });
    return res.json({ success: true, application: updated });
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
