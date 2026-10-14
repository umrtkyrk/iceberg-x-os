import { createHash } from 'crypto';
import { loadAdminDashboard } from './adminDashboard.service';
import { generateAdminOperationsBrief } from './ai.service';
import { fallbackOperationsBrief, OperationsBrief } from './adminOperations';

type Briefing = OperationsBrief & {
  source: 'ai' | 'snapshot';
  generatedAt: string;
};
let cached: { signature: string; expiresAt: number; value: Briefing } | null =
  null;
let inFlight: Promise<Briefing> | null = null;

export async function getAdminBriefing(): Promise<Briefing> {
  // Coalesce requests across admins; only one generation runs at a time.
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const dashboard = await loadAdminDashboard();
    const facts = {
      activeCubes: dashboard.activeCubes,
      activeMissions: dashboard.activeMissions,
      actions: dashboard.actions,
      missionPipeline: dashboard.missionsByStatus,
      upcomingDemoDays: dashboard.upcomingDemoDays.map((day) => ({
        title: day.title,
        date: day.date,
      })),
      recentDemos: dashboard.recentDemos.map((demo) => ({
        title: demo.title,
        mission: demo.mission.title,
        submittedAt: demo.submitted_at,
      })),
    };
    const signature = createHash('sha256')
      .update(JSON.stringify(facts))
      .digest('hex');
    if (
      cached &&
      cached.signature === signature &&
      cached.expiresAt > Date.now()
    )
      return cached.value;
    const fallback = fallbackOperationsBrief(
      facts.activeCubes,
      facts.activeMissions,
      facts.actions
    );
    const result = await generateAdminOperationsBrief(facts, fallback);
    const value = { ...result, generatedAt: dashboard.generatedAt };
    cached = {
      signature,
      expiresAt:
        Date.now() + (result.source === 'ai' ? 15 * 60 * 1000 : 60 * 1000),
      value,
    };
    return value;
  })();
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}
