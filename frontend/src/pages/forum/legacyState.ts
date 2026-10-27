import { readLocalState } from "./forumModel";
import type { ForumLocalState, ForumTopic } from "./types";

// Preserve authored work, without relabelling old fictional conversations as
// messages from a real portal identity. Original storage remains a backup.
export function migrateLegacyState(
  value: unknown,
  userId: string,
  samples: ForumTopic[],
): ForumLocalState {
  const legacy = readLocalState(JSON.stringify(value), []);
  const sampleIds = new Set(samples.map((topic) => topic.id));
  const knownSamples = new Set([
    "selin",
    "zeynep",
    "emre",
    "deniz",
    "derya",
    "can",
  ]);
  const author = (id: string) =>
    id === userId
      ? id
      : knownSamples.has(id)
        ? `sample-${id}`
        : "legacy-example";
  const authored = legacy.topics
    .filter(
      (topic) =>
        !sampleIds.has(topic.id) &&
        (topic.authorId === userId ||
          topic.replies.some((post) => post.authorId === userId)),
    )
    .map((topic) => ({
      ...topic,
      authorId: author(topic.authorId),
      replies: topic.replies.map((post) => ({
        ...post,
        authorId: author(post.authorId),
      })),
    }));
  return readLocalState(
    JSON.stringify({ ...legacy, topics: [...authored, ...samples] }),
    samples,
  );
}
