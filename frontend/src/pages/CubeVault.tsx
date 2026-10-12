import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../utils/api';
import { Link } from 'react-router-dom';
import {
  Search,
  ShieldAlert,
  GitBranch,
  ExternalLink,
  FileText,
  Video,
  GitPullRequest,
  X,
  Users,
  FolderOpen,
  ArrowUpRight,
  CheckCircle2,
  Rocket,
  Archive,
  Link2,
} from 'lucide-react';
import { CustomMarkdown } from '../components/CustomMarkdown';
import { UserAvatar } from '../components/UserAvatar';
import { MissionLineage } from '../components/MissionLineage';
import { useAuth } from '../context/AuthContext';

const STATUS_LABELS: Record<string, string> = {
  completed: 'Completed',
  reviewed: 'Reviewed',
  promoted_to_product_backlog: 'Promoted',
  archived: 'Archived',
};

const STATUS_STYLES: Record<string, string> = {
  completed: 'text-emerald-700 bg-emerald-50 border-emerald-100',
  reviewed: 'text-sky-700 bg-sky-50 border-sky-100',
  promoted_to_product_backlog: 'text-magenta bg-magenta/5 border-magenta/10',
  archived: 'text-gray-500 bg-gray-100 border-gray-200/60',
};

const DECISION_LABELS: Record<string, string> = {
  Promote_to_Product_Backlog: 'Promote to Product Backlog',
  Needs_More_Research: 'Needs More Research',
  Keep_as_Internal_Tool: 'Keep as Internal Tool',
  Archive: 'Archive',
  Moved_to_Product: 'Moved to Product',
};

const SORTS = [
  { value: 'recent', label: 'Recently updated' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title', label: 'Title A–Z' },
];

// Strip markdown so card snippets read as plain text
const plain = (md?: string | null) =>
  (md || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

interface VaultLink {
  key: string;
  label: string;
  href: string;
  icon: React.ElementType;
}

const getLinks = (m: any): VaultLink[] => {
  const demo = m.demo_submissions?.[0];
  const candidates: VaultLink[] = [
    { key: 'doc', label: 'Docs', href: demo?.document_url, icon: FileText },
    { key: 'repo', label: 'Repo', href: m.repository_url || demo?.repository_url, icon: GitBranch },
    { key: 'pr', label: 'PR', href: demo?.pull_request_url, icon: GitPullRequest },
    { key: 'demo', label: 'Demo', href: m.demo_url || demo?.demo_url, icon: ExternalLink },
    { key: 'video', label: 'Video', href: demo?.video_url, icon: Video },
  ];
  return candidates.filter((l) => !!l.href);
};

interface Person {
  id: string;
  name: string;
  avatar?: string | null;
  role?: string;
  team?: string | null;
}

// Prefer the durable contributor history; fall back to live team rosters
const getMembers = (m: any): Person[] => {
  if (Array.isArray(m.contributors) && m.contributors.length > 0) {
    return m.contributors.map((c: any) => ({
      id: c.cube_id,
      name: c.name || 'Unknown',
      avatar: c.avatar_url,
      role: c.role,
      team: c.team_name,
    }));
  }
  const seen = new Set<string>();
  const out: Person[] = [];
  (m.teams || []).forEach((t: any) =>
    (t?.members || []).forEach((mem: any) => {
      const id = mem?.cube?.id || mem?.id;
      if (!id || seen.has(id)) return;
      seen.add(id);
      out.push({ id, name: mem?.cube?.user?.name || 'Unknown', avatar: mem?.cube?.user?.avatar_url, role: mem?.role, team: t?.name });
    })
  );
  return out;
};

const roleLabel = (r?: string) => (r || '').replace(/_/g, ' ');

const getLead = (m: any) => getMembers(m).find((p) => p.role === 'Mission_Lead');

const AvatarStack: React.FC<{ members: Person[]; max?: number }> = ({ members, max = 4 }) => {
  if (members.length === 0) return <span className="text-xs text-gray-400">No team</span>;
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {shown.map((p) => (
          <UserAvatar key={p.id} name={p.name} avatarUrl={p.avatar} size="xs" className="ring-2 ring-white" />
        ))}
        {extra > 0 && (
          <span className="w-6 h-6 rounded-full bg-gray-100 ring-2 ring-white text-[10px] font-bold text-gray-500 flex items-center justify-center">
            +{extra}
          </span>
        )}
      </div>
    </div>
  );
};

const LinkChips: React.FC<{ links: VaultLink[] }> = ({ links }) => {
  if (links.length === 0) return <span className="text-[11px] text-gray-300 font-semibold">No links</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {links.map((l) => (
        <a
          key={l.key}
          href={l.href}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 hover:bg-magenta/5 border border-gray-100 hover:border-magenta/20 text-[11px] font-bold text-gray-600 hover:text-magenta transition-colors"
        >
          <l.icon className="w-3 h-3" />
          {l.label}
        </a>
      ))}
    </div>
  );
};

