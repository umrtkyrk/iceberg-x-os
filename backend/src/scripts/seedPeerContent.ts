/**
 * Creates the badges and quests that go with peer feedback, MVCubes and the
 * Legendary "Be an Iceberger" badge.
 *
 * Idempotent and DRY-RUN BY DEFAULT: nothing is written unless --apply is
 * passed. Existing badges and quests (matched by name / title) are updated in
 * place; nothing is ever deleted and no existing award or progress is touched.
 *
 *   npx ts-node src/scripts/seedPeerContent.ts            # show what would happen
 *   npx ts-node src/scripts/seedPeerContent.ts --apply    # do it
 *
 * Requires the 'Legendary' rarity migration to have been applied first.
 */
import prisma from '../services/prisma';
import { BadgeRarity } from '@prisma/client';
import { autoAssignQuestToEligibleCubes } from '../services/quest.service';

const APPLY = process.argv.includes('--apply');

interface BadgeDef {
  name: string;
  description: string;
  icon: string;
  rarity: BadgeRarity;
}

interface QuestDef {
  title: string;
  description: string;
  difficulty: BadgeRarity;
  criteria_type: string;
  criteria_value: number;
  badge: string;
  prerequisite?: string;
  min_sample_size?: number;
  /** Assigned to every eligible Cube automatically. */
  auto_assign: boolean;
}

const C = BadgeRarity.Common;
const R = BadgeRarity.Rare;
const E = BadgeRarity.Epic;
const L = BadgeRarity.Legendary;

const BADGES: BadgeDef[] = [
  // Giving
  { name: 'Kind Word', icon: 'heart', rarity: C, description: 'Recognised a teammate for the first time. Small words, big effect.' },
  { name: 'Cheerleader', icon: 'megaphone', rarity: R, description: 'Recognised five different Cubes. The programme is louder and kinder because of you.' },
  { name: 'Steady Pulse', icon: 'repeat', rarity: R, description: 'Gave peer feedback four weeks in a row. Consistency is a gift to a team.' },
  { name: 'Heartbeat', icon: 'heart-handshake', rarity: E, description: 'Gave peer feedback twelve weeks in a row. You are the rhythm the programme runs on.' },
  { name: 'Talent Scout', icon: 'telescope', rarity: R, description: 'Noticed three quiet teammates who rarely get recognised. A sharp eye for hidden talent.' },
  { name: 'Words That Land', icon: 'messages-square', rarity: R, description: 'Wrote kudos that three different teammates found genuinely helpful.' },
  // Receiving
  { name: 'Noticed', icon: 'eye', rarity: C, description: 'Recognised by three different teammates. People see what you do.' },
  { name: 'Trusted Teammate', icon: 'handshake', rarity: R, description: 'Recognised by eight different teammates. Others reach for you when it matters.' },
  { name: 'Pillar of the Team', icon: 'anchor', rarity: E, description: 'Recognised by fifteen different teammates. The programme leans on you, and holds because of it.' },
  { name: "Teammates' Choice", icon: 'star', rarity: E, description: 'Earned an Epic peer title: sustained, wide recognition across missions and months.' },
  // MVCubes
  { name: 'MVCube', icon: 'crown', rarity: E, description: 'Named a Most Valued Cube for the month by the people who work beside you.' },
  { name: 'Hall of Fame', icon: 'trophy', rarity: E, description: 'Named a Most Valued Cube three times. A fixture of the programme.' },
  // Judgement
  { name: 'Calibrated', icon: 'crosshair', rarity: E, description: 'Your concerns, once reviewed by mentors, proved accurate. A trusted, careful eye.' },
  // The summit
  {
    name: 'Be an Iceberger',
    icon: 'snowflake',
    rarity: L,
    description:
      'The summit of the programme. Awarded to a Cube who has earned a place on the main development team. Few reach it.'
  }
];

