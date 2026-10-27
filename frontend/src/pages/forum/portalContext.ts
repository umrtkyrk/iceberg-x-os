import { api } from "../../utils/api";
import type {
  ForumBadge,
  ForumMember,
  ForumMission,
  ForumQuest,
  MvcAward,
  PeerTitle,
  PortalContext,
  PortalIdentity,
  PortalRole,
  PublicKudo,
  Rarity,
  StageKey,
} from "./types";

type JsonRecord = Record<string, unknown>;
type PublicRecognition = Pick<ForumMember, "titles" | "quotes" | "awards">;
const HALL_STAGES: StageKey[] = [
  "cube",
  "candidate",
  "senior",
  "iceberger",
  "mentor",
];
const POSITIVE_LABELS: Readonly<Record<string, string>> = {
  UNBLOCKER: "Unblocker",
  DEEP_DIVER: "Deep Diver",
  TEAM_GLUE: "Team Glue",
  CLEAR_COMMUNICATOR: "Clear Communicator",
  RELIABLE: "Reliable",
};
const AWARD_LABELS: Readonly<Record<string, string>> = {
  UNBLOCKER: "Unblocker",
  DEEP_DIVER: "Deep Diver",
  TEAM_GLUE: "Team Glue",
  RISING_STAR: "Rising Star",
};
const publicLabel = (
  labels: Readonly<Record<string, string>>,
  key: string,
): string =>
  Object.prototype.hasOwnProperty.call(labels, key) ? labels[key] : "";
const RARITIES: Rarity[] = ["Common", "Rare", "Epic", "Legendary"];
const record = (value: unknown): JsonRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const text = (value: unknown, max = 160): string =>
  typeof value === "string"
    ? value
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
        .trim()
        .slice(0, max)
    : "";
const amount = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.min(value, 1_000_000_000)
    : fallback;
const rarity = (value: unknown): Rarity =>
  RARITIES.includes(value as Rarity) ? (value as Rarity) : "Common";
const role = (value: unknown, fallback: PortalRole = "CUBE"): PortalRole =>
  value === "ADMIN" || value === "MENTOR" || value === "CUBE"
    ? value
    : fallback;
const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => Array.from(part)[0] || "")
    .join("")
    .toLocaleUpperCase("tr-TR") || "C";
const unique = <T>(items: T[], key: (item: T) => string): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const id = key(item);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

function assetPath(value: unknown): string | null {
  const path = text(value, 2048);
  // Presentation resolves /uploads paths with the portal's existing getAssetUrl.
  return /^https?:\/\//i.test(path) || /^\/uploads\//.test(path) ? path : null;
}

function stageFor(
  level: unknown,
  portalRole: PortalRole,
  hallStage?: StageKey,
  fallback: StageKey = "cube",
): StageKey {
  if (portalRole === "ADMIN") return "admin";
  if (portalRole === "MENTOR") return "mentor";
  if (level === "Former_Cube") return "former";
  if (level === "Alumni") return "alumni";
  if (level === "Iceberger") return "iceberger";
  if (level === "Senior_Cube") return "senior";
  if (level === "Cube") return hallStage === "candidate" ? "candidate" : "cube";
  return hallStage || fallback;
}

function projectBadge(value: unknown): ForumBadge | null {
  const award = record(value);
  const badge = record(award.badge ?? value);
  const id = text(badge.id);
  const name = text(badge.name);
  if (!id || !name) return null;
  const earnedAt = text(award.awarded_at || award.earnedAt, 40);
  const missionTitle = text(record(award.mission).title || award.missionTitle);
  return {
    id,
    name,
    description: text(badge.description, 800),
    icon: text(badge.icon, 80) || "Award",
    rarity: rarity(badge.rarity),
    ...(earnedAt && !Number.isNaN(Date.parse(earnedAt)) ? { earnedAt } : {}),
    ...(missionTitle ? { missionTitle } : {}),
  };
}

function monthOnly(value: unknown): string {
  const period = text(value, 40);
  return /^(?:\d{4}-(?:0[1-9]|1[0-2])|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?) \d{4})$/i.test(
    period,
  )
    ? period
    : "";
}

