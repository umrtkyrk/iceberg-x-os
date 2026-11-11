import prisma from './prisma';

/**
 * Forum-driven quest criteria. Every value is computed from live (not deleted)
 * posts, so a topic a moderator removes stops counting toward quests that are
 * still in progress. Once a forum quest is complete it is final, like peer
 * quests: deleting a post later never takes an earned badge away.
 */
export const FORUM_COUNT_CRITERIA = [
  'forum_posts',
  'forum_topics',
  'forum_replies',
  'forum_accepted_answers',
  'forum_questions_solved',
  'forum_active_days'
];
export const FORUM_BINARY_CRITERIA = ['forum_introduction'];
export const FORUM_CRITERIA = [...FORUM_COUNT_CRITERIA, ...FORUM_BINARY_CRITERIA];

export const isForumCriteria = (type: string) => FORUM_CRITERIA.includes(type);

/** The category a Cube introduces themselves in (seeded by the forum migrations). */
const INTRODUCTIONS_CATEGORY = 'introductions';
/** The only category where a question can have an accepted answer. */
const HELP_CATEGORY = 'help';

const liveTopic = { deleted_at: null };
const liveReply = { deleted_at: null, topic: { deleted_at: null } };

export async function forumQuestValue(userId: string, criteriaType: string): Promise<number> {
  switch (criteriaType) {
    case 'forum_topics':
      return prisma.forumTopic.count({ where: { ...liveTopic, author_id: userId } });
    case 'forum_replies':
      return prisma.forumReply.count({ where: { ...liveReply, author_id: userId } });
    case 'forum_posts': {
      const [topics, replies] = await Promise.all([
        forumQuestValue(userId, 'forum_topics'),
        forumQuestValue(userId, 'forum_replies')
      ]);
      return topics + replies;
    }
    case 'forum_accepted_answers':
      // Someone else's question, answered by this user. Accepting your own
      // reply on your own topic does not count.
      return prisma.forumReply.count({
        where: {
          deleted_at: null,
          author_id: userId,
          accepted_in: { deleted_at: null, author_id: { not: userId } }
        }
      });
    case 'forum_questions_solved':
      return prisma.forumTopic.count({
        where: { ...liveTopic, author_id: userId, category_id: HELP_CATEGORY, accepted_reply_id: { not: null } }
      });
    case 'forum_active_days': {
      // Distinct calendar days (Istanbul time) with at least one live post.
      const rows = await prisma.$queryRaw<Array<{ days: bigint }>>`
        SELECT count(DISTINCT day) AS days FROM (
          SELECT (t.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Istanbul')::date AS day
            FROM "ForumTopic" t WHERE t.author_id = ${userId} AND t.deleted_at IS NULL
          UNION ALL
          SELECT (r.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Istanbul')::date
            FROM "ForumReply" r JOIN "ForumTopic" t ON t.id = r.topic_id
           WHERE r.author_id = ${userId} AND r.deleted_at IS NULL AND t.deleted_at IS NULL
        ) posts`;
      return Number(rows[0]?.days ?? 0);
    }
    case 'forum_introduction': {
      const topic = await prisma.forumTopic.findFirst({
        where: { ...liveTopic, author_id: userId, category_id: INTRODUCTIONS_CATEGORY },
        select: { id: true }
      });
      return topic ? 1 : 0;
    }
    default:
      return 0;
  }
}
