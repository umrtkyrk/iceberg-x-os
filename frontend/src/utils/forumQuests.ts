/**
 * Labels for forum-driven quest criteria. Mirrors
 * backend/src/services/forumQuests.service.ts.
 */
export const FORUM_BINARY_CRITERIA = ['forum_introduction'];

export const FORUM_CRITERIA_OPTIONS = [
  { value: 'forum_posts', label: 'Forum posts: topics + replies (count)' },
  { value: 'forum_topics', label: 'Forum topics started (count)' },
  { value: 'forum_replies', label: 'Forum replies written (count)' },
  { value: 'forum_accepted_answers', label: "Accepted answers on others' questions (count)" },
  { value: 'forum_questions_solved', label: 'Own Tech Support questions solved (count)' },
  { value: 'forum_active_days', label: 'Days with a forum post (count)' },
  { value: 'forum_introduction', label: 'Introduce yourself in Introductions (Target: 1)' }
];

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function forumQuestLabel(type: string, value: number): string | null {
  switch (type) {
    case 'forum_posts':
      return value === 1 ? 'Write your first forum post' : `Write ${value} forum posts`;
    case 'forum_topics':
      return value === 1 ? 'Start a forum topic' : `Start ${value} forum topics`;
    case 'forum_replies':
      return value === 1 ? 'Reply to a forum topic' : `Write ${value} forum replies`;
    case 'forum_accepted_answers':
      return value === 1
        ? "Have an answer accepted on someone's question"
        : `Have ${value} answers accepted on others' questions`;
    case 'forum_questions_solved':
      return value === 1
        ? 'Get a Tech Support question solved and mark the answer'
        : `Get ${value} Tech Support questions solved`;
    case 'forum_active_days':
      return `Post in the forum on ${value} different ${plural(value, 'day', 'days')}`;
    case 'forum_introduction':
      return 'Introduce yourself in the forum';
    default:
      return null;
  }
}

export function forumQuestProgressText(type: string, current: number, target: number): string | null {
  switch (type) {
    case 'forum_posts':
      return `${current} / ${target} posts`;
    case 'forum_topics':
      return `${current} / ${target} topics`;
    case 'forum_replies':
      return `${current} / ${target} replies`;
    case 'forum_accepted_answers':
      return `${current} / ${target} accepted`;
    case 'forum_questions_solved':
      return `${current} / ${target} solved`;
    case 'forum_active_days':
      return `${current} / ${target} days`;
    case 'forum_introduction':
      return current >= 1 ? 'Introduced' : 'Not yet';
    default:
      return null;
  }
}