/** Only consume the public summary's explicit recognition fields, including for the viewer. */
export function projectPublicRecognition(raw: unknown): PublicRecognition {
  const source = record(raw);
  const titles: PeerTitle[] = unique(
    list(source.peer_titles ?? source.titles).flatMap((value) => {
      const item = record(value);
      const category = text(item.category, 80);
      const label = publicLabel(POSITIVE_LABELS, category);
      if (!label || !["Common", "Rare", "Epic"].includes(text(item.rarity)))
        return [];
      return [{ category, label, rarity: rarity(item.rarity) }];
    }),
    (item) => item.category,
  );
  const quotes: PublicKudo[] = unique(
    list(source.pinned_quotes ?? source.pinned).flatMap((value) => {
      const item = record(value);
      const id = text(item.id);
      const note = text(item.note, 501);
      // The source must be a public pinned collection, never an own inbox/history.
      // Reject contradictory flags and malformed rows rather than turning them into consent.
      if (
        !id ||
        !note ||
        note.length > 500 ||
        /#\d{2,}/.test(note) ||
        (item.kind !== undefined && item.kind !== "KUDOS") ||
        (item.status !== undefined && item.status !== "ACTIVE") ||
        item.is_pinned === false ||
        item.pinned === false
      )
        return [];
      const tags = unique(
        list(item.tags).flatMap((value) => {
          const key =
            typeof value === "string" ? value : text(record(value).key, 80);
          const label = publicLabel(POSITIVE_LABELS, key);
          return label ? [{ key, label }] : [];
        }),
        (tag) => tag.key,
      ).slice(0, 3);
      if (tags.length === 0) return [];
      return [{ id, note, tags, period: monthOnly(item.period) }];
    }),
    (quote) => quote.id,
  ).slice(0, 3);
  const awards: MvcAward[] = unique(
    list(source.awards).flatMap((value) => {
      const item = record(value);
      const category = text(item.category, 80);
      const period = text(item.period, 7);
      const label = publicLabel(AWARD_LABELS, category);
      if (
        !label ||
        !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(period) ||
        text(item.period, 40) !== period
      )
        return [];
      return [{ category, label, period }];
    }),
    (award) => `${award.category}:${award.period}`,
  ).slice(0, 12);
  return { titles, quotes, awards };
}

/** Construct a new allowlisted object; no profile, scorecard or feedback row is retained. */
export function projectPublicMember(
  raw: unknown,
  fallback: Partial<ForumMember> = {},
  hallStage?: StageKey,
): ForumMember {
  const source = record(raw);
  const profile =
    source.profile === undefined ? source : record(source.profile);
  const user = record(profile.user);
  const cubeId = text(profile.id) || fallback.cubeId;
  const name = text(user.name || profile.name) || fallback.name || "Cube";
  const portalRole = role(
    user.role,
    fallback.portalRole || (hallStage === "mentor" ? "MENTOR" : "CUBE"),
  );
  const cubeNumber = text(profile.cube_number) || fallback.cubeNumber;
  const publicStats = record(source.stats);
  const recognition = projectPublicRecognition(source);
  return {
    id: text(user.id) || fallback.id || cubeId || "portal-member",
    ...(cubeId ? { cubeId } : {}),
    ...(cubeNumber ? { cubeNumber } : {}),
    name,
    initials: initials(name),
    stage: stageFor(
      profile.current_level,
      portalRole,
      hallStage,
      fallback.stage,
    ),
    portalRole,
    avatarUrl: assetPath(
      profile.avatar_url || user.avatar_url || fallback.avatarUrl,
    ),
    cohort: text(profile.cohort) || fallback.cohort || "",
    university: text(profile.university) || fallback.university || "",
    skills: unique(
      list(profile.skills ?? fallback.skills)
        .map((value) => text(value, 80))
        .filter(Boolean),
      (value) => value,
    ).slice(0, 20),
    founding:
      profile.is_founding_cube === true ||
      (profile.is_founding_cube === undefined && fallback.founding === true),
    sample: false,
    badges: unique(
      list(profile.cube_badges ?? fallback.badges).flatMap((value) => {
        const badge = projectBadge(value);
        return badge ? [badge] : [];
      }),
      (badge) => badge.id,
    ),
    titles: recognition.titles,
    quotes: recognition.quotes,
    awards: recognition.awards,
    stats: {
      questsCompleted: amount(
        publicStats.questsCompleted,
        fallback.stats?.questsCompleted,
      ),
      missionContributions: amount(
        publicStats.missionContributions,
        fallback.stats?.missionContributions,
      ),
    },
  };
}

function identityFallback(identity: PortalIdentity): Partial<ForumMember> {
  return {
    id: identity.id,
    cubeId: identity.cubeProfileId,
    cubeNumber: identity.cubeNumber,
    name: identity.name,
    portalRole: identity.role,
    avatarUrl: identity.avatar_url || identity.avatarUrl || null,
    founding: identity.isFoundingCube === true,
  };
}

function projectQuests(raw: unknown, portalRole: PortalRole): ForumQuest[] {
  const entries = list(raw);
  const completedIds = new Set(
    entries
      .filter((value) => record(value).is_completed === true)
      .map(
        (value) =>
          text(record(value).quest_id) || text(record(record(value).quest).id),
      ),
  );
  return unique(
    entries.flatMap((value) => {
      const assignment = record(value);
      const quest =
        portalRole === "CUBE" ? record(assignment.quest) : assignment;
      const id = text(quest.id);
      const title = text(quest.title);
      if (!id || !title) return [];
      const dependency = text(quest.dependency_quest_id);
      const completed =
        portalRole === "CUBE" && assignment.is_completed === true;
      const expires = quest.is_timed === true ? text(quest.expires_at, 40) : "";
      return [
        {
          id,
          title,
          description: text(quest.description, 1200),
          difficulty: rarity(quest.difficulty),
          current: portalRole === "CUBE" ? amount(assignment.current_value) : 0,
          target: Math.max(amount(quest.criteria_value, 1), 0.01),
          completed,
          locked:
            portalRole === "CUBE" &&
            !completed &&
            Boolean(dependency) &&
            !completedIds.has(dependency),
          expiresAt:
            expires && !Number.isNaN(Date.parse(expires)) ? expires : null,
        },
      ];
    }),
    (quest) => quest.id,
  );
}

