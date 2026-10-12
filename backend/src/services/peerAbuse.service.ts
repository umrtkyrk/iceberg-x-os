/**
 * Abuse resistance for peer feedback.
 *
 * Everything here runs server-side on pseudonymous giver hashes. The hash ->
 * Cube index is built in memory from the user list and is never persisted or
 * returned, so no endpoint can use it to reveal a giver.
 */
import prisma from './prisma';
import { PeerFeedbackKind, PeerFeedbackStatus } from '@prisma/client';
import {
  RECIPROCAL_CONCERN_WINDOW_DAYS,
  RIVAL_TOP_N,
  SIGNAL_WINDOW_DAYS
} from '../config/peer';
import { daysAgo, giverHash } from './peerCore';

const CACHE_MS = 5 * 60 * 1000;

let hashIndexCache: { at: number; map: Map<string, string> } | null = null;
let rivalCache: { at: number; topByTag: Map<string, Set<string>> } | null = null;

/** giver_hash -> CubeProfile.id, for every Cube. Cached for five minutes. */
export async function getHashIndex(): Promise<Map<string, string>> {
  if (hashIndexCache && Date.now() - hashIndexCache.at < CACHE_MS) return hashIndexCache.map;

  const profiles = await prisma.cubeProfile.findMany({ select: { id: true, user_id: true } });
  const map = new Map<string, string>();
  for (const p of profiles) map.set(giverHash(p.user_id), p.id);

  hashIndexCache = { at: Date.now(), map };
  return map;
}

export function invalidateAbuseCaches(): void {
  hashIndexCache = null;
  rivalCache = null;
}

async function hashOfCube(cubeProfileId: string): Promise<string | null> {
  const profile = await prisma.cubeProfile.findUnique({
    where: { id: cubeProfileId },
    select: { user_id: true }
  });
  return profile ? giverHash(profile.user_id) : null;
}

/**
 * Givers whose kudos to this Cube is mutual (the Cube also recognised them
 * inside the window). Mutual recognition between teammates is natural, so it is
 * only discounted, not discarded.
 */
export async function mutualKudosGivers(receiverCubeId: string): Promise<Set<string>> {
  const receiverHash = await hashOfCube(receiverCubeId);
  if (!receiverHash) return new Set();

  const gaveByReceiver = await prisma.peerFeedback.findMany({
    where: {
      giver_hash: receiverHash,
      kind: PeerFeedbackKind.KUDOS,
      status: PeerFeedbackStatus.ACTIVE,
      created_at: { gte: daysAgo(SIGNAL_WINDOW_DAYS) }
    },
    select: { receiver_id: true }
  });
  if (gaveByReceiver.length === 0) return new Set();

  const recognisedCubes = new Set(gaveByReceiver.map(f => f.receiver_id));
  const index = await getHashIndex();
  const mutual = new Set<string>();
  for (const [hash, cubeId] of index) {
    if (recognisedCubes.has(cubeId)) mutual.add(hash);
  }
  return mutual;
}

/**
 * Givers of concerns against this Cube whom the Cube also filed a concern
 * against within the reciprocal window. Likely retaliation, so excluded from
 * the score and surfaced to mentors as a flag (never with names).
 */
export async function reciprocalConcernGivers(receiverCubeId: string): Promise<Set<string>> {
  const receiverHash = await hashOfCube(receiverCubeId);
  if (!receiverHash) return new Set();

  const [filedByReceiver, filedAgainst] = await Promise.all([
    prisma.peerFeedback.findMany({
      where: { giver_hash: receiverHash, kind: PeerFeedbackKind.CONCERN },
      select: { receiver_id: true, created_at: true }
    }),
    prisma.peerFeedback.findMany({
      where: { receiver_id: receiverCubeId, kind: PeerFeedbackKind.CONCERN },
      select: { giver_hash: true, created_at: true }
    })
  ]);
  if (filedByReceiver.length === 0 || filedAgainst.length === 0) return new Set();

  const index = await getHashIndex();
  const windowMs = RECIPROCAL_CONCERN_WINDOW_DAYS * 86400000;
  const flagged = new Set<string>();

  for (const against of filedAgainst) {
    const againstCube = index.get(against.giver_hash);
    if (!againstCube) continue;
    const retaliated = filedByReceiver.some(
      mine =>
        mine.receiver_id === againstCube &&
        Math.abs(mine.created_at.getTime() - against.created_at.getTime()) <= windowMs
    );
    if (retaliated) flagged.add(against.giver_hash);
  }
  return flagged;
}

/** Top Cubes per positive tag over the window (distinct kudos givers). */
async function getTopByTag(): Promise<Map<string, Set<string>>> {
  if (rivalCache && Date.now() - rivalCache.at < CACHE_MS) return rivalCache.topByTag;

  const kudos = await prisma.peerFeedback.findMany({
    where: {
      kind: PeerFeedbackKind.KUDOS,
      status: PeerFeedbackStatus.ACTIVE,
      created_at: { gte: daysAgo(SIGNAL_WINDOW_DAYS) }
    },
    select: { receiver_id: true, giver_hash: true, tags: true }
  });

  // tag -> receiver -> distinct givers
  const counts = new Map<string, Map<string, Set<string>>>();
  for (const k of kudos) {
    for (const tag of k.tags) {
      if (!counts.has(tag)) counts.set(tag, new Map());
      const byReceiver = counts.get(tag)!;
      if (!byReceiver.has(k.receiver_id)) byReceiver.set(k.receiver_id, new Set());
      byReceiver.get(k.receiver_id)!.add(k.giver_hash);
    }
  }

  const topByTag = new Map<string, Set<string>>();
  for (const [tag, byReceiver] of counts) {
    const ranked = [...byReceiver.entries()]
      .map(([cube, givers]) => ({ cube, n: givers.size }))
      .sort((a, b) => b.n - a.n)
      .slice(0, RIVAL_TOP_N)
      .map(r => r.cube);
    topByTag.set(tag, new Set(ranked));
  }

  rivalCache = { at: Date.now(), topByTag };
  return topByTag;
}

/**
 * Givers who compete with this Cube: they sit in the top tier of a category
 * the Cube also sits in. Their concerns are discounted, since sabotaging the
 * person next to you on a leaderboard is the obvious abuse.
 */
export async function rivalGivers(receiverCubeId: string): Promise<Set<string>> {
  const topByTag = await getTopByTag();

  const rivalCubes = new Set<string>();
  for (const [, top] of topByTag) {
    if (!top.has(receiverCubeId)) continue;
    for (const cube of top) {
      if (cube !== receiverCubeId) rivalCubes.add(cube);
    }
  }
  if (rivalCubes.size === 0) return new Set();

  const index = await getHashIndex();
  const rivals = new Set<string>();
  for (const [hash, cubeId] of index) {
    if (rivalCubes.has(cubeId)) rivals.add(hash);
  }
  return rivals;
}

/** Reliability weights for a set of givers (default 1). */
export async function loadReliability(hashes: string[]): Promise<Map<string, number>> {
  const unique = [...new Set(hashes)];
  const map = new Map<string, number>();
  if (unique.length === 0) return map;

  const stats = await prisma.peerReviewerStat.findMany({
    where: { giver_hash: { in: unique } },
    select: { giver_hash: true, reliability: true }
  });
  for (const s of stats) map.set(s.giver_hash, s.reliability);
  return map;
}