const StatusPill: React.FC<{ status: string }> = ({ status }) => (
  <span
    className={`text-[10px] font-extrabold border px-2 py-0.5 rounded-full uppercase tracking-wider ${
      STATUS_STYLES[status] || STATUS_STYLES.archived
    }`}
  >
    {STATUS_LABELS[status] || status.replace(/_/g, ' ')}
  </span>
);

export const CubeVault: React.FC = () => {
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [mentorFilter, setMentorFilter] = useState('');
  const [sort, setSort] = useState('recent');
  const [selected, setSelected] = useState<any | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/missions?vault=true');
        setMissions(Array.isArray(res) ? res : []);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch Cube Vault');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // "/" focuses search, Esc closes the detail panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === 'Escape') setSelected(null);
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = selected ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [selected]);

  const categories = useMemo(
    () => Array.from(new Set(missions.map((m) => m.category).filter(Boolean))).sort() as string[],
    [missions]
  );
  const mentors = useMemo(() => {
    const map = new Map<string, string>();
    missions.forEach((m) => m.mentor && map.set(m.mentor.id, m.mentor.name));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [missions]);

  const stats = useMemo(() => {
    const people = new Set<string>();
    missions.forEach((m) => getMembers(m).forEach((p) => people.add(p.id)));
    return {
      total: missions.length,
      promoted: missions.filter((m) => m.status === 'promoted_to_product_backlog').length,
      archived: missions.filter((m) => m.status === 'archived').length,
      people: people.size,
    };
  }, [missions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = missions.filter((m) => {
      if (statusFilter && m.status !== statusFilter) return false;
      if (decisionFilter && m.decision !== decisionFilter) return false;
      if (categoryFilter && m.category !== categoryFilter) return false;
      if (mentorFilter && m.mentor?.id !== mentorFilter) return false;
      if (!q) return true;
      const demo = m.demo_submissions?.[0];
      const haystack = [
        m.title,
        m.category,
        m.problem_statement,
        m.description,
        m.mentor?.name,
        ...(m.teams || []).map((t: any) => t?.name),
        ...getMembers(m).map((p) => p.name),
        demo?.what_we_built,
        demo?.what_we_learned,
      ]
        .map((s) => (s || '').toLowerCase())
        .join(' ');
      return haystack.includes(q);
    });
    return list.sort((a, b) => {
      if (sort === 'title') return (a.title || '').localeCompare(b.title || '');
      const da = new Date(a.updated_at || a.created_at).getTime();
      const db = new Date(b.updated_at || b.created_at).getTime();
      return sort === 'oldest' ? da - db : db - da;
    });
  }, [missions, query, statusFilter, decisionFilter, categoryFilter, mentorFilter, sort]);

  const hasFilters = !!(query || statusFilter || decisionFilter || categoryFilter || mentorFilter);
  const resetFilters = () => {
    setQuery('');
    setStatusFilter('');
    setDecisionFilter('');
    setCategoryFilter('');
    setMentorFilter('');
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-magenta border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 border border-red-100 p-4 rounded-2xl flex items-center gap-2">
        <ShieldAlert className="w-5 h-5" />
        <span>{error}</span>
      </div>
    );
  }

  const selectClass =
    'px-3 py-2.5 bg-gray-50 hover:bg-gray-100/60 border border-gray-100 rounded-xl outline-none font-bold text-xs cursor-pointer focus:border-magenta/40';

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">The Cube Vault</h1>
          <p className="text-gray-500 mt-1">Completed Iceberg X missions, who built them, and everything they left behind.</p>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {[
            { label: 'Missions', value: stats.total, icon: FolderOpen },
            { label: 'Promoted', value: stats.promoted, icon: Rocket },
            { label: 'Archived', value: stats.archived, icon: Archive },
            { label: 'Cubes', value: stats.people, icon: Users },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-gray-100 rounded-2xl shadow-subtle px-3 sm:px-4 py-2.5 min-w-[72px]">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                <s.icon className="w-3 h-3" />
                {s.label}
              </div>
              <div className="text-xl font-extrabold text-gray-900 leading-tight mt-0.5">{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Search & filters */}
      <div className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-grey-bg/90 backdrop-blur">
        <div className="bg-white border border-gray-100 p-3 rounded-2xl shadow-subtle flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search missions, cubes, mentors, problems, learnings…  (press / to focus)"
              className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-100 rounded-xl outline-none text-sm font-semibold placeholder:font-medium placeholder:text-gray-400 focus:border-magenta/40"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <select value={decisionFilter} onChange={(e) => setDecisionFilter(e.target.value)} className={selectClass}>
              <option value="">All decisions</option>
              {Object.entries(DECISION_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            {categories.length > 1 && (
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={selectClass}>
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
            {mentors.length > 0 && (
              <select value={mentorFilter} onChange={(e) => setMentorFilter(e.target.value)} className={selectClass}>
                <option value="">All mentors</option>
                {mentors.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            )}
            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs font-semibold text-gray-400">
                {filtered.length} of {missions.length}
              </span>
              {hasFilters && (
                <button onClick={resetFilters} className="text-xs font-bold text-magenta hover:underline">
                  Reset
                </button>
              )}
              <select value={sort} onChange={(e) => setSort(e.target.value)} className={selectClass} aria-label="Sort">
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((m) => {
            const team = m.teams?.[0] || null;
            const members = getMembers(m);
            const demo = m.demo_submissions?.[0];
            const snippet = plain(demo?.what_we_learned) || plain(m.problem_statement) || plain(m.description);
            return (
              <button
                key={m.id}
                onClick={() => setSelected(m)}
                className="group text-left bg-white border border-gray-100 rounded-2xl p-5 shadow-subtle hover:border-magenta/30 hover:shadow-md transition-all flex flex-col gap-3"
              >
                <div className="flex items-center justify-between gap-2 min-h-[1.75rem]">
                  <StatusPill status={m.status} />
                  <span className="flex items-center gap-2 min-w-0">
                    {((m.predecessors || []).length > 0 || (m.followups || []).length > 0) && (
                      <span
                        title={[
                          (m.predecessors || []).length ? `Continues ${(m.predecessors || []).map((x: any) => x.title).join(', ')}` : '',
                          (m.followups || []).length ? `${m.followups.length} follow-up(s)` : '',
                        ].filter(Boolean).join(' · ')}
                        className="flex items-center gap-1 text-[10px] font-bold text-magenta bg-magenta/5 border border-magenta/10 rounded-full px-1.5 py-0.5 shrink-0"
                      >
                        <Link2 className="w-3 h-3" />
                        {(m.predecessors || []).length + (m.followups || []).length}
                      </span>
                    )}
                    {m.category && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 truncate">{m.category}</span>
                    )}
                  </span>
                </div>

                <h3 className="font-extrabold text-base text-gray-900 leading-snug line-clamp-2 min-h-[2.75rem] group-hover:text-magenta transition-colors">
                  {m.title}
                </h3>

                <p className="text-xs text-gray-500 font-medium leading-relaxed line-clamp-3 min-h-[3.75rem]">
                  {snippet || 'No summary available.'}
                </p>

                <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-50">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AvatarStack members={members} />
                    <div className="min-w-0 leading-tight">
                      <div className="text-xs font-bold text-gray-800 truncate">
                        {getLead(m)?.name ? `Lead: ${getLead(m)!.name}` : team?.name || members[0]?.team || 'No team'}
                      </div>
                      <div className="text-[11px] text-gray-400 font-medium truncate">
                        {members.length} cube{members.length === 1 ? '' : 's'} · {m.mentor ? `Mentor: ${m.mentor.name}` : 'No mentor'}
                      </div>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-magenta shrink-0" />
                </div>

                <div className="min-h-[1.75rem]">
                  <LinkChips links={getLinks(m)} />
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="text-center bg-white border border-gray-100 rounded-2xl shadow-subtle py-16 px-4">
          <FolderOpen className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-600">
            {missions.length === 0 ? 'The Vault is empty.' : 'No missions match your search.'}
          </p>
          {hasFilters && (
            <button onClick={resetFilters} className="mt-2 text-xs font-bold text-magenta hover:underline">
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Detail panel */}
      {selected && <VaultDetail mission={selected} onClose={() => setSelected(null)} />}
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section>
    <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 mb-1.5">{title}</h4>
    <div className="markdown-body text-sm text-gray-700 leading-relaxed">{children}</div>
  </section>
);

const VaultDetail: React.FC<{ mission: any; onClose: () => void }> = ({ mission: m, onClose }) => {
  const { user } = useAuth();
  const canCreate = user?.role === 'ADMIN' || user?.role === 'MENTOR';
  const members = getMembers(m);
  const team = m.teams?.[0] || null;
  const demo = m.demo_submissions?.[0];
  const links = getLinks(m);
  const roleGroups = Object.entries(
    members.reduce((acc: Record<string, string[]>, p) => {
      const key = p.role || 'Contributor';
      (acc[key] = acc[key] || []).push(p.name);
      return acc;
    }, {})
  );
  const teamNames = Array.from(new Set(members.map((p) => p.team).filter(Boolean))) as string[];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="relative w-full max-w-2xl h-full bg-white shadow-2xl overflow-y-auto">
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-100 px-6 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <StatusPill status={m.status} />
              {m.decision && (
                <span className="text-[10px] font-extrabold text-gray-500 bg-gray-100 border border-gray-200/50 px-2 py-0.5 rounded-full uppercase">
                  {DECISION_LABELS[m.decision] || m.decision.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            <h2 className="text-xl font-extrabold text-gray-900 leading-snug">{m.title}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          {/* Who */}
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
                Who worked on it{teamNames.length ? ` · ${teamNames.join(', ')}` : team ? ` · ${team.name}` : ''}
              </span>
              {m.mentor && (
                <span className="text-xs font-semibold text-gray-500">
                  Mentor: <span className="font-bold text-gray-800">{m.mentor.name}</span>
                </span>
              )}
            </div>
            {members.length > 0 ? (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {members.map((p) => (
                    <div key={p.id} className="flex items-center gap-2.5 bg-white border border-gray-100 rounded-xl px-3 py-2">
                      <UserAvatar name={p.name} avatarUrl={p.avatar} size="sm" />
                      <div className="min-w-0 leading-tight">
                        <div className="text-xs font-bold text-gray-800 truncate">{p.name}</div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-magenta truncate">
                          {roleLabel(p.role) || 'Contributor'}
                        </div>
                        {p.team && <div className="text-[10px] text-gray-400 font-medium truncate">Team {p.team}</div>}
                      </div>
                    </div>
                  ))}
                </div>
                {roleGroups.length > 1 && (
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-100">
                    {roleGroups.map(([role, names]) => (
                      <span key={role} className="text-[10px] font-semibold text-gray-500 bg-white border border-gray-100 rounded-full px-2 py-0.5">
                        <span className="font-extrabold uppercase text-gray-700">{roleLabel(role)}</span> · {names.join(', ')}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No cubes were assigned to this mission.</p>
            )}
          </div>

          {/* Links & documents */}
          <div>
            <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 mb-2">Documents & links</h4>
            {links.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {links.map((l) => (
                  <a
                    key={l.key}
                    href={l.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-magenta/30 hover:bg-magenta/5 transition-colors"
                  >
                    <l.icon className="w-4 h-4 text-magenta shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-gray-800">{l.label}</div>
                      <div className="text-[11px] text-gray-400 truncate">{l.href.replace(/^https?:\/\//, '')}</div>
                    </div>
                  </a>
                ))}
                {m.slack_channel_url && (
                  <a
                    href={m.slack_channel_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-magenta/30 hover:bg-magenta/5 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 text-magenta shrink-0" />
                    <div className="text-xs font-bold text-gray-800">Slack channel</div>
                  </a>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No documents or links were attached to this mission.</p>
            )}
          </div>

          <MissionLineage
            missionId={m.id}
            predecessors={m.predecessors || []}
            followups={m.followups || []}
            canCreate={canCreate}
            onNavigate={onClose}
          />

          {demo ? (
            <>
              <Section title="What was built">
                <CustomMarkdown>{demo.what_we_built}</CustomMarkdown>
              </Section>
              <Section title="What was learned">
                <CustomMarkdown>{demo.what_we_learned}</CustomMarkdown>
              </Section>
              {demo.recommendation && (
                <Section title="Recommendation">
                  <CustomMarkdown>{demo.recommendation}</CustomMarkdown>
                </Section>
              )}
            </>
          ) : (
            <p className="flex items-center gap-2 text-xs text-gray-400 italic">
              <CheckCircle2 className="w-4 h-4" /> No demo reflection was logged for this mission.
            </p>
          )}

          <Section title="Problem statement">
            <CustomMarkdown>{m.problem_statement}</CustomMarkdown>
          </Section>
          <Section title="What was tried">
            <CustomMarkdown>{m.description}</CustomMarkdown>
          </Section>

          <Link
            to={`/missions/${m.id}`}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-magenta text-white text-sm font-bold hover:bg-magenta-hover transition-colors"
          >
            Open full mission timeline <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </aside>
    </div>
  );
};
