import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Crown } from 'lucide-react';
import { getAssetUrl } from '../../utils/assets';
import {
  STAGE_META,
  type HallData,
  type HallPerson,
  type HallStage
} from '../../utils/hallOfFame';

/**
 * Concentric rings, outermost to innermost, as a share of the radar's width.
 * Everyone on a ring is simply "at that stage": there is no ordering among
 * them, and nobody is placed "below" anyone else.
 */
const RINGS: { stage: Exclude<HallStage, 'mentor'>; radius: number; seconds: number; reverse: boolean }[] = [
  { stage: 'cube', radius: 0.455, seconds: 160, reverse: false },
  { stage: 'candidate', radius: 0.365, seconds: 120, reverse: true },
  { stage: 'senior', radius: 0.275, seconds: 95, reverse: false },
  { stage: 'iceberger', radius: 0.185, seconds: 75, reverse: true }
];

const GRADIENTS = [
  'from-pink-500 to-rose-600',
  'from-purple-500 to-indigo-600',
  'from-cyan-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-fuchsia-500 to-pink-600'
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function gradientFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

/** Avatar size as a share of the radar width, by how crowded the ring is. */
function sizeFor(count: number, base: number): number {
  if (count <= 8) return base;
  if (count <= 16) return base * 0.85;
  if (count <= 30) return base * 0.7;
  return base * 0.58;
}

const Avatar: React.FC<{
  person: HallPerson;
  stage: HallStage;
  size: number;
  counterSpin?: { seconds: number; reverse: boolean };
  style?: React.CSSProperties;
}> = ({ person, stage, size, counterSpin, style }) => {
  const meta = STAGE_META[stage];
  const url = person.avatar_url ? getAssetUrl(person.avatar_url) : null;

  return (
    <div className="absolute" style={{ ...style, width: `calc(100cqw * ${size})`, height: `calc(100cqw * ${size})` }}>
      <Link
        to={`/cubes/${person.id}`}
        title={`${person.name} · ${meta.label}`}
        className="group/av relative block h-full w-full"
        style={
          counterSpin
            ? {
                animation: `hof-unspin ${counterSpin.seconds}s linear infinite ${counterSpin.reverse ? 'reverse' : 'normal'}`
              }
            : undefined
        }
      >
        <span
          className={`hof-avatar relative block h-full w-full overflow-hidden rounded-full ring-2 ${meta.avatar} bg-slate-800 shadow-[0_4px_14px_rgba(0,0,0,0.5)] transition duration-200 group-hover/av:scale-125 group-hover/av:ring-4`}
        >
          {url ? (
            <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <span
              className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradientFor(person.name)} font-extrabold text-white`}
              style={{ fontSize: `calc(100cqw * ${size * 0.38})` }}
            >
              {initials(person.name)}
            </span>
          )}
        </span>
        <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-black/85 px-2.5 py-1 text-[11px] font-extrabold text-white opacity-0 shadow-lg backdrop-blur transition group-hover/av:opacity-100">
          {person.name}
          <span className="ml-1.5 font-bold text-white/55">#{person.cube_number}</span>
        </span>
      </Link>
    </div>
  );
};

export const ProgressionRadar: React.FC<{ data: HallData }> = ({ data }) => {
  const placed = useMemo(
    () =>
      RINGS.map(ring => {
        const people = data.stages[ring.stage] || [];
        const n = people.length;
        const size = sizeFor(n, ring.stage === 'cube' ? 0.052 : 0.058);
        // A little stagger on crowded rings so the avatars do not form a wall.
        const items = people.map((person, i) => {
          const angle = (i / Math.max(1, n)) * Math.PI * 2 + ring.radius * 3;
          const wobble = n > 24 ? (i % 2 === 0 ? 0.965 : 1.035) : 1;
          return { person, angle, wobble };
        });
        return { ring, items, size, n };
      }),
    [data]
  );

  const mentors = data.stages.mentor || [];
  const mentorSize = sizeFor(mentors.length, 0.07);

  return (
    <div className="hof-radar relative mx-auto aspect-square w-full max-w-[760px] [container-type:inline-size]">
      {/* Backdrop glow */}
      <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(251,191,36,0.16),transparent_28%),radial-gradient(circle_at_50%_50%,rgba(34,211,238,0.10),transparent_46%),radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.10),transparent_70%)]" />

      {/* Rings, from the rim in */}
      {RINGS.map(({ stage, radius }) => {
        const meta = STAGE_META[stage];
        const d = radius * 2 * 100;
        return (
          <div
            key={stage}
            className={`pointer-events-none absolute left-1/2 top-1/2 rounded-full border border-dashed ${meta.ring}`}
            style={{ width: `${d}%`, height: `${d}%`, transform: 'translate(-50%, -50%)' }}
          />
        );
      })}

      {/* Radar sweep */}
      <div className="hof-sweep pointer-events-none" />

      {/* Stage labels along the vertical axis */}
      {RINGS.map(({ stage, radius }) => {
        const meta = STAGE_META[stage];
        return (
          <span
            key={`label-${stage}`}
            className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-white/10 bg-black/70 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-white/70 backdrop-blur"
            style={{ top: `${(0.5 - radius) * 100}%` }}
          >
            <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${meta.dot}`} />
            {meta.label}
          </span>
        );
      })}

      {/* People, rotating slowly. Each avatar counter-rotates to stay upright. */}
      {placed.map(({ ring, items, size }) => {
        const d = ring.radius * 2 * 100;
        return (
          <div
            key={`people-${ring.stage}`}
            className="absolute left-1/2 top-1/2"
            style={{
              width: `${d}%`,
              height: `${d}%`,
              marginLeft: `-${d / 2}%`,
              marginTop: `-${d / 2}%`,
              animation: `hof-spin ${ring.seconds}s linear infinite ${ring.reverse ? 'reverse' : 'normal'}`
            }}
          >
            {items.map(({ person, angle, wobble }) => (
              <Avatar
                key={person.id}
                person={person}
                stage={ring.stage}
                size={size}
                counterSpin={{ seconds: ring.seconds, reverse: ring.reverse }}
                style={{
                  left: `${50 + 50 * wobble * Math.cos(angle)}%`,
                  top: `${50 + 50 * wobble * Math.sin(angle)}%`,
                  marginLeft: `calc(100cqw * ${-size / 2})`,
                  marginTop: `calc(100cqw * ${-size / 2})`
                }}
              />
            ))}
          </div>
        );
      })}

      {/* Core: Mentors who came up through the ranks */}
      <div className="absolute left-1/2 top-1/2 z-10 flex h-[19%] w-[19%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-amber-300/70 bg-gradient-to-br from-amber-300/25 via-amber-500/15 to-transparent shadow-[0_0_60px_rgba(251,191,36,0.45)]">
        <div className="absolute inset-0 animate-pulse rounded-full border border-amber-200/40" />
        {mentors.length === 0 ? (
          <span className="flex flex-col items-center gap-1 text-amber-200/80">
            <Crown className="h-5 w-5" />
            <span className="text-[9px] font-black uppercase tracking-[0.18em]">Mentors</span>
          </span>
        ) : mentors.length === 1 ? (
          <Avatar
            person={mentors[0]}
            stage="mentor"
            size={mentorSize * 1.15}
            style={{ left: '50%', top: '50%', marginLeft: `calc(100cqw * ${-mentorSize * 0.575})`, marginTop: `calc(100cqw * ${-mentorSize * 0.575})` }}
          />
        ) : (
          mentors.map((person, i) => {
            const angle = (i / mentors.length) * Math.PI * 2 - Math.PI / 2;
            return (
              <Avatar
                key={person.id}
                person={person}
                stage="mentor"
                size={mentorSize}
                style={{
                  left: `${50 + 36 * Math.cos(angle)}%`,
                  top: `${50 + 36 * Math.sin(angle)}%`,
                  marginLeft: `calc(100cqw * ${-mentorSize / 2})`,
                  marginTop: `calc(100cqw * ${-mentorSize / 2})`
                }}
              />
            );
          })
        )}
      </div>
    </div>
  );
};
