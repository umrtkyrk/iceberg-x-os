import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ChevronDown,
  Search,
  Check,
  Lock,
  ShieldCheck,
  Eye,
  HeartHandshake,
  AlertTriangle,
  Info,
  Sparkles,
  EyeOff,
  Send,
  ArrowRight
} from 'lucide-react';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { UserAvatar } from '../UserAvatar';
import {
  peerApi,
  tagStyle,
  type PeerBudget,
  type PeerCatalog,
  type PeerKind,
  type PeerTag
} from '../../utils/peer';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pre-select the person (from a profile or directory card). */
  receiver?: { id: string; name: string; avatarUrl?: string | null } | null;
  onSent?: () => void;
}

const KIND_META: Record<
  PeerKind,
  { label: string; tagline: string; icon: React.ComponentType<{ className?: string }>; accent: string }
> = {
  KUDOS: {
    label: 'Recognise',
    tagline: 'Celebrate something someone did well',
    icon: HeartHandshake,
    accent: 'from-magenta via-pink-500 to-amber-400'
  },
  OBSERVATION: {
    label: "Couldn't see their work",
    tagline: 'A neutral note, not an accusation',
    icon: Eye,
    accent: 'from-sky-400 to-indigo-500'
  },
  CONCERN: {
    label: 'Raise a concern',
    tagline: 'Read by mentors, never shown to the person',
    icon: AlertTriangle,
    accent: 'from-amber-400 to-rose-500'
  }
};

const IN_PROGRAMME = ['Cube', 'Senior_Cube'];

