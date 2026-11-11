/**
 * Recruitment case: the questions candidates answer, the scoring rubric, and
 * pure helpers to validate AI output and suggest a decision. Kept free of I/O
 * so it can be unit tested.
 */

export const MAX_ANSWER_LENGTH = 3000;

export interface CaseQuestion {
  id: string;
  group: 'scenario' | 'reflection';
  title: string;
  prompt: string;
}

export const CASE_SCENARIO =
  "You have been accepted to Iceberg X and have been working with a team on a real project for about six weeks. At first you could give the programme regular time, but recently your school workload has increased and your exam period has started. The task you were given also turned out harder than expected, and several attempts did not give the result you wanted. Over the last two weeks you missed a team meeting and did not make the progress you had planned. Your mentor gave you feedback that you should manage your progress and communication more regularly. Meanwhile, a teammate proposed a different approach from yours and the team decided to go with it. You know the school workload will continue for the next few weeks. Even so, you have ongoing responsibilities in the team and people you work with.";

export const CASE_QUESTIONS: CaseQuestion[] = [
  { id: 'q1', group: 'scenario', title: 'The first 24 hours', prompt: 'When you notice this situation, what do you do first? Write the first 3 steps you would take, in order.' },
  { id: 'q2', group: 'scenario', title: 'Time and responsibility', prompt: 'You know the time you can give the programme is shrinking. How do you manage your existing responsibilities together with your school workload? Which alternatives would you consider before thinking about leaving the programme?' },
  { id: 'q3', group: 'scenario', title: 'Communication', prompt: 'When you realise your task may be late and you may miss some meetings, when and how do you communicate with your mentor and team? You may write a short example message.' },
  { id: 'q4', group: 'scenario', title: 'Learning and struggling', prompt: 'You have tried a task several times and are still stuck. How do you act? How long do you try alone, and at what point and how do you ask for help?' },
  { id: 'q5', group: 'scenario', title: 'Feedback', prompt: 'You disagree with part of your mentor\'s feedback. How do you handle it, and how do you move forward afterwards?' },
  { id: 'q6', group: 'scenario', title: 'Disagreement in the team', prompt: 'The team decided to go with a teammate\'s solution instead of yours. If you still believe your idea is better, how do you behave?' },
  { id: 'q7', group: 'scenario', title: 'Deciding to continue', prompt: 'After a while your motivation drops and you are unsure whether to continue. Which steps do you take before making your final decision?' },
  { id: 'rA', group: 'reflection', title: 'Reflection A', prompt: 'Was there a process you considered quitting but chose to continue? Briefly describe it. What kept you going?' },
  { id: 'rB', group: 'reflection', title: 'Reflection B', prompt: 'In the last year, did you receive feedback that made you genuinely change your behaviour or way of working? What did you change?' },
  { id: 'rC', group: 'reflection', title: 'Reflection C', prompt: 'Which three qualities would you want your Iceberg X teammates to say about you?' },
  { id: 'rD', group: 'reflection', title: 'Reflection D', prompt: 'In the next 4–6 months, do you foresee anything (school, work, exams, travel, other responsibilities) that could significantly affect the time you can give the programme? If so, how do you plan to manage it?' },
  { id: 'rE', group: 'reflection', title: 'Reflection E', prompt: 'Iceberg X is a development and project-focused programme and does not guarantee a paid position at the end. Knowing this, what is the most important reason you want to join?' }
];

export const CASE_QUESTION_IDS = CASE_QUESTIONS.map(q => q.id);

export const RUBRIC = [
  { key: 'commitment', label: 'Commitment & Reliability', max: 25 },
  { key: 'time', label: 'Time Management', max: 20 },
  { key: 'learning', label: 'Learning & Growth Mindset', max: 20 },
  { key: 'communication', label: 'Communication', max: 15 },
  { key: 'teamfit', label: 'Team Fit', max: 10 },
  { key: 'expectation', label: 'Expectation Alignment', max: 10 }
] as const;

export type RubricKey = (typeof RUBRIC)[number]['key'];
export type RubricScores = Record<RubricKey, number>;
export type CaseDecisionValue = 'StrongYes' | 'Yes' | 'Maybe' | 'No';

export const CASE_DECISIONS: CaseDecisionValue[] = ['StrongYes', 'Yes', 'Maybe', 'No'];

export interface CaseEvaluation {
  scores: RubricScores;
  reduction: string;
  interviewFocus: string;
}

export function totalScore(scores: RubricScores): number {
  return RUBRIC.reduce((sum, item) => sum + scores[item.key], 0);
}

/** Suggestion only: a person always confirms the decision. */
export function suggestDecision(total: number): CaseDecisionValue {
  if (total >= 90) return 'StrongYes';
  if (total >= 80) return 'Yes';
  if (total >= 65) return 'Maybe';
  return 'No';
}

/**
 * Validates a scores object coming from AI output or an admin override.
 * Every criterion must be a whole number within its own maximum.
 */
export function parseRubricScores(raw: any): RubricScores {
  if (!raw || typeof raw !== 'object') throw new Error('Scores are required');
  const out = {} as RubricScores;
  for (const item of RUBRIC) {
    const value = raw[item.key];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > item.max) {
      throw new Error(`${item.label} must be a whole number between 0 and ${item.max}`);
    }
    out[item.key] = value;
  }
  return out;
}

function parseText(value: any, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`);
  return value.trim().slice(0, max);
}

export function parseCaseEvaluation(raw: string): CaseEvaluation {
  const parsed = JSON.parse(raw);
  return {
    scores: parseRubricScores(parsed?.scores),
    reduction: parseText(parsed?.reduction, 'reduction', 1200),
    interviewFocus: parseText(parsed?.interview_focus, 'interview_focus', 1200)
  };
}

/** Normalises candidate answers to known question ids, trimmed and length-capped. */
export function parseAnswers(raw: any): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Answers are required');
  const out: Record<string, string> = {};
  for (const id of CASE_QUESTION_IDS) {
    const value = raw[id];
    if (value === undefined || value === null) {
      out[id] = '';
      continue;
    }
    if (typeof value !== 'string') throw new Error('Answers must be text');
    if (value.length > MAX_ANSWER_LENGTH) throw new Error(`Each answer must be at most ${MAX_ANSWER_LENGTH} characters`);
    out[id] = value.trim();
  }
  return out;
}
