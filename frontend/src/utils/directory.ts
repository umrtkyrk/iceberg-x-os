import { isInProgramme } from './cubeStatus';

export interface DirectoryMission {
  id: string;
  title: string;
  status: string;
}
export interface DirectoryCube {
  id: string;
  user_id?: string;
  cube_number?: string;
  cohort?: string;
  university?: string;
  current_level?: string;
  avatar_url?: string | null;
  is_founding_cube?: boolean;
  nda_signed?: boolean;
  nda_status?: string;
  skills?: string[] | null;
  interests?: string[] | null;
  user?: { name?: string; avatar_url?: string | null } | null;
  assigned_mentor?: { id: string; name?: string } | null;
  team_memberships?:
    | { team?: { mission?: DirectoryMission | null } | null }[]
    | null;
  _count?: { cube_badges?: number };
  quiz_attempts?:
    | {
        score: number;
        badge_awarded?: { name?: string; rarity?: string } | null;
      }[]
    | null;
}
export const isOriginalCube = (cube: DirectoryCube) =>
  /^0+$/.test(cube.cube_number || '');
export const isArchivedCube = (cube: DirectoryCube) =>
  ['Alumni', 'Former_Cube'].includes(cube.current_level || '');
const terminal = new Set([
  'completed',
  'reviewed',
  'promoted_to_product_backlog',
  'archived',
  'cancelled',
]);
export function activeDirectoryMissions(
  cube: DirectoryCube
): DirectoryMission[] {
  if (!isInProgramme(cube.current_level) || isOriginalCube(cube)) return [];
  const unique = new Map<string, DirectoryMission>();
  for (const membership of cube.team_memberships || []) {
    const mission = membership?.team?.mission;
    if (mission?.id && !terminal.has(mission.status))
      unique.set(mission.id, mission);
  }
  return [...unique.values()];
}
export function directoryStats(cubes: DirectoryCube[], selfId?: string) {
  const people = cubes.filter((cube) => !isOriginalCube(cube));
  const programme = people.filter((cube) => isInProgramme(cube.current_level));
  return {
    total: people.length,
    programme: programme.length,
    teammates: programme.filter((cube) => cube.id !== selfId).length,
    senior: programme.filter((cube) => cube.current_level === 'Senior_Cube')
      .length,
    noMission: programme.filter((cube) => !activeDirectoryMissions(cube).length)
      .length,
    noMentor: programme.filter((cube) => !cube.assigned_mentor?.id).length,
    ndaOutstanding: programme.filter(
      (cube) => effectiveNdaStatus(cube) !== 'signed'
    ).length,
    alumni: people.filter((cube) => cube.current_level === 'Alumni').length,
    skills: new Set(
      programme
        .flatMap((cube) => cube.skills || [])
        .map((skill) => skill.toLocaleLowerCase())
    ).size,
    missions: new Set(
      programme.flatMap((cube) =>
        activeDirectoryMissions(cube).map((mission) => mission.id)
      )
    ).size,
  };
}
export const effectiveNdaStatus = (cube: DirectoryCube) =>
  cube.nda_status || (cube.nda_signed ? 'signed' : 'not_sent');
export function matchesDirectorySearch(cube: DirectoryCube, query: string) {
  const tokens = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const haystack = [
    cube.user?.name || '',
    '#' + (cube.cube_number || ''),
    cube.university || '',
    cube.cohort || '',
    cube.assigned_mentor?.name || '',
    ...(cube.skills || []),
    ...(cube.interests || []),
    ...activeDirectoryMissions(cube).map((mission) => mission.title),
    ...(isOriginalCube(cube) ? ['the original cube classified'] : []),
  ]
    .join(' ')
    .toLocaleLowerCase();
  return tokens.every((token) => haystack.includes(token));
}
export function directoryOptions(values: string[]) {
  const unique = new Map<string, string>();
  for (const raw of values) {
    const value = raw.trim();
    if (value && !unique.has(value.toLocaleLowerCase()))
      unique.set(value.toLocaleLowerCase(), value);
  }
  return [...unique.values()].sort((a, b) => a.localeCompare(b));
}
