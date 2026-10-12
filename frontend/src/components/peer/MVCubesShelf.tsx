import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Sparkles } from 'lucide-react';
import { UserAvatar } from '../UserAvatar';
import { MVCUBES_STYLE, peerApi } from '../../utils/peer';

/** One category podium. Winners only: there is no ranking anywhere. */
export const MVCubesCard: React.FC<{ category: any; large?: boolean }> = ({ category, large }) => {
  const style = MVCUBES_STYLE[category.category];
  const Icon = style?.icon || Crown;
  const w = category.winner;

  return (
    <article
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${style?.gradient || 'from-magenta to-amber-400'} p-[1.5px] ${
        w ? style?.glow : ''
      } transition hover:-translate-y-1`}
    >
      <div className={`relative flex h-full flex-col rounded-[calc(1.5rem-1.5px)] bg-white ${large ? 'p-7' : 'p-5'}`}>
        <div className="flex items-center justify-between">
          <span
            className={`flex items-center gap-2 rounded-full bg-gradient-to-r ${style?.gradient || ''} px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white`}
          >
            <Icon className="h-3.5 w-3.5" /> {category.label}
          </span>
          {w && <Crown className="h-5 w-5 text-amber-400" />}
        </div>

        {w ? (
          <Link to={`/cubes/${w.cube_id}`} className="group mt-6 flex flex-col items-center gap-3 text-center">
            <span className={`rounded-full bg-gradient-to-br ${style?.gradient} p-1`}>
              <span className="block rounded-full bg-white p-1">
                <UserAvatar name={w.name} avatarUrl={w.avatar_url} size={large ? 'xl' : 'lg'} />
              </span>
            </span>
            <div>
              <p className="text-base font-extrabold text-slate-900 group-hover:text-magenta">{w.name}</p>
              <p className="text-[11px] font-bold text-slate-400">#{w.cube_number}</p>
            </div>
            {w.note && <p className="text-xs font-semibold leading-relaxed text-slate-500">{w.note}</p>}
          </Link>
        ) : (
          <div className="mt-6 flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-300">
              <Sparkles className="h-6 w-6" />
            </span>
            <p className="text-xs font-semibold leading-relaxed text-slate-400">{style?.blurb}</p>
            <p className="text-[11px] font-bold text-slate-300">Not awarded yet</p>
          </div>
        )}
      </div>
    </article>
  );
};

/** Compact shelf for dashboards: this month's winners, link to the full page. */
export const MVCubesShelf: React.FC = () => {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    peerApi.mvcubes().then(setData).catch(() => setData(null));
  }, []);

  if (!data) return null;
  const anyWinner = data.categories.some((c: any) => c.winner);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-extrabold">
            <Crown className="h-5 w-5 text-magenta" /> MVCubes
          </h3>
          <p className="text-xs font-semibold text-slate-400">{data.period_label}</p>
        </div>
        <Link to="/mvcubes" className="text-xs font-extrabold text-magenta hover:underline">
          See all months
        </Link>
      </div>
      {anyWinner ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {data.categories.map((c: any) => (
            <MVCubesCard key={c.category} category={c} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-5 text-xs font-semibold leading-relaxed text-slate-400">
          No MVCubes yet for {data.period_label}. Winners are announced at the end of the month, based on how
          teammates recognised each other.
        </p>
      )}
    </section>
  );
};
