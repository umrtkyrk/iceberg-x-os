import React from 'react';
import { Check } from 'lucide-react';

/** The phases a mission moves through, in order. Later statuses fold into the last. */
const STEPS: { label: string; statuses: string[] }[] = [
  { label: 'Selected', statuses: ['idea_pool', 'selected'] },
  { label: 'Research', statuses: ['researching'] },
  { label: 'Build', statuses: ['building_demo'] },
  { label: 'Handover', statuses: ['preparing_handover'] },
  { label: 'Demo ready', statuses: ['demo_ready', 'pending_approval', 'completed', 'reviewed', 'promoted_to_product_backlog'] }
];

export function missionStepIndex(status?: string | null): number {
  const idx = STEPS.findIndex(s => status && s.statuses.includes(status));
  return idx === -1 ? 0 : idx;
}

/** Where the mission is on its way to a demo, at a glance. */
export const MissionStepper: React.FC<{ status?: string | null }> = ({ status }) => {
  const current = missionStepIndex(status);
  return (
    <ol className="flex items-center gap-1.5" aria-label="Mission progress">
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={step.label} className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span
              className={`h-1.5 rounded-full transition-colors ${
                done ? 'bg-magenta' : active ? 'bg-gradient-to-r from-magenta to-pink-400' : 'bg-gray-100'
              }`}
            />
            <span
              className={`flex items-center gap-1 truncate text-[10px] font-extrabold ${
                active ? 'text-magenta' : done ? 'text-gray-600' : 'text-gray-300'
              }`}
            >
              {done && <Check className="h-3 w-3 shrink-0" />}
              <span className="truncate">{step.label}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
};
