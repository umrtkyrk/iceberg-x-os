/**
 * One-off: record who worked on past missions in MissionContributor, so they show up
 * in the Vault even though their teams were deleted or reshuffled.
 *
 *   node scripts/backfill-mission-contributors.js          # dry-run (writes nothing)
 *   node scripts/backfill-mission-contributors.js --apply  # applies
 *
 * For every Vault mission (completed / reviewed / promoted / archived) a Cube is added when:
 *   - a mentor scorecard (MentorFeedback) exists for them on that mission, or
 *   - they are still on a team attached to that mission (their role and team name are kept).
 *
 * Only inserts into MissionContributor. Existing rows are never touched, so it is safe to
 * re-run. Nothing is deleted or updated anywhere else.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const VAULT_STATUSES = ['completed', 'reviewed', 'promoted_to_product_backlog', 'archived'];

async function main() {
  const missions = await prisma.mission.findMany({
    where: { status: { in: VAULT_STATUSES } },
    select: {
      id: true,
      title: true,
      created_at: true,
      updated_at: true,
      teams: {
        select: { name: true, members: { select: { cube_id: true, role: true } } }
      },
      mentor_feedbacks: { select: { cube_id: true, created_at: true } },
      contributors: { select: { cube_id: true } }
    }
  });

  // MentorFeedback.cube_id is a User id; contributors are keyed by CubeProfile id
  const userIds = [...new Set(missions.flatMap((m) => m.mentor_feedbacks.map((f) => f.cube_id)))];
  const profiles = await prisma.cubeProfile.findMany({
    where: { user_id: { in: userIds } },
    select: { id: true, user_id: true }
  });
  const profileByUser = new Map(profiles.map((p) => [p.user_id, p.id]));

  const toCreate = [];
  let skippedNoProfile = 0;

  for (const mission of missions) {
    const existing = new Set(mission.contributors.map((c) => c.cube_id));
    const planned = new Map(); // cube_id -> row

    // Live team rosters: we know the role and team
    for (const team of mission.teams) {
      for (const member of team.members) {
        planned.set(member.cube_id, {
          mission_id: mission.id,
          cube_id: member.cube_id,
          role: member.role,
          team_name: team.name,
          assigned_at: mission.created_at,
          // The mission is finished, so the Cube is no longer working on it
          released_at: mission.updated_at
        });
      }
    }

    // Scorecards: proof they did the work, even if the team is gone (role unknown)
    for (const fb of mission.mentor_feedbacks) {
      const cubeId = profileByUser.get(fb.cube_id);
      if (!cubeId) {
        skippedNoProfile++;
        continue;
      }
      if (!planned.has(cubeId)) {
        planned.set(cubeId, {
          mission_id: mission.id,
          cube_id: cubeId,
          role: 'Contributor',
          team_name: null,
          assigned_at: mission.created_at,
          released_at: fb.created_at
        });
      }
    }

    const rows = [...planned.values()].filter((r) => !existing.has(r.cube_id));
    if (rows.length > 0) {
      console.log(`${mission.title}: +${rows.length} contributor(s)`);
      toCreate.push(...rows);
    }
  }

  console.log(`\nVault missions scanned : ${missions.length}`);
  console.log(`Contributors to add    : ${toCreate.length}`);
  if (skippedNoProfile) console.log(`Skipped (no Cube profile): ${skippedNoProfile}`);

  if (!APPLY) {
    console.log('\nDry-run only. Re-run with --apply to write.');
    return;
  }

  const result = await prisma.missionContributor.createMany({ data: toCreate, skipDuplicates: true });
  console.log(`\nInserted ${result.count} row(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
