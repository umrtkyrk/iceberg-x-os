import prisma from './prisma';
import { BadgeRarity } from '@prisma/client';
import { badRequest, notFound } from '../utils/http';
import { QUIZ_QUESTIONS_EN, MATCHING_ITEMS, QuizQuestionRaw, MatchingItem } from '../data/quizData';
import { createSingleNotification } from './notification.service';
import { recalculateAllQuestsForCube } from './quest.service';

export const QUIZ_SIZE = 20;
export const MATCHING_SIZE = 5;
export const QUIZ_DURATION_SECONDS = 30 * 60; // 30 minutes
export const POINTS_PER_ITEM = 4;

const RARITY_WEIGHT: Record<BadgeRarity, number> = {
  [BadgeRarity.Common]: 1,
  [BadgeRarity.Rare]: 2,
  [BadgeRarity.Epic]: 3
};

/** Quiz badge tiers, ordered highest first. */
export const QUIZ_BADGE_TIERS = [
  { name: 'Grand Archmage of the Stack', minScore: 90 },
  { name: 'Lorekeeper of the Protocol', minScore: 75 },
  { name: 'Initiate of the Outer Gates', minScore: 0 }
] as const;

export function getQuizTierForScore(score: number) {
  return QUIZ_BADGE_TIERS.find((t) => score >= t.minScore) || QUIZ_BADGE_TIERS[QUIZ_BADGE_TIERS.length - 1];
}

export const SEED_MISSION_BADGE_NAMES = [
  'Builder', 'Innovator', 'Collaborator', 'Pathfinder', 'Pioneer',
  'Researcher', 'Deep Diver', 'Tech Scout', 'Clarity Maker', 'Risk Spotter',
  'Demo Maker', 'POC Finisher', 'Show, Don’t Tell', "Show, Don't Tell", 'Prototype Polisher', 'From Idea to Screen',
  'Clear Communicator', 'Daily Signal', 'No Ghosting', 'Early Warner', 'Feedback Receiver',
  'Self-Aware Cube', 'No Excuses', 'Better Next Time', 'Growth Mindset', 'Own Your Work',
  'Mission Lead', 'Team Organizer', 'Initiative Taker', 'Mentor Mindset', 'Future Lead'
];

function shuffleArray<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/** Check whether an attempt completed today (UTC calendar day) */
export function isSameUtcDay(d1: Date, d2: Date = new Date()): boolean {
  return (
    d1.getUTCFullYear() === d2.getUTCFullYear() &&
    d1.getUTCMonth() === d2.getUTCMonth() &&
    d1.getUTCDate() === d2.getUTCDate()
  );
}

export function getStartOfNextUtcDay(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
}

export interface StaffQuizSession {
  userId: string;
  attemptId: string;
  started_at: Date;
  questions: any;
  answer_key: any;
  hints_used: number[];
  user_answers?: any;
}

const staffQuizSessions = new Map<string, StaffQuizSession>();

export function generateQuizData() {
  const selectedQuestions = shuffleArray(QUIZ_QUESTIONS_EN).slice(0, QUIZ_SIZE);

  const clientQuestions: any[] = [];
  const serverMcKey: any[] = [];

  selectedQuestions.forEach((q, index) => {
    const optionsWithCorrectness = q.options.map((text, idx) => ({
      text,
      isCorrect: idx === q.answer
    }));
    const shuffledOptions = shuffleArray(optionsWithCorrectness);
    const correctIndex = shuffledOptions.findIndex((o) => o.isCorrect);

    clientQuestions.push({
      id: q.id,
      index,
      topic: q.topic,
      question: q.question,
      options: shuffledOptions.map((o) => o.text),
      hasHint: !!q.hint
    });

    serverMcKey.push({
      id: q.id,
      index,
      correct_option_index: correctIndex,
      hint: q.hint
    });
  });

  const matchingPool = MATCHING_ITEMS.en;
  const selectedMatching = shuffleArray(matchingPool).slice(0, MATCHING_SIZE);

  const matchingDefinitions = selectedMatching.map((item, index) => ({
    index,
    definition: item.definition
  }));
  const matchingTerms = shuffleArray(
    selectedMatching.map((item) => ({
      id: item.id,
      term: item.term
    }))
  );

  const serverMatchingKey = selectedMatching.map((item, index) => ({
    index,
    correct_term_id: item.id
  }));

  const clientPayload = {
    multipleChoice: clientQuestions,
    matching: {
      definitions: matchingDefinitions,
      terms: matchingTerms
    }
  };

  const serverAnswerKey = {
    mc: serverMcKey,
    matching: serverMatchingKey
  };

  return { clientPayload, serverAnswerKey };
}