function projectMissions(raw: unknown): ForumMission[] {
  return unique(
    list(record(raw).missions).flatMap((value) => {
      const mission = record(value);
      const id = text(mission.missionId);
      const title = text(mission.title);
      return id && title
        ? [{ id, title, status: text(mission.status, 80) }]
        : [];
    }),
    (mission) => mission.id,
  );
}

function projectHall(raw: unknown): {
  people: ForumMember[];
  counts: PortalContext["hallCounts"];
} {
  const stages = record(record(raw).stages);
  const counts: PortalContext["hallCounts"] = {};
  const people = HALL_STAGES.flatMap((stage) => {
    const rows = list(stages[stage]).filter((value) =>
      Boolean(text(record(value).id)),
    );
    counts[stage] = rows.length;
    return rows.map((row) => projectPublicMember(row, {}, stage));
  });
  return { people: unique(people, (person) => person.id), counts };
}

async function addPublicRecognition(member: ForumMember): Promise<ForumMember> {
  if (!member.cubeId) return member;
  const raw = await api.get<unknown>(
    `/cubes/${encodeURIComponent(member.cubeId)}/peer-summary`,
  );
  const summary = record(raw);
  const recognition = projectPublicRecognition(raw);
  return {
    ...member,
    titles: Array.isArray(summary.titles) ? recognition.titles : member.titles,
    quotes: Array.isArray(summary.pinned) ? recognition.quotes : member.quotes,
    awards: recognition.awards,
  };
}

// Store normalized public data only. Repeated profile openings share an in-flight request.
const members = new Map<
  string,
  { expires: number; promise: Promise<ForumMember> }
>();
export function loadPublicMember(
  cubeId: string,
  hallStage?: StageKey,
): Promise<ForumMember> {
  const id = text(cubeId);
  if (!id) return Promise.reject(new Error("A Cube profile is required."));
  const key = `${id}:${hallStage || ""}`;
  const cached = members.get(key);
  if (cached && cached.expires > Date.now()) return cached.promise;
  const promise = api
    .get<unknown>(`/cubes/public/${encodeURIComponent(id)}`)
    .then(async (raw) => {
      const member = projectPublicMember(raw, { id }, hallStage);
      try {
        return await addPublicRecognition(member);
      } catch {
        return member;
      }
    })
    .catch((error: unknown) => {
      members.delete(key);
      throw error;
    });
  if (members.size >= 100) {
    const oldest = members.keys().next().value;
    if (oldest) members.delete(oldest);
  }
  members.set(key, { expires: Date.now() + 60_000, promise });
  return promise;
}

/** One load per forum mount; all requests keep the API's role and session guards. */
export async function loadPortalContext(
  identity: PortalIdentity,
): Promise<PortalContext> {
  const canHaveProfile =
    identity.role === "CUBE" || Boolean(identity.cubeProfileId);
  const identifier = identity.cubeProfileId || identity.id;
  const [publicResult, hallResult, questResult] = await Promise.allSettled([
    canHaveProfile
      ? api.get<unknown>(`/cubes/public/${encodeURIComponent(identifier)}`)
      : Promise.resolve(undefined),
    api.get<unknown>("/hall-of-fame"),
    api.get<unknown>("/quests"),
  ]);
  const notices: string[] = [];
  const hall = projectHall(
    hallResult.status === "fulfilled" ? hallResult.value : null,
  );
  const ownRaw =
    publicResult.status === "fulfilled" ? publicResult.value : null;
  const ownProfileId =
    text(record(record(ownRaw).profile).id) || identity.cubeProfileId;
  const ownHallStage = hall.people.find(
    (person) => person.cubeId === ownProfileId,
  )?.stage;
  let viewer = projectPublicMember(
    ownRaw,
    identityFallback(identity),
    ownHallStage,
  );
  if (publicResult.status === "rejected")
    notices.push(
      "Portal profilin şu anda yüklenemedi; oturum bilgin gösteriliyor.",
    );
  if (hallResult.status === "rejected")
    notices.push("Topluluk kademeleri şu anda yüklenemedi.");
  if (questResult.status === "rejected")
    notices.push("Quest ilerlemen şu anda yüklenemedi.");
  if (ownRaw && viewer.cubeId) {
    try {
      viewer = await addPublicRecognition(viewer);
    } catch {
      notices.push("Aylık takdir ödülleri şu anda yüklenemedi.");
    }
  }
  viewer = { ...viewer, id: identity.id };
  const people = unique(
    [viewer, ...hall.people],
    (person) => person.cubeId || person.id,
  );
  return {
    viewer,
    people,
    quests: projectQuests(
      questResult.status === "fulfilled" ? questResult.value : null,
      identity.role,
    ),
    missions: projectMissions(ownRaw),
    hallCounts: hall.counts,
    notices,
  };
}
