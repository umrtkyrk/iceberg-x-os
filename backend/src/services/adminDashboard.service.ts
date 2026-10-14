import prisma from './prisma';
import {
  ACTIVE_MISSION_STATUSES,
  IN_PROGRAMME_CUBE_LEVELS,
} from '../config/constants';
import { latestCubeRecommendations, OperationAction } from './adminOperations';

export async function loadAdminDashboard() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const programme = {
    current_level: { in: IN_PROGRAMME_CUBE_LEVELS },
    cube_number: { not: '000' },
  };
  const activeMission = { status: { in: ACTIVE_MISSION_STATUSES } };
  const [
    totalCubes,
    activeCubes,
    activeMissions,
    pendingApplicationsCount,
    pendingDocumentsCount,
    pendingTestimonialsCount,
    unassignedMentors,
    quietMissions,
    missionsByStatus,
    upcomingDemoDays,
    upcomingMeetings,
    recentDemos,
    recentBadges,
    feedback,
    recentUpdates,
  ] = await Promise.all([
    prisma.cubeProfile.count({ where: { cube_number: { not: '000' } } }),
    prisma.cubeProfile.count({ where: programme }),
    prisma.mission.count({ where: activeMission }),
    prisma.cubeApplication.count({ where: { status: 'pending' } }),
    prisma.cubeDocument.count({ where: { status: 'PENDING_REVIEW' } }),
    prisma.testimonial.count({ where: { is_approved: false } }),
    prisma.cubeProfile.findMany({
      where: { ...programme, assigned_mentor_id: null },
      select: { id: true, cube_number: true, user: { select: { name: true } } },
      orderBy: { cube_number: 'asc' },
    }),
    prisma.mission.findMany({
      where: {
        ...activeMission,
        created_at: { lt: weekAgo },
        updates: { none: { created_at: { gte: weekAgo } } },
        demo_submissions: { none: { submitted_at: { gte: weekAgo } } },
      },
      select: { id: true, title: true, status: true },
      orderBy: { updated_at: 'asc' },
    }),
    prisma.mission.groupBy({ by: ['status'], _count: true }),
    prisma.demoDay.findMany({
      where: { date: { gte: now } },
      take: 3,
      orderBy: { date: 'asc' },
    }),
    prisma.meeting.findMany({
      where: { date: { gte: now }, is_completed: false },
      take: 3,
      orderBy: { date: 'asc' },
      select: { id: true, title: true, date: true },
    }),
    prisma.demoSubmission.findMany({
      take: 5,
      orderBy: { submitted_at: 'desc' },
      include: {
        mission: { select: { title: true } },
        submitted_by: { select: { name: true } },
      },
    }),
    prisma.cubeBadge.findMany({
      take: 5,
      orderBy: { awarded_at: 'desc' },
      include: {
        cube: { include: { user: { select: { name: true } } } },
        badge: true,
      },
    }),
    prisma.mentorFeedback.findMany({
      where: { cube: { cube_profile: { is: programme } } },
      select: {
        cube_id: true,
        recommended_next_step: true,
        created_at: true,
        cube: {
          select: {
            name: true,
            cube_profile: { select: { id: true, current_level: true } },
          },
        },
        mentor: { select: { name: true } },
      },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    }),
    prisma.update.findMany({
      take: 8,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        type: true,
        content: true,
        blockers: true,
        created_at: true,
        mission_id: true,
        mission: { select: { title: true } },
        cube: { select: { name: true } },
      },
    }),
  ]);

  // Resolve the newest recommendation before filtering, so an old risk flag cannot outlive newer feedback.
  const latestFeedback = latestCubeRecommendations(feedback);
  const progressionCubes = latestFeedback
    .filter((f) =>
      [
        'Consider_for_Senior_Cube',
        'Consider_as_Iceberger',
        'Consider_as_Alumni',
      ].includes(f.recommended_next_step)
    )
    .map((f) => ({
      cubeId: f.cube.cube_profile?.id,
      name: f.cube.name,
      current_level: f.cube.cube_profile?.current_level,
      recommended: f.recommended_next_step,
      by: f.mentor.name,
    }));
  const inactiveRiskCubes = latestFeedback
    .filter((f) =>
      ['Inactive_Risk', 'Needs_Support'].includes(f.recommended_next_step)
    )
    .map((f) => ({
      cubeId: f.cube.cube_profile?.id,
      name: f.cube.name,
      by: f.mentor.name,
    }));
  const actions: OperationAction[] = [
    {
      id: 'support',
      title: 'Check in with Cubes needing support',
      detail: `${inactiveRiskCubes.length} Cubes have a current support or inactivity recommendation.`,
      href: '/directory',
      priority: 'high',
      count: inactiveRiskCubes.length,
    },
    {
      id: 'quiet',
      title: 'Check missions with no recent activity',
      detail: `${quietMissions.length} active missions have no updates or demos in the last 7 days.`,
      href: '/missions',
      priority: 'high',
      count: quietMissions.length,
    },
    {
      id: 'documents',
      title: 'Review uploaded documents',
      detail: `${pendingDocumentsCount} documents are waiting for approval.`,
      href: '/admin/nda',
      priority: 'medium',
      count: pendingDocumentsCount,
    },
    {
      id: 'mentors',
      title: 'Assign a mentor',
      detail: `${unassignedMentors.length} in-programme Cubes have no assigned mentor.`,
      href: '/directory',
      priority: 'medium',
      count: unassignedMentors.length,
    },
    {
      id: 'applications',
      title: 'Review new applications',
      detail: `${pendingApplicationsCount} applications are awaiting a decision.`,
      href: '/admin/applications',
      priority: 'medium',
      count: pendingApplicationsCount,
    },
    {
      id: 'progression',
      title: 'Decide progression recommendations',
      detail: `${progressionCubes.length} Cubes have a current mentor recommendation.`,
      href: '/directory',
      priority: 'medium',
      count: progressionCubes.length,
    },
    {
      id: 'testimonials',
      title: 'Approve testimonials',
      detail: `${pendingTestimonialsCount} testimonials are awaiting moderation.`,
      href: '/admin/testimonials',
      priority: 'low',
      count: pendingTestimonialsCount,
    },
  ].filter((action) => action.count > 0) as OperationAction[];

  return {
    generatedAt: now.toISOString(),
    totalCubes,
    activeCubes,
    activeMissions,
    pendingApplicationsCount,
    pendingDocumentsCount,
    pendingTestimonialsCount,
    unassignedMentors,
    quietMissions,
    missionsByStatus,
    upcomingDemoDays,
    upcomingMeetings,
    recentDemos,
    recentBadges,
    progressionCubes,
    inactiveRiskCubes,
    recentUpdates,
    actions,
  };
}