export function evaluateQuizAnswers(
  answerKey: any,
  clientQuestions: any,
  answers: (number | null)[],
  matchingAnswers: (string | null)[],
  hintsUsed: number[]
) {
  let multipleChoiceCorrect = 0;
  let hintPenalties = 0;
  const mcEvaluation: any[] = [];

  for (let i = 0; i < QUIZ_SIZE; i++) {
    const key = answerKey.mc?.[i];
    const clientQ = clientQuestions.multipleChoice?.[i];
    const selected = answers[i] !== undefined && answers[i] !== null ? Number(answers[i]) : null;
    const isCorrect = selected !== null && selected === key?.correct_option_index;
    const hintUsed = hintsUsed.includes(i);

    let points = 0;
    if (isCorrect) {
      multipleChoiceCorrect++;
      if (hintUsed) {
        hintPenalties += 1;
        points = POINTS_PER_ITEM - 1; // 3 points
      } else {
        points = POINTS_PER_ITEM; // 4 points
      }
    }

    mcEvaluation.push({
      index: i,
      question: clientQ?.question,
      topic: clientQ?.topic,
      options: clientQ?.options,
      selectedOption: selected,
      correctOption: key?.correct_option_index,
      isCorrect,
      hintUsed,
      pointsAwarded: points
    });
  }

  let matchingCorrect = 0;
  const matchingEvaluation: any[] = [];

  for (let i = 0; i < MATCHING_SIZE; i++) {
    const key = answerKey.matching?.[i];
    const clientDef = clientQuestions.matching?.definitions?.[i];
    const selectedTermId = matchingAnswers[i] || null;
    const isCorrect = selectedTermId !== null && selectedTermId === key?.correct_term_id;

    if (isCorrect) {
      matchingCorrect++;
    }

    matchingEvaluation.push({
      index: i,
      definition: clientDef?.definition,
      selectedTermId,
      correctTermId: key?.correct_term_id,
      isCorrect,
      pointsAwarded: isCorrect ? POINTS_PER_ITEM : 0
    });
  }

  const totalCorrect = multipleChoiceCorrect + matchingCorrect;
  const totalWrong = QUIZ_SIZE + MATCHING_SIZE - totalCorrect;
  const totalScore = Math.max(0, totalCorrect * POINTS_PER_ITEM - hintPenalties);

  return {
    multipleChoiceCorrect,
    matchingCorrect,
    totalCorrect,
    totalWrong,
    hintPenalties,
    totalScore,
    mcEvaluation,
    matchingEvaluation
  };
}

