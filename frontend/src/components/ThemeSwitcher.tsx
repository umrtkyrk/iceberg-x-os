import React, { useId } from 'react';
import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useTheme, type ThemePreference } from '../context/ThemeContext';

const OPTIONS: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/** Light / Dark / System segmented control. Renders nothing while the flag is off. */
export const ThemeSwitcher: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { enabled, preference, setPreference } = useTheme();
  const labelId = useId();
  if (!enabled) return null;

  return (
    <div className={className}>
      <p id={labelId} className="px-1 pb-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-gray-400">
        Appearance
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1">
        {OPTIONS.map(option => {
          const Icon = option.icon;
          const selected = preference === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setPreference(option.value)}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold transition-colors ${
                selected ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