const QUESTS: QuestDef[] = [
  // Giving
  { title: 'First Kudos', difficulty: C, criteria_type: 'peer_kudos_given', criteria_value: 1, badge: 'Kind Word', auto_assign: true,
    description: 'Recognise a teammate for something they did well. It takes under a minute and it is anonymous.' },
  { title: 'Spread the Love', difficulty: R, criteria_type: 'peer_kudos_given', criteria_value: 5, badge: 'Cheerleader', prerequisite: 'First Kudos', auto_assign: true,
    description: 'Recognise five different Cubes.' },
  { title: 'Steady Pulse', difficulty: R, criteria_type: 'peer_feedback_streak', criteria_value: 4, badge: 'Steady Pulse', auto_assign: true,
    description: 'Give peer feedback in four consecutive weeks.' },
  { title: 'Heartbeat of the Programme', difficulty: E, criteria_type: 'peer_feedback_streak', criteria_value: 12, badge: 'Heartbeat', prerequisite: 'Steady Pulse', auto_assign: true,
    description: 'Give peer feedback in twelve consecutive weeks.' },
  { title: 'Eye for Quiet Talent', difficulty: R, criteria_type: 'peer_quiet_kudos', criteria_value: 3, badge: 'Talent Scout', auto_assign: true,
    description: 'Recognise three teammates who rarely get noticed. The people who say the least often do the most.' },
  { title: 'Words That Land', difficulty: R, criteria_type: 'peer_helpful_feedback', criteria_value: 3, badge: 'Words That Land', auto_assign: true,
    description: 'Write kudos that three different teammates mark as helpful. Specific beats generic.' },
  // Receiving
  { title: 'Noticed', difficulty: C, criteria_type: 'peer_distinct_givers_received', criteria_value: 3, badge: 'Noticed', auto_assign: true,
    description: 'Be recognised by three different teammates.' },
  { title: 'Trusted Teammate', difficulty: R, criteria_type: 'peer_distinct_givers_received', criteria_value: 8, badge: 'Trusted Teammate', prerequisite: 'Noticed', auto_assign: true,
    description: 'Be recognised by eight different teammates.' },
  { title: 'Pillar of the Team', difficulty: E, criteria_type: 'peer_distinct_givers_received', criteria_value: 15, badge: 'Pillar of the Team', prerequisite: 'Trusted Teammate', auto_assign: true,
    description: 'Be recognised by fifteen different teammates.' },
  { title: "Teammates' Choice", difficulty: E, criteria_type: 'peer_title_tier', criteria_value: 3, badge: "Teammates' Choice", auto_assign: true,
    description: 'Earn an Epic peer title. It needs wide, sustained recognition across several missions and months.' },
  // MVCubes
  { title: 'MVCube', difficulty: E, criteria_type: 'mvcubes_awards', criteria_value: 1, badge: 'MVCube', auto_assign: true,
    description: 'Be named a Most Valued Cube for a month.' },
  { title: 'Hall of Fame', difficulty: E, criteria_type: 'mvcubes_awards', criteria_value: 3, badge: 'Hall of Fame', prerequisite: 'MVCube', auto_assign: true,
    description: 'Be named a Most Valued Cube three times.' },
  // Judgement. Created but NOT auto-assigned: it ties a badge to mentor reviews.
  { title: 'Calibrated', difficulty: E, criteria_type: 'peer_calibration', criteria_value: 80, min_sample_size: 3, badge: 'Calibrated', auto_assign: false,
    description: 'Keep at least 80% of your mentor-reviewed concerns accurate, across at least three reviews.' },
  // The summit: assigned to everyone so the goal is always in view. Completed
  // by the programme team (Admin sign-off) when a Cube joins the main team.
  { title: 'Become an Iceberger', difficulty: L, criteria_type: 'custom', criteria_value: 1, badge: 'Be an Iceberger', auto_assign: true,
    description: 'Earn your place on the main development team. Awarded by the programme team, and so far to no one.' }
];

async function main() {
  console.log(`--- Peer feedback badges & quests (${APPLY ? 'APPLY' : 'DRY RUN, pass --apply to write'}) ---`);

  // Fail early with a clear message if the enum value is not there yet.
  if (APPLY) {
    try {
      await prisma.$queryRaw`SELECT 'Legendary'::"BadgeRarity"`;
    } catch {
      console.error(
        "The 'Legendary' rarity does not exist in this database yet. Apply the migration " +
        '20261013120000_add_legendary_badge_rarity first (prisma migrate deploy).'
      );
      process.exit(1);
    }
  }

  const badgeIds = new Map<string, string>();

  for (const b of BADGES) {
    const existing = await prisma.badge.findUnique({ where: { name: b.name } });
    if (existing) {
      console.log(`  badge  = ${b.name} (${b.rarity}) already exists; description, icon and rarity ${APPLY ? 'updated' : 'would be updated'}`);
      if (APPLY) {
        await prisma.badge.update({
          where: { id: existing.id },
          data: { description: b.description, icon: b.icon, rarity: b.rarity }
        });
      }
      badgeIds.set(b.name, existing.id);
    } else {
      console.log(`  badge  + ${b.name} (${b.rarity})`);
      if (APPLY) {
        const created = await prisma.badge.create({ data: b });
        badgeIds.set(b.name, created.id);
      }
    }
  }

  const questIds = new Map<string, string>();

  for (const q of QUESTS) {
    const badgeId = badgeIds.get(q.badge);
    const existing = await prisma.quest.findFirst({ where: { title: q.title } });
    const data = {
      description: q.description,
      difficulty: q.difficulty,
      criteria_type: q.criteria_type,
      criteria_value: q.criteria_value,
      min_sample_size: q.min_sample_size ?? null,
      auto_assign: q.auto_assign
    };

    if (existing) {
      console.log(`  quest  = ${q.title} (${q.difficulty}) already exists; ${APPLY ? 'updated' : 'would be updated'}`);
      if (APPLY) {
        await prisma.quest.update({
          where: { id: existing.id },
          data: { ...data, ...(badgeId ? { rewards: { set: [{ id: badgeId }] } } : {}) }
        });
      }
      questIds.set(q.title, existing.id);
    } else {
      console.log(`  quest  + ${q.title} (${q.difficulty}, ${q.criteria_type} = ${q.criteria_value}${q.auto_assign ? ', auto-assign' : ''})`);
      if (APPLY && badgeId) {
        const created = await prisma.quest.create({
          data: { title: q.title, ...data, rewards: { connect: [{ id: badgeId }] } }
        });
        questIds.set(q.title, created.id);
      }
    }
  }

  // Prerequisites, once every quest exists.
  for (const q of QUESTS) {
    if (!q.prerequisite) continue;
    const id = questIds.get(q.title);
    const prereq = questIds.get(q.prerequisite);
    if (APPLY && id && prereq) {
      await prisma.quest.update({ where: { id }, data: { dependency_quest_id: prereq } });
    }
    console.log(`  link     ${q.title}  requires  ${q.prerequisite}`);
  }

  // Assign auto-assign quests to everyone currently eligible and evaluate them.
  if (APPLY) {
    for (const q of QUESTS.filter(x => x.auto_assign)) {
      const id = questIds.get(q.title);
      if (!id) continue;
      const res = await autoAssignQuestToEligibleCubes(id);
      console.log(`  assign   ${q.title}: ${res.newlyAssigned} newly assigned, ${res.skipped} skipped`);
    }
  }

  console.log(APPLY ? '--- Done ---' : '--- Dry run complete: nothing was written ---');
}

main()
  .catch(err => {
    console.error('Seeding failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
