export interface OperationAction {
  id: string;
  title: string;
  detail: string;
  href: string;
  priority: 'high' | 'medium' | 'low';
  count: number;
}

export interface OperationsBrief {
  overview: string;
  priorities: { actionId: string; reason: string }[];
}

export function latestCubeRecommendations<T extends { cube_id: string }>(
  rows: T[]
): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.cube_id)) return false;
    seen.add(row.cube_id);
    return true;
  });
}

export function fallbackOperationsBrief(
  activeCubes: number,
  activeMissions: number,
  actions: OperationAction[]
): OperationsBrief {
  return {
    overview: `${activeCubes} Cubes are in the programme and ${activeMissions} missions are active. ${
      actions.length
        ? `${actions.length} areas need attention; start with the highest-priority queue below.`
        : 'No outstanding items were found in the monitored queues.'
    }`,
    priorities: actions
      .slice(0, 3)
      .map((action) => ({ actionId: action.id, reason: action.detail })),
  };
}

/** AI can reference server-owned actions, but cannot invent destinations or counts. */
export function parseOperationsBrief(
  raw: string,
  actions: OperationAction[]
): OperationsBrief {
  const parsed = JSON.parse(raw);
  if (
    typeof parsed.overview !== 'string' ||
    !parsed.overview.trim() ||
    parsed.overview.length > 1200 ||
    !Array.isArray(parsed.priorities)
  ) {
    throw new Error('Invalid operations brief');
  }
  const ids = new Set(actions.map((action) => action.id));
  const seen = new Set<string>();
  const priorities = parsed.priorities
    .filter((item: any) => {
      if (
        !ids.has(item?.actionId) ||
        seen.has(item.actionId) ||
        typeof item.reason !== 'string' ||
        !item.reason.trim() ||
        item.reason.length > 600
      )
        return false;
      seen.add(item.actionId);
      return true;
    })
    .slice(0, 3);
  if (actions.length && !priorities.length)
    throw new Error('Missing operations priorities');
  return { overview: parsed.overview.trim(), priorities };
}
