import prisma from './prisma';

/**
 * Mission contributor history.
 *
 * Team rosters are mutable: teams get edited, detached from a mission or
 * deleted, and with them the only record of who worked on what. MissionContributor
 * is the durable record. Rows are never deleted when a Cube leaves a mission;
 * `released_at` is stamped instead.
 *
 * No data is migrated. A mission's pre-existing team members are recorded the
 * first time its roster is touched (see reconcileMissionContributors, which is
 * called both before and after every roster mutation) and are merged in on
 * read until then (see listContributors).
 */

export interface ContributorView {
  cube_id: string;
  name: string;
  avatar_url: string | null;
  role: string;
  team_name: string | null;
  assigned_at: Date | null;
  released_at: Date | null;
  active: boolean;
}

/**
 * Brings MissionContributor in line with the mission's current team members:
 * records anyone new, reopens anyone who came back, and releases anyone who
 * is gone. Idempotent; safe to call repeatedly.
 */
export async function reconcileMissionContributors(tx: any, missionId: string | null | undefined) {
  if (!missionId) return;

  const [members, rows] = await Promise.all([
    tx.missionTeamMember.findMany({
      where: { team: { mission_id: missionId } },
      select: { cube_id: true, role: true, team: { select: { name: true } } }
    }),
    tx.missionContributor.findMany({ where: { mission_id: missionId } })
  ]);

  const current = new Map<string, { role: string; team: string }>(
    members.map((m: any) => [m.cube_id, { role: m.role, team: m.team?.name }])
  );
  const byCube = new Map<string, any>(rows.map((r: any) => [r.cube_id, r]));
  const now = new Date();

  for (const [cubeId, { role, team }] of current) {
    const row = byCube.get(cubeId);
    if (!row) {
      await tx.missionContributor.create({
        data: { mission_id: missionId, cube_id: cubeId, role, team_name: team }
      });
    } else if (row.released_at || row.role !== role || row.team_name !== team) {
      await tx.missionContributor.update({
        where: { id: row.id },
        data: { released_at: null, role, team_name: team }
      });
    }
  }

  for (const row of rows) {
    if (!current.has(row.cube_id) && !row.released_at) {
      await tx.missionContributor.update({
        where: { id: row.id },
        data: { released_at: now }
      });
    }
  }
}

/** Reconciles several missions, ignoring blanks and duplicates. */
export async function reconcileMissions(tx: any, missionIds: (string | null | undefined)[]) {
  for (const id of new Set(missionIds.filter(Boolean) as string[])) {
    await reconcileMissionContributors(tx, id);
  }
}

/**
 * Contributors per mission: the recorded history plus anyone currently on a
 * team who has not been recorded yet. Read-only.
 */
export async function listContributors(missionIds: string[]): Promise<Map<string, ContributorView[]>> {
  const result = new Map<string, ContributorView[]>();
  if (missionIds.length === 0) return result;

  const [rows, members] = await Promise.all([
    prisma.missionContributor.findMany({
      where: { mission_id: { in: missionIds } },
      include: { cube: { select: { user: { select: { name: true, avatar_url: true } } } } }
    }),
    prisma.missionTeamMember.findMany({
      where: { team: { mission_id: { in: missionIds } } },
      select: {
        cube_id: true,
        role: true,
        created_at: true,
        team: { select: { mission_id: true, name: true } },
        cube: { select: { user: { select: { name: true, avatar_url: true } } } }
      }
    })
  ]);

  const push = (missionId: string, view: ContributorView) => {
    const list = result.get(missionId) || [];
    list.push(view);
    result.set(missionId, list);
  };

  const recorded = new Set<string>();
  for (const r of rows) {
    recorded.add(`${r.mission_id}:${r.cube_id}`);
    push(r.mission_id, {
      cube_id: r.cube_id,
      name: r.cube?.user?.name || 'Unknown',
      avatar_url: r.cube?.user?.avatar_url || null,
      role: r.role,
      team_name: r.team_name,
      assigned_at: r.assigned_at,
      released_at: r.released_at,
      active: !r.released_at
    });
  }

  // Live members not yet recorded (missions whose roster was never touched)
  for (const m of members) {
    const missionId = m.team?.mission_id;
    if (!missionId || recorded.has(`${missionId}:${m.cube_id}`)) continue;
    recorded.add(`${missionId}:${m.cube_id}`);
    push(missionId, {
      cube_id: m.cube_id,
      name: m.cube?.user?.name || 'Unknown',
      avatar_url: m.cube?.user?.avatar_url || null,
      role: m.role,
      team_name: m.team?.name || null,
      assigned_at: m.created_at,
      released_at: null,
      active: true
    });
  }

  // Active first, then by assignment date
  for (const list of result.values()) {
    list.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return new Date(a.assigned_at || 0).getTime() - new Date(b.assigned_at || 0).getTime();
    });
  }

  return result;
}
