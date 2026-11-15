import { PrismaClient, Role, CubeLevel } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function requireSeedPassword(envName: string) {
  const value = process.env[envName];
  if (!value) {
    throw new Error(`${envName} must be set before running the seed script.`);
  }
  return value;
}

function cubeNumber(num: number) {
  return String(num).padStart(3, '0');
}

async function getNextCubeNumber(tx: PrismaClient | Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) {
  const lastProfile = await tx.cubeProfile.findFirst({
    orderBy: { cube_number: 'desc' }
  });
  let nextNum = 1;
  if (lastProfile) {
    const parsed = parseInt(lastProfile.cube_number, 10);
    if (!isNaN(parsed)) {
      nextNum = parsed + 1;
    }
  }
  return cubeNumber(nextNum);
}

async function main() {
  console.log('Starting seed...');

  const staffPassword = requireSeedPassword('SEED_STAFF_PASSWORD');
  const cubePassword = requireSeedPassword('SEED_CUBE_PASSWORD');
  const yunusPassword = process.env.SEED_YUNUS_PASSWORD || staffPassword;

  const adminUsers = [
    {
      name: 'Yunus Emre Altanay',
      email: 'yunus.altanay@iceberg-digital.co.uk',
      password: yunusPassword,
    },
    {
      name: 'Mark Burgess',
      email: 'mark@iceberg-digital.co.uk',
      password: staffPassword,
    },
    {
      name: 'Ahmet Onur Solmaz',
      email: 'ahmet.solmaz@iceberg-digital.co.uk',
      password: staffPassword,
    },
    {
      name: 'Barış Babacanoğlu',
      email: 'baris@iceberg-digital.co.uk',
      password: staffPassword,
    },
    {
      name: 'Yusuf Tokgöz',
      email: 'yusuf@iceberg-digital.co.uk',
      password: staffPassword,
    },
  ];

  const mentorUsers = [
    { name: 'Ahmet Onur Başterzi', email: 'onur.basterzi@iceberg-digital.co.uk', password: staffPassword },
    { name: 'Altuğ Ege Sarı', email: 'altug.ege@iceberg-digital.co.uk', password: staffPassword },
    { name: 'Bora Küçükkara', email: 'bora.kucukkara@iceberg-digital.co.uk', password: staffPassword },
    { name: 'Furkan Meraloğlu', email: 'furkan.meraloglu@iceberg-digital.co.uk', password: staffPassword },
    { name: 'Ali Cebeci', email: 'ali.cebeci@iceberg-digital.co.uk', password: staffPassword },
    { name: 'Seyfullah Bozkurt', email: 'seyfullah.bozkurt@iceberg-digital.co.uk', password: staffPassword },
    { name: 'Damla Akkuş', email: 'damla.akkus@iceberg-digital.co.uk', password: staffPassword },
    { name: 'Eren Aygün', email: 'eren.aygun@iceberg-digital.co.uk', password: staffPassword },
    { name: 'Oğuzhan Esin', email: 'oguzhan.esin@iceberg-digital.co.uk', password: staffPassword },
    { name: 'Gülcan Aydoğan', email: 'gulcan.aydogan@iceberg-digital.co.uk', password: staffPassword },
  ];

  const originalCube = {
    name: 'Cube #000',
    email: 'original.cube@iceberg-digital.co.uk',
    cube_number: '000',
  };

  const newSpecialCubes = [
    {
      name: 'Emre Dennis Yılmaz',
      email: 'emre.yilmaz@iceberg-digital.co.uk',
      cube_number: '001',
      current_level: CubeLevel.Iceberger,
      internship_status: 'Iceberg Consultant',
      cohort: 'Founding Cohort',
      is_founding_cube: true
    },
    {
      name: 'Fraser Burgess',
      email: 'fraser@iceberg-digital.co.uk',
      cube_number: '007',
      current_level: CubeLevel.Cube,
      internship_status: 'Podcast Editor',
      cohort: 'Founding Cohort',
      is_founding_cube: true
    }
  ];

  const seniorCubes = [
    { name: 'Elif Yıldız', email: 'elif.yildiz@iceberg-digital.co.uk', cube_number: '002' },
    { name: 'İlayda Günay', email: 'ilayda.gunay@iceberg-digital.co.uk', cube_number: '003' },
    { name: 'Özcan Yıldızhan', email: 'ozcan.yildizhan@iceberg-digital.co.uk', cube_number: '004' },
    { name: 'Cenk Yalçın', email: 'cenk.yalcin@iceberg-digital.co.uk', cube_number: '005' },
    { name: 'Batuhan Koç', email: 'batuhan.koc@iceberg-digital.co.uk', cube_number: '006' },
    { name: 'Doğancan Acar', email: 'dogancan.acar@iceberg-digital.co.uk', cube_number: '008' },
  ];

  const badgeDefinitions = [
    { name: 'Builder', description: 'Awarded for consistently turning ideas into working outputs.', icon: 'Builder' },
    { name: 'Innovator', description: 'Awarded for original thinking and novel solution ideas.', icon: 'Innovator' },
    { name: 'Collaborator', description: 'Awarded for strong teamwork and constructive contribution.', icon: 'Collaborator' },
    { name: 'Pathfinder', description: 'Awarded for finding a practical route through ambiguity.', icon: 'Pathfinder' },
    { name: 'Pioneer', description: 'Awarded for work that opens a new direction for the programme.', icon: 'Pioneer' },

    { name: 'Researcher', description: 'Awarded for strong research discipline and useful findings.', icon: 'Researcher' },
    { name: 'Deep Diver', description: 'Awarded for going beyond surface-level investigation.', icon: 'DeepDiver' },
    { name: 'Tech Scout', description: 'Awarded for identifying promising technologies, tools, or patterns.', icon: 'TechScout' },
    { name: 'Clarity Maker', description: 'Awarded for making complex findings easy to understand.', icon: 'ClarityMaker' },
    { name: 'Risk Spotter', description: 'Awarded for identifying risks early and clearly.', icon: 'RiskSpotter' },

    { name: 'Demo Maker', description: 'Awarded for creating a clear and usable demo experience.', icon: 'DemoMaker' },
    { name: 'POC Finisher', description: 'Awarded for bringing a proof of concept to completion.', icon: 'POCFinisher' },
    { name: 'Show, Don’t Tell', description: 'Awarded for demonstrating progress through working evidence.', icon: 'ShowDontTell' },
    { name: 'Prototype Polisher', description: 'Awarded for improving prototype quality and presentation.', icon: 'PrototypePolisher' },
    { name: 'From Idea to Screen', description: 'Awarded for translating an idea into a visible product experience.', icon: 'FromIdeaToScreen' },

    { name: 'Clear Communicator', description: 'Awarded for clear written and verbal communication.', icon: 'ClearCommunicator' },
    { name: 'Daily Signal', description: 'Awarded for consistent and useful daily progress updates.', icon: 'DailySignal' },
    { name: 'No Ghosting', description: 'Awarded for staying responsive and visible during a mission.', icon: 'NoGhosting' },
    { name: 'Early Warner', description: 'Awarded for raising blockers and risks early.', icon: 'EarlyWarner' },
    { name: 'Feedback Receiver', description: 'Awarded for receiving feedback well and acting on it.', icon: 'FeedbackReceiver' },

    { name: 'Self-Aware Cube', description: 'Awarded for honest reflection and self-awareness.', icon: 'SelfAwareCube' },
    { name: 'No Excuses', description: 'Awarded for taking responsibility without deflection.', icon: 'NoExcuses' },
    { name: 'Better Next Time', description: 'Awarded for turning lessons into concrete improvements.', icon: 'BetterNextTime' },
    { name: 'Growth Mindset', description: 'Awarded for visible learning, adaptation, and resilience.', icon: 'GrowthMindset' },
    { name: 'Own Your Work', description: 'Awarded for taking ownership of outputs and outcomes.', icon: 'OwnYourWork' },

    { name: 'Mission Lead', description: 'Awarded for leading a mission with accountability.', icon: 'MissionLead' },
    { name: 'Team Organizer', description: 'Awarded for coordinating people, tasks, and rhythm.', icon: 'TeamOrganizer' },
    { name: 'Initiative Taker', description: 'Awarded for proactively moving work forward.', icon: 'InitiativeTaker' },
    { name: 'Mentor Mindset', description: 'Awarded for helping others learn and progress.', icon: 'MentorMindset' },
    { name: 'Future Lead', description: 'Awarded for showing leadership potential.', icon: 'FutureLead' },
  ];

  // 1. Clean up the old default seed admin if it exists
  const oldAdmin = await prisma.user.findUnique({
    where: { email: 'admin@iceberg.com' },
  });
  if (oldAdmin) {
    console.log('Removing old default admin account...');
    // Delete any relations first if necessary, but since it's just seeded, deleteMany is safe.
    await prisma.user.delete({ where: { email: 'admin@iceberg.com' } });
  }

  // 2. Upsert the specified admin users
  for (const adminData of adminUsers) {
    const passwordHash = await bcrypt.hash(adminData.password, 10);
    const existingUser = await prisma.user.findUnique({
      where: { email: adminData.email },
    });

    if (!existingUser) {
      console.log(`Creating Admin: ${adminData.name} (${adminData.email})...`);
      await prisma.user.create({
        data: {
          name: adminData.name,
          email: adminData.email,
          password_hash: passwordHash,
          role: Role.ADMIN,
        },
      });
    } else {
      console.log(`Updating existing Admin data: ${adminData.email}...`);
      await prisma.user.update({
        where: { email: adminData.email },
        data: {
          name: adminData.name,
          role: Role.ADMIN,
        },
      });
    }
  }

  // Mehmet Bulut was previously added as a mentor; promote the existing record to Admin.
  const mehmetBulut = await prisma.user.findFirst({
    where: { name: 'Mehmet Bulut' },
  });
  if (mehmetBulut) {
    console.log('Promoting Mehmet Bulut to Admin...');
    await prisma.user.update({
      where: { id: mehmetBulut.id },
      data: { role: Role.ADMIN },
    });
  }

  // 3. Upsert mentors
  for (const mentorData of mentorUsers) {
    const passwordHash = await bcrypt.hash(mentorData.password, 10);
    const existingUser = await prisma.user.findUnique({
      where: { email: mentorData.email },
    });

    if (!existingUser) {
      console.log(`Creating Mentor: ${mentorData.name} (${mentorData.email})...`);
      await prisma.user.create({
        data: {
          name: mentorData.name,
          email: mentorData.email,
          password_hash: passwordHash,
          role: Role.MENTOR,
        },
      });
    } else {
      console.log(`Updating existing Mentor data: ${mentorData.email}...`);
      await prisma.user.update({
        where: { email: mentorData.email },
        data: {
          name: mentorData.name,
          role: Role.MENTOR,
        },
      });
    }
  }

  // 4. Seed the original Cube, mysterious Cubes, and experienced Cubes.
  await prisma.$transaction(async (tx) => {
    // Check if we need to shift existing profiles (idempotent shift check)
    const needShiftProfile = await tx.cubeProfile.findFirst({
      where: {
        cube_number: '001',
        user: { email: 'elif.yildiz@iceberg-digital.co.uk' }
      }
    });

    if (needShiftProfile) {
      console.log('Database shift detected. Moving profiles in descending order to avoid unique constraints...');
      const allProfiles = await tx.cubeProfile.findMany({
        include: { user: true }
      });
      
      const sortedProfiles = allProfiles
        .map(p => ({ p, num: parseInt(p.cube_number, 10) }))
        .filter(item => !isNaN(item.num))
        .sort((a, b) => b.num - a.num);

      for (const { p, num } of sortedProfiles) {
        let newNum: number;
        if (num >= 1 && num <= 5) {
          newNum = num + 1;
        } else if (num === 6) {
          newNum = 8;
        } else if (num >= 7) {
          newNum = num + 2;
        } else {
          continue; // Keep 000 as is
        }
        
        const newCubeNumber = String(newNum).padStart(3, '0');
        console.log(`Shifting profile of ${p.user.email} from ${p.cube_number} to ${newCubeNumber}`);
        await tx.cubeProfile.update({
          where: { id: p.id },
          data: { cube_number: newCubeNumber }
        });
      }
    }

    // A. Seed Original Cube #000
    const originalCubePasswordHash = await bcrypt.hash(cubePassword, 10);
    const existingOriginalUser = await tx.user.findUnique({
      where: { email: originalCube.email }
    });

    if (!existingOriginalUser) {
      console.log(`Creating Original Cube: ${originalCube.name} (${originalCube.email}) as Cube #${originalCube.cube_number}...`);
      const user = await tx.user.create({
        data: {
          name: originalCube.name,
          email: originalCube.email,
          password_hash: originalCubePasswordHash,
          role: Role.CUBE
        }
      });

      await tx.cubeProfile.create({
        data: {
          user_id: user.id,
          cube_number: originalCube.cube_number,
          cohort: 'Unknown',
          university: '',
          department: '',
          skills: [],
          interests: [],
          current_level: CubeLevel.Cube,
          internship_status: 'No further information available.',
          is_founding_cube: false
        }
      });
    } else {
      console.log(`Updating Original Cube: ${originalCube.email} as Cube #${originalCube.cube_number}.`);
      await tx.user.update({
        where: { email: originalCube.email },
        data: {
          name: originalCube.name,
          role: Role.CUBE,
        }
      });

      const existingOriginalProfile = await tx.cubeProfile.findUnique({
        where: { user_id: existingOriginalUser.id }
      });

      if (existingOriginalProfile) {
        console.log(`Original Cube profile already exists. Skipping profile update.`);
      } else {
        await tx.cubeProfile.create({
          data: {
            user_id: existingOriginalUser.id,
            cube_number: originalCube.cube_number,
            cohort: 'Unknown',
            university: '',
            department: '',
            skills: [],
            interests: [],
            current_level: CubeLevel.Cube,
            internship_status: 'No further information available.',
            is_founding_cube: false
          }
        });
      }
    }

    // B. Seed Special Cubes #001 & #007
    const markMentor = await tx.user.findUnique({
      where: { email: 'mark@iceberg-digital.co.uk' }
    });
    const markMentorId = markMentor ? markMentor.id : null;

    for (const spec of newSpecialCubes) {
      const specPasswordHash = await bcrypt.hash(cubePassword, 10);
      
      let existingUser = await tx.user.findUnique({
        where: { email: spec.email }
      });

      if (!existingUser) {
        const placeholderEmail = `mysterious.${spec.cube_number}@iceberg-digital.co.uk`;
        const placeholderUser = await tx.user.findUnique({
          where: { email: placeholderEmail }
        });
        if (placeholderUser) {
          console.log(`Found placeholder user ${placeholderEmail}. Renaming to ${spec.email}...`);
          existingUser = await tx.user.update({
            where: { id: placeholderUser.id },
            data: {
              email: spec.email,
              name: spec.name
            }
          });
        }
      }

      // Check for conflicting cube number
      const conflictingProfile = await tx.cubeProfile.findUnique({
        where: { cube_number: spec.cube_number },
        include: { user: true }
      });
      if (conflictingProfile && (!existingUser || conflictingProfile.user_id !== existingUser.id)) {
        console.log(`Warning: Cube #${spec.cube_number} is currently assigned to user ${conflictingProfile.user.email}.`);
        if (conflictingProfile.user.email.startsWith('mysterious.')) {
          console.log(`Deleting placeholder user ${conflictingProfile.user.email} to resolve collision...`);
          await tx.cubeProfile.delete({ where: { id: conflictingProfile.id } });
          await tx.user.delete({ where: { id: conflictingProfile.user_id } });
        } else {
          const tempNum = `TEMP-${conflictingProfile.id.slice(0, 8)}`;
          console.log(`Temporarily reassigning user ${conflictingProfile.user.email} to Cube #${tempNum} to avoid collision.`);
          await tx.cubeProfile.update({
            where: { id: conflictingProfile.id },
            data: { cube_number: tempNum }
          });
        }
      }

      if (!existingUser) {
        console.log(`Creating Special Cube: ${spec.name} (${spec.email}) as Cube #${spec.cube_number}...`);
        const user = await tx.user.create({
          data: {
            name: spec.name,
            email: spec.email,
            password_hash: specPasswordHash,
            role: Role.CUBE
          }
        });

        await tx.cubeProfile.create({
          data: {
            user_id: user.id,
            cube_number: spec.cube_number,
            cohort: spec.cohort,
            university: '',
            department: '',
            skills: [],
            interests: [],
            current_level: spec.current_level,
            internship_status: spec.internship_status,
            is_founding_cube: spec.is_founding_cube,
            assigned_mentor_id: markMentorId
          }
        });
      } else {
        console.log(`Updating Special Cube: ${spec.email} as Cube #${spec.cube_number}.`);
        await tx.user.update({
          where: { email: spec.email },
          data: {
            name: spec.name,
            role: Role.CUBE,
          }
        });

        await tx.cubeProfile.upsert({
          where: { user_id: existingUser.id },
          create: {
            user_id: existingUser.id,
            cube_number: spec.cube_number,
            cohort: spec.cohort,
            university: '',
            department: '',
            skills: [],
            interests: [],
            current_level: spec.current_level,
            internship_status: spec.internship_status,
            is_founding_cube: spec.is_founding_cube,
            assigned_mentor_id: markMentorId
          },
          update: {
            cube_number: spec.cube_number
          }
        });
      }
    }

    // C. Seed Senior Cubes (002-006, 008)
    for (const fellow of seniorCubes) {
      const passwordHash = await bcrypt.hash(cubePassword, 10);
      
      const conflictingProfile = await tx.cubeProfile.findUnique({
        where: { cube_number: fellow.cube_number },
        include: { user: true }
      });
      if (conflictingProfile && conflictingProfile.user.email !== fellow.email) {
        console.log(`Warning: Cube #${fellow.cube_number} is currently assigned to user ${conflictingProfile.user.email}.`);
        if (conflictingProfile.user.email.startsWith('mysterious.')) {
          console.log(`Deleting placeholder user ${conflictingProfile.user.email} to resolve collision...`);
          await tx.cubeProfile.delete({ where: { id: conflictingProfile.id } });
          await tx.user.delete({ where: { id: conflictingProfile.user_id } });
        } else {
          const tempNum = `TEMP-${conflictingProfile.id.slice(0, 8)}`;
          console.log(`Temporarily reassigning user ${conflictingProfile.user.email} to Cube #${tempNum} to avoid collision.`);
          await tx.cubeProfile.update({
            where: { id: conflictingProfile.id },
            data: { cube_number: tempNum }
          });
        }
      }

      const existingUser = await tx.user.findUnique({
        where: { email: fellow.email }
      });

      if (!existingUser) {
        console.log(`Creating Senior Cube: ${fellow.name} (${fellow.email}) as Cube #${fellow.cube_number}...`);
        const user = await tx.user.create({
          data: {
            name: fellow.name,
            email: fellow.email,
            password_hash: passwordHash,
            role: Role.CUBE
          }
        });

        await tx.cubeProfile.create({
          data: {
            user_id: user.id,
            cube_number: fellow.cube_number,
            cohort: 'Iceberg Fellows',
            university: '',
            department: '',
            skills: [],
            interests: [],
            current_level: CubeLevel.Senior_Cube,
            internship_status: 'Senior Cube',
            is_founding_cube: true
          }
        });
      } else {
        console.log(`Updating Senior Cube: ${fellow.email} as Cube #${fellow.cube_number}.`);
        await tx.user.update({
          where: { email: fellow.email },
          data: {
            name: fellow.name,
            role: Role.CUBE,
          }
        });

        const existingProfile = await tx.cubeProfile.findUnique({
          where: { user_id: existingUser.id }
        });

        if (existingProfile) {
          console.log(`Senior Cube profile already exists. Skipping profile update.`);
        } else {
          await tx.cubeProfile.create({
            data: {
              user_id: existingUser.id,
              cube_number: fellow.cube_number,
              cohort: 'Iceberg Fellows',
              university: '',
              department: '',
              skills: [],
              interests: [],
              current_level: CubeLevel.Senior_Cube,
              internship_status: 'Senior Cube',
              is_founding_cube: true
            }
          });
        }
      }
    }
  });

  // 5. Seed Cubes (Students)
  const cubeStudents = [
    { name: 'Mesut Umur Tokyürek', email: 'umrtkyrk@gmail.com', internship_status: 'No mandatory internship' },
    { name: 'Barış Tepe', email: 'baristepe04@gmail.com', internship_status: 'Will submit mandatory internship document' },
    { name: 'Süleyman Emre Parlak', email: 'emre-parlak2002@hotmail.com', internship_status: 'No mandatory internship' },
    { name: 'Ozan Uslan', email: 'uslanozan@gmail.com', internship_status: 'No mandatory internship' },
    { name: 'Gözde Kaçar', email: 'kcr.gozde@gmail.com', internship_status: 'No mandatory internship' },
    { name: 'Ayşenur Demezoğlu', email: 'aysenurdemezoglu@gmail.com', internship_status: 'No mandatory internship' },
    { name: 'Zelal Erpay', email: 'zelalerpay06@gmail.com', internship_status: 'No mandatory internship' },
    { name: 'Tarık Deniz', email: 'tarikdeniz2002@gmail.com', internship_status: 'No mandatory internship' },
    { name: 'Emir Bakkal', email: 'ebakkal2@gmail.com', internship_status: 'No mandatory internship' },
    { name: 'Henife Yaylı', email: 'henifeyayli@gmail.com', internship_status: 'Internship document submitted' },
    { name: 'Medine Kaynak', email: 'medinekaynak2906@gmail.com', internship_status: 'Internship document submitted' },
    { name: 'Ali Çağlar Koçer', email: 'alicaglarkocer@gmail.com', internship_status: 'Internship document submitted' },
    { name: 'Doğukan Taha Tıraş', email: 'dogukantt27@gmail.com', internship_status: 'Internship document submitted' },
    { name: 'Enes Yusuf Gökçe', email: 'eyusufgokce@gmail.com', internship_status: 'Internship document submitted' },
    { name: 'Seyfullah Korkmaz', email: 'seyfullahkorkmaz115@gmail.com', internship_status: 'Internship document submitted' }
  ];

  for (const student of cubeStudents) {
    const existingUser = await prisma.user.findUnique({
      where: { email: student.email }
    });

    if (!existingUser) {
      console.log(`Creating Cube User: ${student.name} (${student.email})...`);
      const nextCubeNumber = await getNextCubeNumber(prisma);
      const passwordHash = await bcrypt.hash(cubePassword, 10);

      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: student.name,
            email: student.email,
            password_hash: passwordHash,
            role: Role.CUBE
          }
        });

        await tx.cubeProfile.create({
          data: {
            user_id: user.id,
            cube_number: nextCubeNumber,
            cohort: 'Summer 2026',
            university: 'Muğla Sıtkı Koçman Üniversitesi',
            department: '',
            skills: [],
            interests: [],
            current_level: CubeLevel.Cube,
            internship_status: student.internship_status,
            is_founding_cube: true
          }
        });
      });
    } else {
      console.log(`Cube user already exists: ${student.email}. Skipping profile update.`);
    }
  }

  // 6. Seed badge definitions only. Awards are intentionally not created here.
  for (const badge of badgeDefinitions) {
    console.log(`Upserting Badge: ${badge.name}...`);
    await prisma.badge.upsert({
      where: { name: badge.name },
      update: {
        description: badge.description,
        icon: badge.icon,
      },
      create: badge,
    });
  }

  // 7. Seed Quests and auto-assign them to all CubeProfiles
  console.log('Seeding quests...');
  const questTemplates = [
    {
      title: 'First Milestone',
      description: 'Complete your very first mission team assignment to kick off your Cube journey.',
      difficulty: 'Common',
      criteria_type: 'missions_completed',
      criteria_value: 1,
      badgeName: 'Builder',
      badgeIcon: 'hammer',
      badgeRarity: 'Common'
    },
    {
      title: 'Consistency Master',
      description: 'Login to the portal daily for 7 consecutive days to keep tabs on updates.',
      difficulty: 'Common',
      criteria_type: 'login_streak',
      criteria_value: 7,
      badgeName: 'GrowthMindset',
      badgeIcon: 'trending-up',
      badgeRarity: 'Common'
    },
    {
      title: 'Reliable Contributor',
      description: 'Attend at least 90% of meetings you are invited to.',
      difficulty: 'Rare',
      criteria_type: 'meeting_attendance',
      criteria_value: 90,
      badgeName: 'NoGhosting',
      badgeIcon: 'user-check',
      badgeRarity: 'Rare'
    },
    {
      title: 'R&D Heavyweight',
      description: 'Build and deliver 3 working POCs or integration candidates.',
      difficulty: 'Epic',
      criteria_type: 'missions_completed',
      criteria_value: 3,
      badgeName: 'DemoMaker',
      badgeIcon: 'play',
      badgeRarity: 'Rare'
    },
    {
      title: 'First Pulse',
      description: 'Post your first mission update to keep your team and mentors aligned.',
      difficulty: 'Common',
      criteria_type: 'mission_updates_count',
      criteria_value: 1,
      badgeName: 'First Pulse',
      badgeIcon: 'activity',
      badgeRarity: 'Common'
    },
    {
      title: 'Daily Signal (30 Days)',
      description: 'Broadcast a mission update every single day for 30 consecutive days.',
      difficulty: 'Rare',
      criteria_type: 'daily_update_streak',
      criteria_value: 30,
      badgeName: 'Daily Broadcaster',
      badgeIcon: 'zap',
      badgeRarity: 'Rare'
    },
    {
      title: 'Unbroken Signal (90 Days)',
      description: 'Achieve a legendary streak: post a mission update every single day for 90 consecutive days.',
      difficulty: 'Epic',
      criteria_type: 'daily_update_streak',
      criteria_value: 90,
      badgeName: 'Beacon of Iceberg',
      badgeIcon: 'flame',
      badgeRarity: 'Epic'
    },
    {
      title: 'Weekly Momentum (8 Weeks)',
      description: 'Post at least one mission update every week for 8 consecutive weeks.',
      difficulty: 'Rare',
      criteria_type: 'weekly_update_streak',
      criteria_value: 8,
      badgeName: 'Weekly Cadence',
      badgeIcon: 'calendar-check',
      badgeRarity: 'Rare'
    },
    {
      title: 'Iron Rhythm (30 Weeks)',
      description: 'Sustain a relentless 30-week unbroken streak of weekly mission progress updates.',
      difficulty: 'Epic',
      criteria_type: 'weekly_update_streak',
      criteria_value: 30,
      badgeName: 'Iron Cadence',
      badgeIcon: 'infinity',
      badgeRarity: 'Epic'
    }
  ];

  const cubes = await prisma.cubeProfile.findMany({ select: { id: true } });
  console.log(`Found ${cubes.length} CubeProfile(s) to assign quests.`);

  for (const t of questTemplates) {
    // Ensure reward badge exists
    let badge = await prisma.badge.findUnique({
      where: { name: t.badgeName }
    });

    if (!badge) {
      console.log(`Badge "${t.badgeName}" not found. Creating it...`);
      badge = await prisma.badge.create({
        data: {
          name: t.badgeName,
          description: `Automatically awarded for completing quest: ${t.title}`,
          icon: t.badgeIcon,
          rarity: t.badgeRarity as any
        }
      });
    }

    // Ensure the quest exists
    let quest = await prisma.quest.findFirst({
      where: { title: t.title }
    });

    if (!quest) {
      console.log(`Quest "${t.title}" not found. Creating it...`);
      quest = await prisma.quest.create({
        data: {
          title: t.title,
          description: t.description,
          difficulty: t.difficulty as any,
          criteria_type: t.criteria_type,
          criteria_value: t.criteria_value,
          rewards: {
            connect: [{ id: badge.id }]
          }
        }
      });
    }

    // Assign to existing Cubes
    for (const c of cubes) {
      const existingAssignment = await prisma.cubeQuest.findUnique({
        where: {
          cube_id_quest_id: {
            cube_id: c.id,
            quest_id: quest.id
          }
        }
      });

      if (!existingAssignment) {
        await prisma.cubeQuest.create({
          data: {
            cube_id: c.id,
            quest_id: quest.id,
            current_value: 0
          }
        });
      }
    }
  }

  // The average-score quests (High Achiever, Iceberg Elite Fellow) are no longer
  // seeded: scoring v2 retires them and replaces them (scoringQuests.service).

  const daily30 = await prisma.quest.findFirst({ where: { title: 'Daily Signal (30 Days)' } });
  const daily90 = await prisma.quest.findFirst({ where: { title: 'Unbroken Signal (90 Days)' } });
  if (daily30 && daily90) {
    await prisma.quest.update({
      where: { id: daily90.id },
      data: { dependency_quest_id: daily30.id }
    });
  }

  const weekly8 = await prisma.quest.findFirst({ where: { title: 'Weekly Momentum (8 Weeks)' } });
  const weekly30 = await prisma.quest.findFirst({ where: { title: 'Iron Rhythm (30 Weeks)' } });
  if (weekly8 && weekly30) {
    await prisma.quest.update({
      where: { id: weekly30.id },
      data: { dependency_quest_id: weekly8.id }
    });
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
