export type PortalRole = "CUBE" | "MENTOR" | "ADMIN";
export type StageKey =
  | "cube"
  | "candidate"
  | "senior"
  | "iceberger"
  | "mentor"
  | "admin"
  | "alumni"
  | "former";
export type Rarity = "Common" | "Rare" | "Epic" | "Legendary";
export interface ForumBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: Rarity;
  earnedAt?: string;
  missionTitle?: string;
}
export interface PeerTitle {
  category: string;
  label: string;
  rarity: Rarity;
}
export interface PublicKudo {
  id: string;
  note: string;
  tags: { key: string; label: string }[];
  period: string;
}
export interface MvcAward {
  category: string;
  label: string;
  period: string;
}
export interface ForumMember {
  id: string;
  cubeId?: string;
  cubeNumber?: string;
  name: string;
  initials: string;
  stage: StageKey;
  portalRole: PortalRole;
  avatarUrl: string | null;
  cohort: string;
  university: string;
  skills: string[];
  founding: boolean;
  sample: boolean;
  badges: ForumBadge[];
  titles: PeerTitle[];
  quotes: PublicKudo[];
  awards: MvcAward[];
  stats: { questsCompleted: number; missionContributions: number };
}
export interface ForumQuest {
  id: string;
  title: string;
  description: string;
  difficulty: Rarity;
  current: number;
  target: number;
  completed: boolean;
  locked: boolean;
  expiresAt: string | null;
}
export interface ForumMission {
  id: string;
  title: string;
  status: string;
}
export interface PortalContext {
  viewer: ForumMember;
  people: ForumMember[];
  quests: ForumQuest[];
  missions: ForumMission[];
  hallCounts: Partial<Record<StageKey, number>>;
  notices: string[];
}
export interface PortalIdentity {
  id: string;
  name: string;
  role: PortalRole;
  cubeProfileId?: string;
  cubeNumber?: string;
  isFoundingCube?: boolean;
  avatar_url?: string | null;
  avatarUrl?: string | null;
}
export interface ForumPost {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
  edited?: boolean;
  deleted?: boolean;
}
export interface ForumTopic {
  id: string;
  title: string;
  body: string;
  categoryId: string;
  authorId: string;
  questId: string | null;
  missionId?: string | null;
  pinned: boolean;
  unread: boolean;
  createdAt: string;
  views: number;
  tags: string[];
  replies: ForumPost[];
  edited?: boolean;
  deleted?: boolean;
}
export interface ForumSettings {
  badgeIds: string[];
  signature: string;
}
export interface ForumLocalState {
  topics: ForumTopic[];
  saved: string[];
  following: string[];
  settings: ForumSettings;
}
