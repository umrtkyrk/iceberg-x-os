import React, { useCallback, useEffect, useState } from 'react';
import {
  Quote,
  Pin,
  PinOff,
  ThumbsUp,
  TrendingUp,
  Inbox,
  Lightbulb,
  Crown,
  Sparkles,
  HeartHandshake,
  History,
  Info
} from 'lucide-react';
import { peerApi, tagStyle, CATEGORY_LABELS, MVCUBES_STYLE } from '../../utils/peer';
import { PeerTitleCard } from './PeerTitleCard';
import { GiveFeedbackButton } from './GiveFeedbackButton';

interface Props {
  cubeId: string;
  isSelf: boolean;
  name: string;
  avatarUrl?: string | null;
}

/**
 * The peer layer of a profile.
 *
 * Everyone signed in sees titles, pinned quotes and MVCubes awards. The Cube
 * themselves also get a private inbox, the shape of the recognition they have
 * received, and, only when several people agree and a mentor has reviewed it,
 * a gentle growth indicator. Nothing here ever shows who wrote anything.
 */
export const PeerRecognition: React.FC<Props> = ({ cubeId, isSelf, name, avatarUrl }) => {
  const [summary, setSummary] = useState<any>(null);
  const [inbox, setInbox] = useState<any[]>([]);
  const [given, setGiven] = useState<any[]>([]);
  const [showGiven, setShowGiven] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const s = await peerApi.summary(cubeId);
      setSummary(s);
      if (isSelf) {
        const [r, g] = await Promise.all([peerApi.received(), peerApi.given()]);
        setInbox(r);
        setGiven(g);
      }
    } catch (err: any) {
      setError(err.message || 'Could not load peer recognition.');
    } finally {
      setLoading(false);
    }
  }, [cubeId, isSelf]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div className="h-28 animate-pulse rounded-2xl border border-gray-100 bg-white" />;
  }
  if (!summary) return null;

  const titles: any[] = summary.titles || [];
  const pinned: any[] = summary.pinned || [];
  const awards: any[] = summary.awards || [];
  const self = summary.self;
  const hasAnything = titles.length > 0 || pinned.length > 0 || awards.length > 0;
  const tagEntries: [string, number][] = self
    ? (Object.entries(self.tags || {}) as [string, number][]).sort((a, b) => b[1] - a[1])
    : [];
  const maxTag = Math.max(1, ...tagEntries.map(t => t[1]));

  return (
    <section className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-subtle">
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-magenta/10 via-amber-300/10 to-transparent blur-2xl" />

      <header className="relative flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-extrabold">
          <HeartHandshake className="h-5 w-5 text-magenta" />
          <span>Peer Recognition</span>
        </h3>
        <GiveFeedbackButton receiver={isSelf ? null : { id: cubeId, name, avatarUrl }} variant="soft" label={`Recognise ${name.split(' ')[0]}`} />
      </header>

      {error && (
        <p className="relative mt-3 flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
          <Info className="h-3.5 w-3.5" /> {error}
        </p>
      )}

      {/* Growth indicator: calm, supportive, category only */}
      {isSelf && self?.growth_indicator && (
        <div className="peer-soft-pulse relative mt-5 flex gap-4 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
            <Lightbulb className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-extrabold text-amber-900">
              A growth area to explore: {self.growth_indicator.category}
            </p>
            <p className="mt-1 text-xs font-medium leading-relaxed text-amber-800/80">
              {self.growth_indicator.message} Nobody's words are shared with you and there is nothing you
              need to fix on your own. It is simply a good topic for your next mentor conversation.
            </p>
          </div>
        </div>
      )}

      {/* Titles */}
      <div className="relative mt-5">
        <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Earned from teammates</p>
        {titles.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[...titles]
              .sort((a, b) => ['Legendary', 'Epic', 'Rare', 'Common'].indexOf(a.rarity) - ['Legendary', 'Epic', 'Rare', 'Common'].indexOf(b.rarity))
              .map(t => (
                <PeerTitleCard key={t.category} title={t} />
              ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-gray-200 p-4 text-xs font-semibold leading-relaxed text-slate-400">
            {isSelf
              ? 'Titles appear once at least three teammates recognise the same strength. Recognising others is the fastest way to start the conversation.'
              : `${name.split(' ')[0]} hasn't earned a peer title yet.`}
          </p>
        )}
      </div>

      {/* MVCubes awards */}
      {awards.length > 0 && (
        <div className="relative mt-6">
          <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">MVCubes</p>
          <div className="flex flex-wrap gap-2">
            {awards.map(a => {
              const style = MVCUBES_STYLE[a.category];
              const Icon = style?.icon || Crown;
              return (
                <span
                  key={`${a.period}-${a.category}`}
                  className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-r ${style?.gradient || 'from-magenta to-amber-400'} px-3 py-1.5 text-[11px] font-extrabold text-white shadow-sm`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {CATEGORY_LABELS[a.category] || a.category}
                  <span className="font-bold text-white/80">· {a.period_label}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Pinned quotes */}
      {pinned.length > 0 && (
        <div className="relative mt-6">
          <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
            In their teammates' words{isSelf ? ' · shown on your public profile' : ''}
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {pinned.map(p => (
              <figure key={p.id} className="relative rounded-2xl bg-gradient-to-br from-slate-50 to-white p-4 ring-1 ring-gray-100">
                <Quote className="absolute right-3 top-3 h-5 w-5 text-magenta/20" />
                <blockquote className="text-sm font-medium italic leading-relaxed text-slate-700">“{p.note}”</blockquote>
                <figcaption className="mt-3 flex flex-wrap items-center gap-1.5">
                  {(p.tags || []).map((t: string) => {
                    const s = tagStyle(t);
                    return (
                      <span key={t} className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${s.tint} ${s.text}`}>
                        {CATEGORY_LABELS[t] || t}
                      </span>
                    );
                  })}
                  <span className="text-[10px] font-bold text-slate-400">· {p.period}</span>
                </figcaption>
                {isSelf && (
                  <button
                    onClick={() => act(p.id, () => peerApi.unpin(p.id))}
                    disabled={busyId === p.id}
                    className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-rose-500"
                  >
                    <PinOff className="h-3 w-3" /> Remove from public profile
                  </button>
                )}
              </figure>
            ))}
          </div>
        </div>
      )}

      {!hasAnything && !isSelf && (
        <p className="relative mt-4 text-xs font-semibold text-slate-400">
          Nothing to show yet. Be the first to recognise something {name.split(' ')[0]} did well.
        </p>
      )}

      {/* Private: only the Cube themselves */}
      {isSelf && self && (
        <div className="relative mt-8 border-t border-gray-100 pt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h4 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
              <Inbox className="h-4 w-4 text-magenta" /> My feedback
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-500">
                private
              </span>
            </h4>
            {self.trend && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold ${
                  self.trend.change_pct >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                {self.trend.change_pct >= 0 ? '+' : ''}
                {self.trend.change_pct}% vs last month
              </span>
            )}
          </div>

          {/* Shape of the recognition */}
          {tagEntries.length > 0 && (
            <div className="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {tagEntries.map(([tag, count]) => {
                const s = tagStyle(tag);
                const Icon = s.icon;
                return (
                  <div key={tag} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${s.tint}`}>
                      <Icon className={`h-4 w-4 ${s.text}`} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between text-[11px] font-extrabold text-slate-700">
                        <span>{CATEGORY_LABELS[tag] || tag}</span>
                        <span>{count} {count === 1 ? 'person' : 'people'}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-magenta to-amber-400"
                          style={{ width: `${(count / maxTag) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Nudge: the point of receiving kudos is choosing which to show */}
          {inbox.some(i => i.note) && pinned.length === 0 && (
            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-magenta/15 bg-magenta/5 p-4">
              <Pin className="mt-0.5 h-4 w-4 shrink-0 text-magenta" />
              <p className="text-xs font-semibold leading-relaxed text-slate-700">
                Pick up to {3} kudos to show on your <b>public profile</b>. It is your call: anyone with your profile
                link will be able to read what you choose, anonymously, and you can remove it at any time.
              </p>
            </div>
          )}

          {/* Inbox */}
          {inbox.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 p-4 text-xs font-semibold leading-relaxed text-slate-400">
              Kudos from your teammates appear here the moment they are sent, anonymously. Nothing yet. Recognising
              someone is the quickest way to start the conversation.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {inbox.map(item => (
                <li key={item.id} className="rounded-2xl border border-gray-100 p-4">
                  {item.note ? (
                    <p className="text-sm font-medium leading-relaxed text-slate-700">“{item.note}”</p>
                  ) : (
                    <p className="text-sm font-medium italic text-slate-400">Recognised without a note.</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.tags.map((t: string) => {
                        const s = tagStyle(t);
                        return (
                          <span key={t} className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${s.tint} ${s.text}`}>
                            {CATEGORY_LABELS[t] || t}
                          </span>
                        );
                      })}
                      <span className="text-[10px] font-bold text-slate-400">· {item.period}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => act(item.id, () => peerApi.helpful(item.id))}
                        disabled={item.helpful || busyId === item.id}
                        title="Tell the system this was useful. It never tells the sender who you are, or who they are."
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold transition ${
                          item.helpful ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                        }`}
                      >
                        <ThumbsUp className="h-3 w-3" /> {item.helpful ? 'Helpful' : 'This helped'}
                      </button>
                      {item.note && (
                        <button
                          onClick={() => act(item.id, () => (item.pinned ? peerApi.unpin(item.id) : peerApi.pin(item.id)))}
                          disabled={busyId === item.id}
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold transition ${
                            item.pinned ? 'bg-magenta-100 text-magenta' : 'bg-slate-100 text-slate-600 hover:bg-magenta-100 hover:text-magenta'
                          }`}
                        >
                          {item.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                          {item.pinned ? 'Shown publicly · Remove' : 'Show on public profile'}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* What I have given */}
          <div className="mt-5">
            <button
              onClick={() => setShowGiven(v => !v)}
              className="inline-flex items-center gap-2 text-xs font-extrabold text-slate-500 hover:text-magenta"
            >
              <History className="h-3.5 w-3.5" />
              {showGiven ? 'Hide' : 'Show'} feedback I've given ({given.length})
            </button>
            {showGiven && (
              <ul className="mt-3 flex flex-col gap-2">
                {given.length === 0 && <li className="text-xs font-semibold text-slate-400">You haven't given any feedback yet.</li>}
                {given.map(g => (
                  <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs">
                    <span className="font-extrabold text-slate-700">
                      {g.kind === 'KUDOS' ? 'Kudos' : g.kind === 'OBSERVATION' ? 'Observation' : 'Concern'} for {g.receiver.name}
                    </span>
                    <span className="flex items-center gap-2">
                      {g.dismissed && (
                        <span
                          className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-700"
                          title="After talking to the person, a mentor judged this concern unfounded. It no longer counts."
                        >
                          Reviewed: not confirmed
                        </span>
                      )}
                      <span className="font-bold text-slate-400">{new Date(g.created_at).toLocaleDateString('en-GB')}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {isSelf && !self && (
        <p className="relative mt-4 flex items-center gap-2 text-xs font-semibold text-slate-400">
          <Sparkles className="h-3.5 w-3.5" /> Your private feedback view will appear here.
        </p>
      )}
    </section>
  );
};
