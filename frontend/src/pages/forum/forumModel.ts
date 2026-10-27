import type {
  ForumLocalState,
  ForumPost,
  ForumSettings,
  ForumTopic,
  PortalRole,
  Rarity,
  StageKey,
} from "./types";

export const STAGES: Record<
  StageKey,
  { label: string; color: string; soft: string; description: string }
> = {
  cube: {
    label: "Cube",
    color: "#2563eb",
    soft: "#eff6ff",
    description: "Öğreniyor, araştırıyor ve birlikte üretiyor.",
  },
  candidate: {
    label: "Senior Cube Candidate",
    color: "#0e7490",
    soft: "#ecfeff",
    description: "Program ekibi tarafından aday olarak tanındı.",
  },
  senior: {
    label: "Senior Cube",
    color: "#7c3aed",
    soft: "#f5f3ff",
    description: "Deneyimini ve sorumluluğunu ekibiyle paylaşıyor.",
  },
  iceberger: {
    label: "Iceberger",
    color: "#a16207",
    soft: "#fffbeb",
    description: "Iceberg ana ekibine katıldı.",
  },
  mentor: {
    label: "Mentor",
    color: "#047857",
    soft: "#ecfdf5",
    description: "Cubelara yol gösteriyor.",
  },
  admin: {
    label: "Admin",
    color: "#be185d",
    soft: "#fdf2f8",
    description: "Topluluğu ve programı yönetiyor.",
  },
  alumni: {
    label: "Alumni",
    color: "#475569",
    soft: "#f1f5f9",
    description: "Programı tamamladı; topluluğun bir parçası.",
  },
  former: {
    label: "Former Cube",
    color: "#6b7280",
    soft: "#f9fafb",
    description: "Programdan ayrıldı; paylaştığı bilgi burada.",
  },
};
export const RARITY_ORDER: Record<Rarity, number> = {
  Legendary: 0,
  Epic: 1,
  Rare: 2,
  Common: 3,
};
export const RARITY_LABELS: Record<Rarity, string> = {
  Common: "Common",
  Rare: "Rare",
  Epic: "Epic",
  Legendary: "Legendary",
};
export const CATEGORIES = [
  {
    id: "announcements",
    name: "Duyurular",
    description: "Programdan ve topluluktan haberler.",
    icon: "Megaphone",
    color: "#be185d",
  },
  {
    id: "help",
    name: "Sor & çöz",
    description: "Takıldığın yerde birlikte ilerleyelim.",
    icon: "LifeBuoy",
    color: "#2563eb",
  },
  {
    id: "showcase",
    name: "Ürettiklerimiz",
    description: "Bir fikirden çalışan ürüne.",
    icon: "Layers",
    color: "#7c3aed",
  },
  {
    id: "ideas",
    name: "Fikir atölyesi",
    description: "Henüz bitmemiş fikirler de değerlidir.",
    icon: "Lightbulb",
    color: "#a16207",
  },
  {
    id: "lounge",
    name: "Küpün dışı",
    description: "Kahve, oyun ve iş dışındaki her şey.",
    icon: "Coffee",
    color: "#047857",
  },
];

export function initials(name?: string | null): string {
  return (
    (name || "Cube")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => Array.from(part)[0] || "")
      .join("")
      .toLocaleUpperCase("tr-TR") || "C"
  );
}
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const strings = (value: unknown, limit = 100): string[] =>
  Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (id): id is string =>
              typeof id === "string" && id.length > 0 && id.length <= limit,
          ),
        ),
      ]
    : [];
const text = (value: unknown, max: number): string =>
  typeof value === "string" ? value.slice(0, max) : "";
const date = (value: unknown): string | null =>
  typeof value === "string" && Number.isFinite(Date.parse(value))
    ? value
    : null;

export function safePreferences(
  value: unknown,
  earnedIds: string[],
): ForumSettings {
  const input = record(value);
  return {
    badgeIds: strings(input.badgeIds)
      .filter((id) => earnedIds.includes(id))
      .slice(0, 3),
    signature: text(input.signature, 140),
  };
}
export function canCompose(
  role: PortalRole | string,
  categoryId = "help",
): boolean {
  return (
    CATEGORIES.some((category) => category.id === categoryId) &&
    ["CUBE", "MENTOR", "ADMIN"].includes(role) &&
    (categoryId !== "announcements" || role === "ADMIN" || role === "MENTOR")
  );
}
function readPost(value: unknown): ForumPost | null {
  const row = record(value),
    createdAt = date(row.createdAt);
  if (
    !strings([row.id]).length ||
    !strings([row.authorId]).length ||
    typeof row.body !== "string" ||
    !createdAt
  )
    return null;
  return {
    id: row.id as string,
    authorId: row.authorId as string,
    body: row.deleted === true ? "" : text(row.body, 5000),
    createdAt,
    edited: row.edited === true,
    deleted: row.deleted === true,
  };
}
function readTopic(value: unknown): ForumTopic | null {
  const row = record(value),
    createdAt = date(row.createdAt);
  if (
    !strings([row.id]).length ||
    !strings([row.authorId]).length ||
    typeof row.title !== "string" ||
    !row.title.trim() ||
    typeof row.body !== "string" ||
    !createdAt ||
    !Array.isArray(row.replies)
  )
    return null;
  if (!CATEGORIES.some((category) => category.id === row.categoryId))
    return null;
  const seen = new Set<string>();
  const replies = row.replies
    .map(readPost)
    .filter((post): post is ForumPost => !!post)
    .filter((post) => {
      if (seen.has(post.id)) return false;
      seen.add(post.id);
      return true;
    });
  return {
    id: row.id as string,
    authorId: row.authorId as string,
    title: row.deleted === true ? "Kaldırılmış konu" : text(row.title, 160),
    body: row.deleted === true ? "" : text(row.body, 10000),
    categoryId: row.categoryId as string,
    questId: strings([row.questId])[0] || null,
    missionId: strings([row.missionId])[0] || null,
    pinned: row.pinned === true,
    unread: row.unread === true,
    createdAt,
    views:
      typeof row.views === "number" && Number.isFinite(row.views)
        ? Math.max(0, Math.min(1e9, Math.floor(row.views)))
        : 0,
    tags: strings(row.tags, 64).slice(0, 10),
    replies,
    edited: row.edited === true,
    deleted: row.deleted === true,
  };
}
export function readLocalState(
  raw: string | null,
  initialTopics: ForumTopic[],
): ForumLocalState {
  const fallback = (): ForumLocalState => ({
    topics: initialTopics,
    saved: [],
    following: [],
    settings: { badgeIds: [], signature: "" },
  });
  try {
    if (!raw) return fallback();
    const input = record(JSON.parse(raw));
    if (!Array.isArray(input.topics)) return fallback();
    const seen = new Set<string>();
    const topics = input.topics
      .map(readTopic)
      .filter((topic): topic is ForumTopic => !!topic)
      .filter((topic) => {
        if (seen.has(topic.id)) return false;
        seen.add(topic.id);
        return true;
      });
    const visibleIds = new Set(
      topics.filter((topic) => !topic.deleted).map((topic) => topic.id),
    );
    const settings = record(input.settings);
    // Ownership is applied with live earned IDs by the adapter/render boundary.
    return {
      topics,
      saved: strings(input.saved).filter((id) => visibleIds.has(id)),
      following: strings(input.following).filter((id) => visibleIds.has(id)),
      settings: safePreferences(settings, strings(settings.badgeIds)),
    };
  } catch {
    return fallback();
  }
}