export class QuizService {
  /**
   * Get Cube's quiz overview: daily limit status, highest score, past attempts.
   */
  static async getCubeQuizStatus(cubeProfileId: string) {
    const attempts = await prisma.quizAttempt.findMany({
      where: { cube_id: cubeProfileId },
      include: {
        badge_awarded: {
          select: { id: true, name: true, rarity: true, icon: true }
        }
      },
      orderBy: { started_at: 'desc' }
    });

    const now = new Date();
    const completedToday = attempts.find(
      (a) => a.status === 'completed' && a.completed_at && isSameUtcDay(a.completed_at, now)
    );

    // Active in-progress attempt that hasn't expired yet
    const activeAttempt = attempts.find((a) => {
      if (a.status !== 'in_progress') return false;
      const elapsed = Math.round((now.getTime() - a.started_at.getTime()) / 1000);
      return elapsed <= QUIZ_DURATION_SECONDS + 60;
    });

    const completedAttempts = attempts.filter((a) => a.status === 'completed');
    const bestScore = completedAttempts.reduce((max, a) => Math.max(max, a.score), 0);
    const bestAttempt = completedAttempts.find((a) => a.score === bestScore && bestScore > 0);

    // Find any quiz badge currently held by this Cube
    const cubeBadges = await prisma.cubeBadge.findMany({
      where: { cube_id: cubeProfileId },
      include: { badge: true }
    });

    // Highest quiz-tier badge currently held by this Cube
    const tierRank = (name: string) =>
      QUIZ_BADGE_TIERS.findIndex((t) => t.name.toLowerCase() === name.toLowerCase());
    const quizBadge = cubeBadges
      .filter((cb) => tierRank(cb.badge.name) >= 0)
      .sort((a, b) => tierRank(a.badge.name) - tierRank(b.badge.name))[0];

    return {
      canAttemptToday: !completedToday && !activeAttempt,
      completedToday: !!completedToday,
      nextAttemptAt: completedToday ? getStartOfNextUtcDay() : null,
      activeAttempt: activeAttempt
        ? {
            id: activeAttempt.id,
            started_at: activeAttempt.started_at,
            remaining_seconds: Math.max(
              0,
              QUIZ_DURATION_SECONDS - Math.round((now.getTime() - activeAttempt.started_at.getTime()) / 1000)
            )
          }
        : null,
      totalAttempts: completedAttempts.length,
      bestScore,
      bestAttemptId: bestAttempt?.id || null,
      currentBadge: quizBadge
        ? {
            id: quizBadge.badge.id,
            name: quizBadge.badge.name,
            rarity: quizBadge.badge.rarity,
            icon: quizBadge.badge.icon,
            awarded_at: quizBadge.awarded_at
          }
        : null,
      recentAttempts: completedAttempts.slice(0, 10).map((a) => ({
        id: a.id,
        score: a.score,
        correct_count: a.correct_count,
        wrong_count: a.wrong_count,
        hint_penalty: a.hint_penalty,
        duration_seconds: a.duration_seconds,
        completed_at: a.completed_at,
        badge: a.badge_awarded
          ? {
              id: a.badge_awarded.id,
              name: a.badge_awarded.name,
              rarity: a.badge_awarded.rarity,
              icon: a.badge_awarded.icon
            }
          : null
      }))
    };
  }

