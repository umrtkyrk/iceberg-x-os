import { Prisma } from '@prisma/client';
import { badRequest } from '../utils/http';
import { forumText } from './forumPolicy';

/**
 * WhatsApp-style polls. A poll belongs to one forum topic or one private chat message and cannot be
 * edited after it is posted. Each person picks one option, or several when the poll allows multiple
 * answers; voting again replaces their choice and an empty choice withdraws the vote. Everyone who can
 * see the poll sees the totals and, unless the author made it anonymous, who voted for what. Chat polls
 * are encrypted with the room key.
 */
type Tx = Prisma.TransactionClient;
type Text = (value: string) => string;
const plain: Text = value => value;

export const POLL_MAX_OPTIONS = 12;
export interface PollInput { question: string; options: string[]; allow_multiple: boolean; hide_voters: boolean }

export const pollSelect = {
  id: true, question: true, allow_multiple: true, hide_voters: true,
  options: { orderBy: { position: 'asc' }, select: { id: true, text: true } },
  votes: { orderBy: [{ created_at: 'asc' }, { user_id: 'asc' }], select: { option_id: true, user: { select: { id: true, name: true, avatar_url: true } } } },
} satisfies Prisma.ForumPollSelect;
type PollRow = Prisma.ForumPollGetPayload<{ select: typeof pollSelect }>;

/** Validates an optional poll from a request body; undefined or null means "no poll". */
export function pollInput(value: unknown): PollInput | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw badRequest('Invalid poll.');
  const input = value as Record<string, unknown>;
  const question = forumText(input.question, 'Poll question', 1, 200);
  if (!Array.isArray(input.options)) throw badRequest(`A poll needs 2–${POLL_MAX_OPTIONS} options.`);
  const options = input.options.filter(option => !(typeof option === 'string' && !option.trim())).map(option => forumText(option, 'Poll option', 1, 100));
  if (options.length < 2 || options.length > POLL_MAX_OPTIONS) throw badRequest(`A poll needs 2–${POLL_MAX_OPTIONS} options.`);
  if (new Set(options.map(option => option.toLocaleLowerCase('tr'))).size !== options.length) throw badRequest('Poll options must be different.');
  for (const key of ['allow_multiple', 'hide_voters']) if (input[key] !== undefined && typeof input[key] !== 'boolean') throw badRequest('Invalid poll setting.');
  return { question, options, allow_multiple: input.allow_multiple === true, hide_voters: input.hide_voters === true };
}

export async function createPoll(tx: Tx, owner: { topic_id: string } | { message_id: string } | { reply_id: string }, poll: PollInput, seal: Text = plain) {
  await tx.forumPoll.create({ data: { ...owner, question: seal(poll.question), allow_multiple: poll.allow_multiple, hide_voters: poll.hide_voters,
    options: { create: poll.options.map((text, position) => ({ position, text: seal(text) })) } } });
}

export function projectPoll(poll: PollRow | null, viewerId: string, open: Text = plain) {
  if (!poll) return null;
  const voters = new Set(poll.votes.map(vote => vote.user.id));
  return {
    id: poll.id, question: open(poll.question), allow_multiple: poll.allow_multiple, hide_voters: poll.hide_voters, total_voters: voters.size,
    options: poll.options.map(option => {
      const votes = poll.votes.filter(vote => vote.option_id === option.id);
      return { id: option.id, text: open(option.text), votes: votes.length, voted: votes.some(vote => vote.user.id === viewerId), // Anonymous polls never send identities to the client; the viewer still sees their own choice.
      voters: poll.hide_voters ? [] : votes.map(vote => vote.user) };
    }),
  };
}

/** Replaces the viewer's vote on a poll the caller has already authorised them to see. */
export async function castPollVote(tx: Tx, pollId: string, userId: string, input: Record<string, unknown>) {
  const ids = input.option_ids;
  if (!Array.isArray(ids) || ids.length > POLL_MAX_OPTIONS || !ids.every(id => typeof id === 'string') || new Set(ids).size !== ids.length) throw badRequest('Choose poll options.');
  // One vote change per poll at a time, so parallel requests cannot leave two answers on a single-answer poll.
  await tx.$queryRaw`SELECT id FROM "ForumPoll" WHERE id = ${pollId} FOR UPDATE`;
  const poll = await tx.forumPoll.findUniqueOrThrow({ where: { id: pollId }, select: { allow_multiple: true, options: { select: { id: true } } } });
  if (!poll.allow_multiple && ids.length > 1) throw badRequest('This poll allows one answer.');
  const valid = new Set(poll.options.map(option => option.id));
  if (!ids.every(id => valid.has(id))) throw badRequest('That option is not part of this poll.');
  await tx.forumPollVote.deleteMany({ where: { poll_id: pollId, user_id: userId } });
  if (ids.length) await tx.forumPollVote.createMany({ data: (ids as string[]).map(option_id => ({ poll_id: pollId, option_id, user_id: userId })) });
}
