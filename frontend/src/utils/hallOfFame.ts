import { api } from './api';

export type HallStage = 'cube' | 'candidate' | 'senior' | 'iceberger' | 'mentor';

export interface HallPerson {
  id: string;
  name: string;
  cube_number: string;
  cohort: string;
  avatar_url: string | null;
  is_founding_cube: boolean;
  since: string | null;
}

export interface HallData {
  stages: Record<HallStage, HallPerson[]>;
  counts: Record<HallStage, number>;
}

export const HALL_STAGES: HallStage[] = ['cube', 'candidate', 'senior', 'iceberger', 'mentor'];

export const STAGE_META: Record<
  HallStage,
  {
    label: string;
    plural: string;
    blurb: string;
    /** Tailwind colour pieces: ring border, avatar ring, chip. */
    ring: string;
    avatar: string;
    chip: string;
    dot: string;
  }
> = {
  cube: {
    label: 'Cube',
    plural: 'Cubes',
    blurb: 'Building skills through missions, one step at a time.',
    ring: 'border-slate-500/40',
    avatar: 'ring-slate-300/70',
    chip: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400'
  },
  candidate: {
    label: 'Senior Cube candidate',
    plural: 'Senior Cube candidates',
    blurb: 'Standing out. The team has noticed and is watching closely.',
    ring: 'border-sky-400/50',
    avatar: 'ring-sky-300',
    chip: 'bg-sky-50 text-sky-700 border-sky-200',
    dot: 'bg-sky-400'
  },
  senior: {
    label: 'Senior Cube',
    plural: 'Senior Cubes',
    blurb: 'Trusted to lead missions and lift the Cubes around them.',
    ring: 'border-violet-400/50',
    avatar: 'ring-violet-300',
    chip: 'bg-violet-50 text-violet-700 border-violet-200',
    dot: 'bg-violet-400'
  },
  iceberger: {
    label: 'Iceberger',
    plural: 'Icebergers',
    blurb: 'On the main development team. The summit of the programme.',
    ring: 'border-cyan-300/60',
    avatar: 'ring-cyan-200',
    chip: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    dot: 'bg-cyan-300'
  },
  mentor: {
    label: 'Mentor',
    plural: 'Mentors',
    blurb: 'Came up through the ranks and now guide the next Cubes.',
    ring: 'border-amber-300/70',
    avatar: 'ring-amber-300',
    chip: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-400'
  }
};

export const hallApi = {
  get: () => api.get<HallData>('/hall-of-fame'),
  promote: (body: { profileIds?: string[]; all?: boolean }) =>
    api.post<{ promoted: { id: string; name: string }[] }>('/hall-of-fame/promote', body),
  revert: (profileId: string) => api.post(`/hall-of-fame/revert/${profileId}`, {}),
  setCandidate: (profileId: string, value: boolean) =>
    api.patch(`/cubes/${profileId}/senior-candidate`, { value })
};