  /**
   * Start a new quiz attempt or resume an active one.
   */
  static async startOrResumeQuiz(cubeProfileId: string, options?: { allowAdminBypass?: boolean }) {
    const now = new Date();

    // Check if there is an active in-progress attempt that hasn't expired
    const activeAttempt = await prisma.quizAttempt.findFirst({
      where: {
        cube_id: cubeProfileId,
        status: 'in_progress'
      },
      orderBy: { started_at: 'desc' }
    });

    if (activeAttempt) {
      const elapsed = Math.round((now.getTime() - activeAttempt.started_at.getTime()) / 1000);
      if (elapsed <= QUIZ_DURATION_SECONDS + 30) {
        // Resume active attempt
        const remaining = Math.max(0, QUIZ_DURATION_SECONDS - elapsed);
        return {
          attemptId: activeAttempt.id,
          resumed: true,
          questions: activeAttempt.questions,
          hintsUsed: (activeAttempt.hints_used as number[]) || [],
          userAnswers: activeAttempt.user_answers || null,
          startedAt: activeAttempt.started_at,
          durationSeconds: QUIZ_DURATION_SECONDS,
          remainingSeconds: remaining
        };
      } else {
        // Expired in-progress attempt -> mark timed_out
        await prisma.quizAttempt.update({
          where: { id: activeAttempt.id },
          data: {
            status: 'timed_out',
            completed_at: new Date(activeAttempt.started_at.getTime() + QUIZ_DURATION_SECONDS * 1000),
            duration_seconds: QUIZ_DURATION_SECONDS
          }
        });
      }
    }

    // Check daily limit (1 completed attempt per day)
    const completedToday = await prisma.quizAttempt.findFirst({
      where: {
        cube_id: cubeProfileId,
        status: 'completed',
        completed_at: {
          gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0))
        }
      }
    });

    if (completedToday && !options?.allowAdminBypass) {
      throw badRequest(
        'You have already completed your quiz attempt for today. You can take the quiz again tomorrow!'
      );
    }

    const { clientPayload, serverAnswerKey } = generateQuizData();

    const attempt = await prisma.quizAttempt.create({
      data: {
        cube_id: cubeProfileId,
        status: 'in_progress',
        questions: clientPayload as any,
        answer_key: serverAnswerKey as any,
        hints_used: [],
        started_at: now
      }
    });

    return {
      attemptId: attempt.id,
      resumed: false,
      questions: clientPayload,
      hintsUsed: [],
      userAnswers: null,
      startedAt: attempt.started_at,
      durationSeconds: QUIZ_DURATION_SECONDS,
      remainingSeconds: QUIZ_DURATION_SECONDS
    };
  }

  /**
   * Request a hint for a multiple choice question.
   */
  static async requestHint(attemptId: string, cubeProfileId: string, questionIndex: number) {
    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId }
    });

    if (!attempt || attempt.cube_id !== cubeProfileId) {
      throw notFound('Quiz attempt not found.');
    }

    if (attempt.status !== 'in_progress') {
      throw badRequest('This quiz attempt is already completed.');
    }

    const elapsed = Math.round((Date.now() - attempt.started_at.getTime()) / 1000);
    if (elapsed > QUIZ_DURATION_SECONDS + 60) {
      throw badRequest('Quiz time has expired.');
    }

    const answerKey = attempt.answer_key as any;
    const mcItem = answerKey?.mc?.[questionIndex];
    if (!mcItem) {
      throw badRequest('Question index out of range.');
    }

    const currentHintsUsed = ((attempt.hints_used as number[]) || []).slice();
    if (!currentHintsUsed.includes(questionIndex)) {
      currentHintsUsed.push(questionIndex);
      await prisma.quizAttempt.update({
        where: { id: attemptId },
        data: { hints_used: currentHintsUsed }
      });
    }

    return {
      questionIndex,
      hint: mcItem.hint
    };
  }

  /**
   * Submit quiz answers, evaluate score, apply hint penalties, and award/upgrade badges.
   */
  static async submitQuiz(
    attemptId: string,
    cubeProfileId: string,
    answers: (number | null)[],
    matchingAnswers: (string | null)[]
  ) {
    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        cube: {
          include: { user: { select: { id: true, name: true } } }
        }
      }
    });

    if (!attempt || attempt.cube_id !== cubeProfileId) {
      throw notFound('Quiz attempt not found.');
    }

    if (attempt.status !== 'in_progress') {
      throw badRequest('This quiz attempt has already been submitted.');
    }

    const now = new Date();
    const elapsedSeconds = Math.round((now.getTime() - attempt.started_at.getTime()) / 1000);
    const timedOut = elapsedSeconds > QUIZ_DURATION_SECONDS + 60;

    const evalResult = evaluateQuizAnswers(
      attempt.answer_key,
      attempt.questions,
      answers,
      matchingAnswers,
      (attempt.hints_used as number[]) || []
    );

    const totalCorrect = evalResult.totalCorrect;
    const totalWrong = evalResult.totalWrong;
    const multipleChoiceCorrect = evalResult.multipleChoiceCorrect;
    const matchingCorrect = evalResult.matchingCorrect;
    const hintPenalties = evalResult.hintPenalties;
    const totalScore = evalResult.totalScore;
    const mcEvaluation = evalResult.mcEvaluation;
    const matchingEvaluation = evalResult.matchingEvaluation;

    // Badge allocation & upgrade calculation
    const badgeResult = await this.evaluateBadgeAward(
      cubeProfileId,
      attempt.cube.user.id,
      attempt.cube.user.name,
      totalScore
    );

    // Save attempt record
    const updatedAttempt = await prisma.quizAttempt.update({
      where: { id: attemptId },
      data: {
        score: totalScore,
        correct_count: totalCorrect,
        wrong_count: totalWrong,
        hint_penalty: hintPenalties,
        duration_seconds: Math.min(elapsedSeconds, QUIZ_DURATION_SECONDS),
        status: timedOut ? 'timed_out' : 'completed',
        completed_at: now,
        badge_awarded_id: badgeResult.badgeAwardedId || null,
        user_answers: {
          multipleChoice: answers,
          matching: matchingAnswers
        } as any
      },
      include: {
        badge_awarded: {
          select: { id: true, name: true, rarity: true, icon: true }
        }
      }
    });

    // Auto-evaluate any active Quests (e.g. quiz_score or quiz_completed)
    await recalculateAllQuestsForCube(cubeProfileId).catch((err) => {
      console.error(`Failed to recalculate quests for cube ${cubeProfileId} after quiz:`, err);
    });

    return {
      attemptId: updatedAttempt.id,
      score: totalScore,
      correctCount: totalCorrect,
      wrongCount: totalWrong,
      multipleChoiceCorrect,
      matchingCorrect,
      hintPenalties,
      durationSeconds: updatedAttempt.duration_seconds,
      timedOut,
      completedAt: updatedAttempt.completed_at,
      badge: badgeResult,
      detailedReview: {
        multipleChoice: mcEvaluation,
        matching: matchingEvaluation
      }
    };
  }

  /**
   * Determine earned badge rarity, find configured badge, and handle award/upgrade.
   */
  private static async evaluateBadgeAward(
    cubeProfileId: string,
    userId: string,
    userName: string,
    score: number
  ): Promise<{
    earnedRarity: BadgeRarity | null;
    badgeAwardedId: string | null;
    badgeName: string | null;
    action: 'awarded' | 'upgraded' | 'retained' | 'none';
    message: string;
  }> {
    // Score → badge tier (fixed by badge name, not by rarity/keyword guessing)
    const targetTier = getQuizTierForScore(score);
    const targetBadge = await prisma.badge.findFirst({
      where: { name: { equals: targetTier.name, mode: 'insensitive' } },
      orderBy: { created_at: 'desc' }
    });

    if (!targetBadge) {
      return {
        earnedRarity: null,
        badgeAwardedId: null,
        badgeName: null,
        action: 'none',
        message: `Qualified for "${targetTier.name}" (score: ${score}/100), but this badge is not configured yet.`
      };
    }
    const targetRarity = targetBadge.rarity;

    // Existing quiz-tier badges held by this Cube
    const existingCubeBadges = await prisma.cubeBadge.findMany({
      where: {
        cube_id: cubeProfileId,
        badge: {
          OR: QUIZ_BADGE_TIERS.map((t) => ({ name: { equals: t.name, mode: 'insensitive' as const } }))
        }
      },
      include: { badge: true }
    });

    // Get an admin user ID for awarded_by_id
    const systemAdmin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true }
    });
    const awardedById = systemAdmin?.id || userId;

    if (existingCubeBadges.length === 0) {
      // First-time award
      await prisma.cubeBadge.create({
        data: {
          cube_id: cubeProfileId,
          badge_id: targetBadge.id,
          awarded_by_id: awardedById,
          reason: `Earned ${targetBadge.rarity} badge in Web Fundamentals Quiz with score ${score}/100`
        }
      });

      await createSingleNotification(
        userId,
        `🎉 Congratulations! You scored ${score}/100 on the Web Fundamentals Quiz and earned the "${targetBadge.name}" (${targetBadge.rarity}) badge!`
      );

      return {
        earnedRarity: targetRarity,
        badgeAwardedId: targetBadge.id,
        badgeName: targetBadge.name,
        action: 'awarded',
        message: `Awarded "${targetBadge.name}" (${targetBadge.rarity}) badge with score ${score}/100!`
      };
    }

    // Compare with highest existing badge
    const tierRank = (name: string) =>
      QUIZ_BADGE_TIERS.findIndex((t) => t.name.toLowerCase() === name.toLowerCase());
    const highestExisting = existingCubeBadges.sort(
      (a, b) => tierRank(a.badge.name) - tierRank(b.badge.name)
    )[0];

    if (tierRank(targetBadge.name) < tierRank(highestExisting.badge.name)) {
      // Upgrade!
      await prisma.cubeBadge.update({
        where: { id: highestExisting.id },
        data: {
          badge_id: targetBadge.id,
          reason: `Upgraded to ${targetBadge.rarity} in Web Fundamentals Quiz with score ${score}/100 (previously ${highestExisting.badge.name})`,
          awarded_at: new Date()
        }
      });

      await createSingleNotification(
        userId,
        `🚀 Badge Upgraded! You achieved a new high score of ${score}/100 on the Web Fundamentals Quiz and your badge was upgraded to "${targetBadge.name}" (${targetBadge.rarity})!`
      );

      return {
        earnedRarity: targetRarity,
        badgeAwardedId: targetBadge.id,
        badgeName: targetBadge.name,
        action: 'upgraded',
        message: `Upgraded from "${highestExisting.badge.name}" to "${targetBadge.name}" (${targetBadge.rarity})!`
      };
    }

    // Retained
    return {
      earnedRarity: targetRarity,
      badgeAwardedId: highestExisting.badge.id,
      badgeName: highestExisting.badge.name,
      action: 'retained',
      message: `Scored ${score}/100. Existing badge "${highestExisting.badge.name}" (${highestExisting.badge.rarity}) was retained.`
    };
  }

  /**
   * Get staff test quiz overview. Always ready, never locked, no CubeProfile required.
   */
  static getStaffStatus(userId: string) {
    const now = Date.now();
    const activeSession = Array.from(staffQuizSessions.values()).find(
      (s) => s.userId === userId && now - s.started_at.getTime() < (QUIZ_DURATION_SECONDS + 60) * 1000
    );

    return {
      isStaff: true,
      canAttemptToday: true,
      completedToday: false,
      nextAttemptAt: null,
      activeAttempt: activeSession
        ? {
            id: activeSession.attemptId,
            started_at: activeSession.started_at,
            remaining_seconds: Math.max(
              0,
              QUIZ_DURATION_SECONDS - Math.round((now - activeSession.started_at.getTime()) / 1000)
            )
          }
        : null,
      totalAttempts: 0,
      bestScore: 0,
      bestAttemptId: null,
      currentBadge: null,
      recentAttempts: []
    };
  }

  /**
   * Start or resume a staff test quiz. Completely in-memory, no database CubeProfile or QuizAttempt written.
   */
  static startStaffTestQuiz(userId: string) {
    const now = new Date();
    const existing = Array.from(staffQuizSessions.values()).find(
      (s) => s.userId === userId && now.getTime() - s.started_at.getTime() < (QUIZ_DURATION_SECONDS + 30) * 1000
    );

    if (existing) {
      const elapsed = Math.round((now.getTime() - existing.started_at.getTime()) / 1000);
      const remaining = Math.max(0, QUIZ_DURATION_SECONDS - elapsed);
      return {
        attemptId: existing.attemptId,
        resumed: true,
        questions: existing.questions,
        hintsUsed: existing.hints_used,
        userAnswers: existing.user_answers || null,
        startedAt: existing.started_at,
        durationSeconds: QUIZ_DURATION_SECONDS,
        remainingSeconds: remaining,
        isStaffTest: true
      };
    }

    const { clientPayload, serverAnswerKey } = generateQuizData();
    const attemptId = `staff-${userId}-${Date.now()}`;

    const session: StaffQuizSession = {
      userId,
      attemptId,
      started_at: now,
      questions: clientPayload,
      answer_key: serverAnswerKey,
      hints_used: []
    };

    staffQuizSessions.set(attemptId, session);

    return {
      attemptId,
      resumed: false,
      questions: clientPayload,
      hintsUsed: [],
      userAnswers: null,
      startedAt: now,
      durationSeconds: QUIZ_DURATION_SECONDS,
      remainingSeconds: QUIZ_DURATION_SECONDS,
      isStaffTest: true
    };
  }

  /**
   * Request a hint in a staff test session.
   */
  static requestStaffHint(attemptId: string, userId: string, questionIndex: number) {
    const session = staffQuizSessions.get(attemptId);
    if (!session || session.userId !== userId) {
      throw notFound('Staff test quiz session not found or expired.');
    }

    const mcKey = session.answer_key?.mc?.[questionIndex];
    if (!mcKey || !mcKey.hint) {
      throw badRequest('No hint available for this question.');
    }

    if (!session.hints_used.includes(questionIndex)) {
      session.hints_used.push(questionIndex);
    }

    return {
      questionIndex,
      hint: mcKey.hint
    };
  }

  /**
   * Save in-flight progress for a staff test session.
   */
  static saveStaffProgress(attemptId: string, userId: string, answers: any, matchingAnswers: any) {
    const session = staffQuizSessions.get(attemptId);
    if (!session || session.userId !== userId) {
      return { success: false };
    }
    session.user_answers = { answers, matchingAnswers };
    return { success: true };
  }

  /**
   * Submit and evaluate a staff test quiz. Returns full review, provisional badge info, but writes nothing to database.
   */
  static async submitStaffTestQuiz(
    attemptId: string,
    userId: string,
    answers: (number | null)[],
    matchingAnswers: (string | null)[]
  ) {
    const session = staffQuizSessions.get(attemptId);
    if (!session || session.userId !== userId) {
      throw notFound('Staff test quiz session not found.');
    }

    const now = new Date();
    const elapsedSeconds = Math.round((now.getTime() - session.started_at.getTime()) / 1000);
    const timedOut = elapsedSeconds > QUIZ_DURATION_SECONDS + 60;

    const evalResult = evaluateQuizAnswers(
      session.answer_key,
      session.questions,
      answers,
      matchingAnswers,
      session.hints_used
    );

    const provisionalTier = getQuizTierForScore(evalResult.totalScore);
    const provisionalBadgeRow = await prisma.badge.findFirst({
      where: { name: { equals: provisionalTier.name, mode: 'insensitive' } }
    });
    const provisionalBadge = {
      name: provisionalTier.name,
      rarity: provisionalBadgeRow?.rarity ?? 'Common',
      icon: provisionalBadgeRow?.icon ?? 'Award',
      isUpgrade: false
    };

    // Clean up in-memory session
    staffQuizSessions.delete(attemptId);

    return {
      attemptId,
      score: evalResult.totalScore,
      correctCount: evalResult.totalCorrect,
      wrongCount: evalResult.totalWrong,
      hintPenalty: evalResult.hintPenalties,
      durationSeconds: Math.min(elapsedSeconds, QUIZ_DURATION_SECONDS),
      timedOut,
      badgeAwarded: provisionalBadge,
      detailedReview: {
        multipleChoice: evalResult.mcEvaluation,
        matching: evalResult.matchingEvaluation
      },
      isStaffTest: true
    };
  }
}