export const PeerFeedbackComposer: React.FC<Props> = ({ open, onClose, receiver, onSent }) => {
  const { user } = useAuth();
  const [catalog, setCatalog] = useState<PeerCatalog | null>(null);
  const [budget, setBudget] = useState<PeerBudget | null>(null);
  const [cubes, setCubes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [kind, setKind] = useState<PeerKind>('KUDOS');
  const [target, setTarget] = useState<{ id: string; name: string; avatarUrl?: string | null } | null>(null);
  const [query, setQuery] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [contextId, setContextId] = useState<string>('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ kind: PeerKind; budget: PeerBudget | null } | null>(null);

  // Reset whenever the composer is (re)opened.
  useEffect(() => {
    if (!open) return;
    setKind('KUDOS');
    setTarget(receiver || null);
    setQuery('');
    setTags([]);
    setNote('');
    setContextId('');
    setConfirmed(false);
    setError(null);
    setSent(null);

    setLoading(true);
    Promise.all([peerApi.catalog(), peerApi.budget(), api.get('/cubes')])
      .then(([cat, bud, list]) => {
        setCatalog(cat);
        setBudget(bud);
        setCubes(list);
      })
      .catch((err: any) => setError(err.message || 'Could not load peer feedback.'))
      .finally(() => setLoading(false));
  }, [open, receiver?.id]);

  // Keep the page behind the dialog from scrolling (and rubber-banding on iOS).
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Changing the type invalidates tags and the concern confirmation.
  useEffect(() => {
    setTags([]);
    setConfirmed(false);
  }, [kind]);

  const tagList: PeerTag[] = useMemo(() => {
    if (!catalog) return [];
    if (kind === 'KUDOS') return catalog.kudos_tags;
    if (kind === 'OBSERVATION') return catalog.observation_tags;
    return catalog.concern_tags;
  }, [catalog, kind]);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cubes
      .filter(c => c.id !== user?.cubeProfileId && IN_PROGRAMME.includes(c.current_level))
      .filter(c => !q || (c.user?.name || '').toLowerCase().includes(q) || String(c.cube_number || '').includes(q))
      .slice(0, 8);
  }, [cubes, query, user?.cubeProfileId]);

  // Missions both people were part of, so a concern can point at real work.
  const sharedMissions = useMemo(() => {
    if (!target) return [] as { id: string; title: string }[];
    const mine = cubes.find(c => c.id === user?.cubeProfileId);
    const theirs = cubes.find(c => c.id === target.id);
    const missionsOf = (c: any) => {
      const map = new Map<string, string>();
      (c?.team_memberships || []).forEach((m: any) => {
        const mission = m.team?.mission;
        if (mission) map.set(mission.id, mission.title);
      });
      return map;
    };
    const a = missionsOf(mine);
    const b = missionsOf(theirs);
    return [...b.entries()].filter(([id]) => a.has(id)).map(([id, title]) => ({ id, title }));
  }, [cubes, target, user?.cubeProfileId]);

  useEffect(() => {
    setContextId('');
  }, [target?.id]);

  if (!open) return null;

  const limits = catalog?.limits;
  const noteMax = limits?.note_max_length ?? 500;
  const maxTags = limits?.max_tags ?? 3;
  const noteLen = note.trim().length;
  const needsLongNote =
    kind === 'CONCERN' && !contextId && noteLen < (limits?.note_min_length_other_context ?? 20);
  const kudosEmpty = kind === 'KUDOS' && (budget?.kudos.remaining ?? 1) <= 0;
  const concernEmpty = kind !== 'KUDOS' && (budget?.concerns.remaining_today ?? 1) <= 0;

  const canSubmit =
    !!target &&
    tags.length > 0 &&
    !submitting &&
    !kudosEmpty &&
    !concernEmpty &&
    (kind !== 'CONCERN' || (confirmed && !needsLongNote));

  const toggleTag = (key: string) => {
    setTags(prev =>
      prev.includes(key) ? prev.filter(t => t !== key) : prev.length >= maxTags ? prev : [...prev, key]
    );
  };

  const submit = async () => {
    if (!target || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await peerApi.create({
        receiver_id: target.id,
        kind,
        tags,
        note: note.trim() || null,
        context_type: contextId ? 'MISSION' : 'OTHER',
        context_id: contextId || null,
        confirmed_firsthand: kind === 'CONCERN' ? confirmed : undefined
      });
      setSent({ kind, budget: res.budget });
      onSent?.();
    } catch (err: any) {
      setError(err.message || 'Could not send feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  const meta = KIND_META[kind];

  const guidance = (
      <div className="relative flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <span className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${meta.accent} shadow-lg`}>
            <meta.icon className="h-5 w-5 text-white" />
          </span>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/60">Peer feedback</p>
            <h3 className="text-lg font-extrabold leading-tight">Anonymous by design</h3>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-white/75">
          Honest feedback is how quiet, brilliant people get noticed and how teams get better. Nobody,
          including mentors and admins, can see who wrote what.
        </p>

        <div className="flex flex-col gap-2.5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/50">Who sees what</p>
          {kind === 'KUDOS' && (
            <>
              <Visibility who="The person" what="Your words, anonymously, right away. They can choose to show it on their public profile." tone="ok" />
              <Visibility who="Mentors & admins" what="They can read your note and see which mission it was about, never who wrote it." tone="muted" />
              <Visibility who="You" what="Everything you sent, in your own history." tone="muted" />
            </>
          )}
          {kind === 'OBSERVATION' && (
            <>
              <Visibility who="The person" what="Nothing. This is never shown to them." tone="hide" />
              <Visibility who="Mentors & admins" what="They can read it, never who wrote it. It helps tell a quiet star from a real gap." tone="muted" />
            </>
          )}
          {kind === 'CONCERN' && (
            <>
              <Visibility who="The person" what="Never your words. At most a gentle 'growth area' topic, after several people agree and a mentor reviews it." tone="hide" />
              <Visibility who="Mentors & admins" what="They can read what you wrote and which mission it was about, never who wrote it. One concern does not change anyone's score on its own." tone="muted" />
              <Visibility who="Other Cubes" what="Nothing at all." tone="hide" />
            </>
          )}
        </div>

        <div className="flex flex-col gap-2.5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/50">Before you send</p>
          <ul className="flex flex-col gap-2 text-xs leading-relaxed text-white/80">
            <li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" /><span>Describe what you <b className="text-white">observed</b>, not what you think of the person.</span></li>
            <li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" /><span>Be specific: a moment, a task, a result.</span></li>
            <li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" /><span>Skip details only you would know. They could reveal you.</span></li>
            <li className="flex gap-2"><X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" /><span>Don't name other people or share private information.</span></li>
            {kind === 'KUDOS' && (
              <li className="flex gap-2"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" /><span>Recognising someone who rarely speaks up is one of the most useful things you can do here.</span></li>
            )}
          </ul>
        </div>

        {kind === 'CONCERN' && (
          <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-xs leading-relaxed text-amber-100">
            <p className="mb-1.5 flex items-center gap-1.5 font-extrabold text-amber-200">
              <AlertTriangle className="h-3.5 w-3.5" /> Please read this
            </p>
            A single concern changes nothing on its own. It only counts once at least{' '}
            {limits?.k_anonymity ?? 3} independent people raise the same area, and a mentor always
            talks to the person first. Concerns that turn out to be unfounded, or that look like
            retaliation or rivalry, reduce the weight of your future feedback.
          </div>
        )}
      </div>
  );

  // Rendered into <body>: cards in the directory are transformed on hover, and
  // a transformed ancestor would otherwise trap this fixed overlay inside the card.
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label="Give peer feedback"
      onMouseDown={e => e.target === e.currentTarget && onClose()}
    >
      <div className="peer-modal-card relative flex w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-premium md:flex-row">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 rounded-full bg-white/90 md:bg-white/10 md:text-white p-2 text-slate-500 hover:text-slate-900 md:hover:bg-white/20 transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Guidance */}
        <aside className="relative hidden md:flex md:w-[340px] md:shrink-0 flex-col gap-5 overflow-y-auto bg-dark-bg text-white p-7">
          <div className="peer-aurora absolute inset-0 opacity-70 pointer-events-none" />
          {guidance}
        </aside>

        {/* Form */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain p-5 sm:p-8">
          {sent ? (
            <div className="peer-burst m-auto flex max-w-sm flex-col items-center gap-4 py-10 text-center">
              <span className={`flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br ${KIND_META[sent.kind].accent} shadow-lg`}>
                <Check className="h-8 w-8 text-white" />
              </span>
              <h3 className="text-xl font-extrabold text-slate-900">
                {sent.kind === 'KUDOS' ? 'Kudos sent' : 'Thank you'}
              </h3>
              <p className="text-sm leading-relaxed text-slate-500">
                {sent.kind === 'KUDOS'
                  ? `${target?.name || 'They'} will see it right away, anonymously, and can choose to show it on their public profile.`
                  : 'It was recorded anonymously. Mentors can read it, but never who wrote it.'}
              </p>
              {sent.kind === 'KUDOS' && sent.budget && (
                <p className="text-xs font-bold text-slate-400">
                  {sent.budget.kudos.remaining} of {sent.budget.kudos.limit} kudos left this week
                </p>
              )}
              <div className="flex gap-2 pt-2">
                <button onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-gray-50">
                  Done
                </button>
                <button
                  onClick={() => {
                    setSent(null);
                    setTags([]);
                    setNote('');
                    setTarget(receiver || null);
                  }}
                  className="rounded-xl bg-magenta px-4 py-2 text-xs font-bold text-white hover:bg-magenta-hover"
                >
                  Give another
                </button>
              </div>
            </div>
          ) : loading ? (
            <div className="m-auto h-10 w-10 animate-spin rounded-full border-4 border-magenta border-t-transparent" />
          ) : (
            <div className="flex flex-col gap-6">
              <header className="pr-10 md:pr-0">
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Give feedback</h2>
                <p className="mt-1 text-sm text-slate-500">Takes under a minute. Be kind, be honest, be specific.</p>
              </header>

              {/* On small screens the guidance panel is hidden, so the same
                  information lives here instead of disappearing. */}
              <div className="flex flex-col gap-3 md:hidden">
                <details className="group overflow-hidden rounded-2xl bg-dark-bg text-white">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-extrabold">
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-300" />
                      Anonymous by design. Who sees what?
                    </span>
                    <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
                  </summary>
                  <div className="relative border-t border-white/10 p-5">{guidance}</div>
                </details>
                {kind === 'CONCERN' && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs font-semibold leading-relaxed text-amber-900">
                    <p className="mb-1 flex items-center gap-1.5 font-extrabold">
                      <AlertTriangle className="h-3.5 w-3.5" /> Please read this
                    </p>
                    A single concern changes nothing on its own. It only counts once at least{' '}
                    {limits?.k_anonymity ?? 3} independent people raise the same area, and a mentor always talks to
                    the person first. The person never sees your words.
                  </div>
                )}
              </div>

              {/* 1. Person */}
              <div className="flex flex-col gap-2">
                <Label n={1}>Who is this about?</Label>
                {target ? (
                  <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={target.name} avatarUrl={target.avatarUrl} size="md" />
                      <span className="text-sm font-extrabold text-slate-900">{target.name}</span>
                    </div>
                    {!receiver && (
                      <button onClick={() => setTarget(null)} className="text-xs font-bold text-magenta hover:underline">
                        Change
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        autoFocus
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search by name or Cube number"
                        className="w-full rounded-xl border border-gray-150 bg-gray-50 py-2.5 pl-9 pr-3 text-sm font-semibold outline-none focus:border-magenta focus:bg-white"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {candidates.map(c => (
                        <button
                          key={c.id}
                          onClick={() =>
                            setTarget({
                              id: c.id,
                              name: c.user?.name || 'Unknown',
                              avatarUrl: c.avatar_url || c.user?.avatar_url
                            })
                          }
                          className="flex items-center gap-2.5 rounded-xl border border-gray-100 px-3 py-2 text-left transition hover:border-magenta hover:bg-magenta-100/40"
                        >
                          <UserAvatar name={c.user?.name || '?'} avatarUrl={c.avatar_url || c.user?.avatar_url} size="sm" />
                          <span className="truncate text-xs font-bold text-slate-800">{c.user?.name}</span>
                        </button>
                      ))}
                      {candidates.length === 0 && (
                        <p className="col-span-full py-2 text-xs font-semibold text-slate-400">No Cubes match.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Kind */}
              <div className="flex flex-col gap-2">
                <Label n={2}>What kind of feedback?</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {(Object.keys(KIND_META) as PeerKind[]).map(k => {
                    const m = KIND_META[k];
                    const active = kind === k;
                    return (
                      <button
                        key={k}
                        onClick={() => setKind(k)}
                        className={`relative overflow-hidden rounded-2xl border p-3.5 text-left transition ${
                          active ? 'border-transparent shadow-premium' : 'border-gray-100 hover:border-gray-300'
                        }`}
                      >
                        {active && <span className={`absolute inset-0 bg-gradient-to-br ${m.accent} opacity-[0.12]`} />}
                        <span className="relative flex items-center gap-2">
                          <m.icon className={`h-4 w-4 ${active ? 'text-slate-900' : 'text-slate-400'}`} />
                          <span className="text-xs font-extrabold text-slate-900">{m.label}</span>
                        </span>
                        <span className="relative mt-1 block text-[11px] font-medium leading-snug text-slate-500">{m.tagline}</span>
                        {active && <span className={`absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r ${m.accent}`} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Tags */}
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <Label n={3}>
                    {kind === 'KUDOS' ? 'What did they do well?' : 'What did you notice?'}
                  </Label>
                  <span className="text-[11px] font-bold text-slate-400">
                    {tags.length} / {maxTags}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {tagList.map(t => {
                    const selected = tags.includes(t.key);
                    const style = tagStyle(t.key);
                    const Icon = kind === 'KUDOS' ? style.icon : kind === 'OBSERVATION' ? Eye : AlertTriangle;
                    return (
                      <button
                        key={t.key}
                        onClick={() => toggleTag(t.key)}
                        aria-pressed={selected}
                        className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition ${
                          selected
                            ? `border-transparent ring-2 ${kind === 'KUDOS' ? style.ring : 'ring-slate-400'} ${kind === 'KUDOS' ? style.tint : 'bg-slate-50'}`
                            : 'border-gray-100 hover:border-gray-300'
                        }`}
                      >
                        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-white shadow-sm' : 'bg-slate-100'}`}>
                          <Icon className={`h-4 w-4 ${selected && kind === 'KUDOS' ? style.text : 'text-slate-500'}`} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-extrabold text-slate-900">{t.label}</span>
                          <span className="mt-0.5 block text-[11px] font-medium leading-snug text-slate-500">{t.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Context */}
              <div className="flex flex-col gap-2">
                <Label n={4}>Where did you see this?</Label>
                <select
                  value={contextId}
                  onChange={e => setContextId(e.target.value)}
                  className="w-full rounded-xl border border-gray-150 bg-gray-50 px-3 py-2.5 text-sm font-semibold outline-none focus:border-magenta focus:bg-white"
                >
                  <option value="">Somewhere else / in general</option>
                  {sharedMissions.map(m => (
                    <option key={m.id} value={m.id}>A mission we were both on: {m.title}</option>
                  ))}
                </select>
                <p className="text-[11px] font-medium leading-relaxed text-slate-400">
                  {contextId
                    ? 'Feedback tied to shared work carries the most weight.'
                    : 'Feedback about people you have not worked with directly carries much less weight.'}
                </p>
              </div>

              {/* 5. Note */}
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <Label n={5}>
                    Add a note <span className="font-medium normal-case text-slate-400">(optional{kind === 'CONCERN' && !contextId ? `, at least ${limits?.note_min_length_other_context ?? 20} characters here` : ''})</span>
                  </Label>
                  <span className={`text-[11px] font-bold ${noteLen > noteMax ? 'text-rose-500' : 'text-slate-400'}`}>
                    {noteLen} / {noteMax}
                  </span>
                </div>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value.slice(0, noteMax))}
                  rows={4}
                  placeholder={
                    kind === 'KUDOS'
                      ? 'e.g. "During the demo prep you rewrote the data layer in an afternoon, which unblocked all of us."'
                      : 'Describe what you saw: a situation and its effect, not a judgement of the person.'
                  }
                  className="w-full resize-none rounded-2xl border border-gray-150 bg-gray-50 p-3.5 text-sm font-medium leading-relaxed outline-none focus:border-magenta focus:bg-white"
                />
                <p className="flex items-start gap-1.5 text-[11px] font-medium leading-relaxed text-slate-400">
                  {kind === 'KUDOS' ? <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                  {kind === 'KUDOS'
                    ? 'The person will read this note and may choose to show it on their public profile, which anyone with the link can read. Keep it free of names and private details.'
                    : 'This note is never shown to the person. Mentors and admins can read it, but never who wrote it.'}
                </p>
              </div>

              {/* Concern confirmation */}
              {kind === 'CONCERN' && (
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={e => setConfirmed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-amber-300 text-magenta focus:ring-magenta"
                  />
                  <span className="text-xs font-semibold leading-relaxed text-amber-900">
                    I saw this myself, I'm describing behaviour rather than character, and I understand it goes
                    to mentors, who can read it. The person will not see my words.
                  </span>
                </label>
              )}

              {/* Budget */}
              {budget && (
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  {kind === 'KUDOS' ? (
                    <>
                      <span className="text-xs font-bold text-slate-600">Kudos left this week</span>
                      <span className="flex items-center gap-1.5">
                        {Array.from({ length: budget.kudos.limit }).map((_, i) => (
                          <span
                            key={i}
                            className={`h-2.5 w-2.5 rounded-full ${i < budget.kudos.remaining ? 'bg-magenta' : 'bg-slate-200'}`}
                          />
                        ))}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-bold text-slate-600">Observations & concerns left today</span>
                      <span className="text-xs font-extrabold text-slate-800">
                        {budget.concerns.remaining_today} / {budget.concerns.daily_limit}
                      </span>
                    </>
                  )}
                </div>
              )}

              {(kudosEmpty || concernEmpty) && (
                <p className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                  <Lock className="h-3.5 w-3.5" />
                  {kudosEmpty
                    ? 'You have used all of this week\'s kudos. Your budget refills on a rolling 7-day basis.'
                    : 'You have reached today\'s limit for this type of feedback. Please try again tomorrow.'}
                </p>
              )}

              {error && (
                <p className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {error}
                </p>
              )}

              <footer className="sticky -bottom-5 -mx-5 -mb-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-white/95 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:-bottom-8 sm:-mx-8 sm:-mb-8 sm:px-8">
                <p className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                  <ShieldCheck className="h-3.5 w-3.5" /> Anonymous to everyone, always
                </p>
                <button
                  disabled={!canSubmit}
                  onClick={submit}
                  className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-extrabold text-white transition ${
                    canSubmit
                      ? `bg-gradient-to-r ${meta.accent} shadow-premium hover:-translate-y-0.5`
                      : 'cursor-not-allowed bg-slate-300'
                  }`}
                >
                  {submitting ? 'Sending…' : kind === 'KUDOS' ? 'Send kudos' : 'Send anonymously'}
                  {kind === 'KUDOS' ? <Send className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                </button>
              </footer>
            </div>
          )}
        </section>
      </div>
    </div>,
    document.body
  );
};

const Label: React.FC<{ n: number; children: React.ReactNode }> = ({ n, children }) => (
  <div className="flex items-center gap-2">
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-black text-white">{n}</span>
    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600">{children}</span>
  </div>
);

const Visibility: React.FC<{ who: string; what: string; tone: 'ok' | 'muted' | 'hide' }> = ({ who, what, tone }) => (
  <div className="flex gap-3 rounded-xl bg-white/5 p-3">
    <span
      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
        tone === 'ok' ? 'bg-emerald-400/20 text-emerald-300' : tone === 'hide' ? 'bg-rose-400/20 text-rose-300' : 'bg-white/10 text-white/60'
      }`}
    >
      {tone === 'hide' ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
    </span>
    <div>
      <p className="text-[11px] font-extrabold text-white">{who}</p>
      <p className="text-[11px] leading-relaxed text-white/65">{what}</p>
    </div>
  </div>
);
