import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, Bookmark, BookOpen, CheckCircle2, Clock, Coffee, Flame, Hand, Hash, LayoutGrid, LifeBuoy, Link2, LockKeyhole, Megaphone, MessageCircle, MessageCircleQuestion, Minus, Pencil, Pin, Plus, Rocket, Search, Shield, Trash2, Flag, Bell, BellOff, SlidersHorizontal, X, Lightbulb, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import { MarkdownEditor } from '../../components/MarkdownEditor';
import { AuthorIdentity, CategoryManager, ContextFields, ForumPreferences, MentionPicker, PortalAvatar, type Author, type Category, type Viewer, type ForumContext } from './ForumPortal';
import { forumLocation, forumPageParams, forumReadStatus, forumListParams, forumSearchParams } from './forumModel';
import './talks.css';

interface Post { id: string; body: string; author: Author | null; created_at: string; updated_at: string }
interface Topic extends Post { edited?: boolean; context?: { quest: { id: string; title: string } | null; mission: { id: string; title: string } | null } | null; accepted_reply_id: string | null; title: string; category_id: string; category?: Category; locked: boolean; pinned: boolean; last_activity_at: string; states: { saved: boolean; following: boolean; read_at?: string }[]; _count?: { replies: number } }
interface TopicList { topics: Topic[]; total: number; pageSize: number }
interface Thread { page: number; acceptedReply?: Post | null; topic: Topic; replies: Post[]; total: number; pageSize: number }
interface Report { id: string; topic_id: string; reply_id: string | null; reason: string; reporter: Author | null; topic: { title: string; body: string; deleted_at: string | null }; reply?: { body: string; deleted_at: string | null } | null }
interface ReportList { reports: Report[]; total: number; pageSize: number }
interface Stats { topics: number; replies: number; solved: number; contributors: { author: Author; topics: number; replies: number }[]; unanswered: { id: string; title: string; category_id: string; created_at: string; author: Author | null }[] }
const emptyStats: Stats = { topics: 0, replies: 0, solved: 0, contributors: [], unanswered: [] };
interface Editor { kind: 'create' | 'topic' | 'reply'; id?: string; title: string; body: string; category: string; quest?: string; mission?: string }
const date = (value: string) => new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' });
const units: [Intl.RelativeTimeFormatUnit, number][] = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
function ago(value: string) {
  const seconds = (new Date(value).getTime() - Date.now()) / 1000;
  const unit = units.find(([, size]) => Math.abs(seconds) >= size);
  return unit ? relative.format(Math.round(seconds / unit[1]), unit[0]) : 'just now';
}
// A plain-text teaser for feed cards; formatting is shown only on the topic page.
const preview = (text: string) => (text || '').replace(/```[\s\S]*?```/g, ' ').replace(/[#>*_`~[\]()!-]/g, ' ').replace(/\s+/g, ' ').trim();
const emptyList: TopicList = { topics: [], total: 0, pageSize: 20 };
const hints: Record<string, string> = {
  announcements: 'State the scope and date of the announcement and what Cubes are expected to do.',
  introductions: 'Hi! I am…\n\nWhat I am into:\nWhat I am learning right now:\nWhat I would like to work on together:',
  help: 'What am I trying to do?\n\nThe error I get:\n\nWhat I tried:\n\nRelevant code (no secrets or passwords):',
  showcase: 'What my project is for:\n\nWhat I finished this week:\n\nWhere I am stuck:\n\nWhat I would like feedback on:',
  resources: 'Resource name and link:\n\nWhat does it cover?\n\nWho is it useful for?\n\nMy notes:',
  ideas: 'My idea:\n\nWho would this help?\n\nA small first step:\n\nWhat do you think?',
  lounge: 'Start the conversation: a recommendation, a question or a small story from your day…',
};
const communityStyle: Record<string, { icon: LucideIcon; color: string }> = {
  announcements: { icon: Megaphone, color: '#e6007e' },
  introductions: { icon: Hand, color: '#f59e0b' },
  help: { icon: LifeBuoy, color: '#0ea5e9' },
  showcase: { icon: Rocket, color: '#8b5cf6' },
  resources: { icon: BookOpen, color: '#10b981' },
  ideas: { icon: Lightbulb, color: '#d97706' },
  lounge: { icon: Coffee, color: '#f97316' },
};
function CommunityIcon({ id, size = 24 }: { id?: string; size?: number }) {
  const style = communityStyle[id || ''] || { icon: Hash, color: '#6b7280' };
  const Icon = style.icon;
  return <span className="talk-community-icon" style={{ width: size, height: size, background: style.color }} aria-hidden="true"><Icon size={Math.round(size * 0.55)}/></span>;
}
function Markdown({ text }: { text: string }) { return <div className="markdown"><ReactMarkdown skipHtml components={{ img: () => null }}>{text || ''}</ReactMarkdown></div>; }

export default function Forum() {
  const { user } = useAuth();
  const staff = user?.role === 'ADMIN' || user?.role === 'MENTOR';
  const [params, setParams] = useSearchParams();
  // `konu` is the pre-English parameter still present in older notification links.
  const location = forumLocation(params);
  const topicId = location.topic, replyId = location.reply;
  const questFilter = params.get('quest') || '', missionFilter = params.get('mission') || '';
  const categoryId = params.get('category') || '';
  const view = params.get('view') || 'all';
  const query = params.get('q') || '';
  const sort = params.get('sort') === 'newest' ? 'newest' : 'active';
  const page = location.page;
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [context, setContext] = useState<ForumContext | null>(null);
  const [preferences, setPreferences] = useState(false);
  const [showFilters, setShowFilters] = useState(!!(questFilter || missionFilter));
  const [shareUrl, setShareUrl] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [list, setList] = useState<TopicList>(emptyList);
  const [thread, setThread] = useState<Thread | null>(null);
  const [reports, setReports] = useState<ReportList>({ reports: [], total: 0, pageSize: 20 });
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [statsStatus, setStatsStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [search, setSearch] = useState(query);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [reportTarget, setReportTarget] = useState<{ reply_id?: string } | null>(null);
  const [reason, setReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const pageHeading = useRef<HTMLHeadingElement>(null);
  const locationKey = params.toString();

  useEffect(() => { setSearch(query); }, [query]);
  useEffect(() => { setEditor(null); setReportTarget(null); setDeleteTarget(null); setReply(''); setMessage(''); setShareUrl(''); setPreferences(false); setCollapsed(new Set()); }, [locationKey]);
  useEffect(() => {
    let current = true;
    setLoading(true); setError(''); setThread(null); setList(emptyList); setReports({ reports: [], total: 0, pageSize: 20 });
    const request = new URLSearchParams({ page: String(page), sort });
    if (questFilter) request.set('quest', questFilter);
    if (missionFilter) request.set('mission', missionFilter);
    if (categoryId) request.set('category', categoryId);
    if (query) request.set('q', query);
    if (['saved', 'following', 'unanswered', 'solved'].includes(view)) request.set('view', view);
    async function load() {
      try {
        const [nextCategories, nextViewer, data] = await Promise.all([
          api.get<Category[]>('/forum/categories'),
          api.get<Viewer>('/forum/me/profile'),
          topicId ? api.get<Thread>(`/forum/topics/${encodeURIComponent(topicId)}?${new URLSearchParams({ page: String(page), ...(replyId ? { reply: replyId } : {}) })}`)
            : view === 'reports' ? api.get<ReportList>(`/forum/reports?page=${page}`)
              : !['index', 'profile', 'categories'].includes(view) || categoryId || query ? api.get<TopicList>(`/forum/topics?${request}`) : Promise.resolve(null),
        ]);
        if (!current) return;
        setCategories(nextCategories); setViewer(nextViewer);
        if (topicId) setThread(data as Thread);
        else if (view === 'reports') setReports(data as ReportList);
        else setList((data as TopicList | null) || emptyList);
      } catch (err) { if (current) setError(err instanceof Error ? err.message : 'The forum could not be loaded.'); }
      finally { if (current) { setLoading(false); if (!document.activeElement?.matches('input, textarea, select, summary')) pageHeading.current?.focus(); } }
    }
    void load();
    return () => { current = false; };
  }, [locationKey, revision, user?.id]);
  // Sidebar statistics are best-effort; a failure here must not hide the main content.
  useEffect(() => {
    let current = true;
    setStatsStatus('loading');
    api.get<Stats>('/forum/stats')
      .then(next => { if (current && next) { setStats(next); setStatsStatus('ready'); } })
      .catch(() => { if (current) setStatsStatus('error'); });
    return () => { current = false; };
  }, [revision, user?.id]);

  useEffect(() => {
    let current = true;
    api.get<ForumContext>('/forum/context').then(data => { if (current) setContext(data); }).catch(() => { if (current) setContext(null); });
    return () => { current = false; };
  }, [user?.id, revision]);
  useEffect(() => {
    if (!loading && thread && replyId) {
      const target = document.getElementById('reply-' + replyId);
      target?.focus(); target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [loading, thread, replyId]);

  useEffect(() => {
    if (editor) document.getElementById(editor.kind === 'reply' ? 'live-editor' : 'forum-topic-title')?.focus();
  }, [editor?.kind, editor?.id]);
  const go = (values: Record<string, string> = {}) => { if (!busyRef.current) setParams(values); };
  const openTopic = (id: string) => go({ topic: id });
  const changePage = (next: number) => go(forumPageParams(params, next));
  async function mutate(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(''); setMessage('');
    try { await action(); setRevision(n => n + 1); }
    catch (err) { setError(err instanceof Error ? err.message : 'The action could not be completed. Your text has been kept.'); }
    finally { busyRef.current = false; setBusy(false); }
  }
  const community = categories.find(c => c.id === (thread?.topic.category_id || categoryId));
  const feeds: [string, string, LucideIcon][] = [['all', 'Home', Flame], ['index', 'All communities', LayoutGrid], ['unanswered', 'Unanswered', MessageCircleQuestion], ['solved', 'Solved', CheckCircle2], ['saved', 'Saved', Bookmark], ['following', 'Following', Bell], ['profile', 'Forum profile', Pencil], ...(user?.role === 'ADMIN' ? [['categories', 'Manage communities', LayoutGrid] as [string, string, LucideIcon]] : []), ...(staff ? [['reports', 'Moderation', Shield] as [string, string, LucideIcon]] : [])];
  const feedTitle = feeds.find(([key]) => key === view)?.[1] || 'Home';
  const title = thread?.topic.title || (topicId ? 'Topic' : (categoryId && community?.name) || (query ? 'Search results' : feedTitle));
  const isListing = !topicId && !['reports', 'profile', 'categories'].includes(view) && (view !== 'index' || !!categoryId || !!query);
  const filterCount = Number(!!questFilter) + Number(!!missionFilter);
  const activeFilters = [
    ...(categoryId ? [{ key: 'category', label: community?.name || 'Community' }] : []),
    ...(query ? [{ key: 'q', label: 'Search: ' + query }] : []),
    ...(questFilter ? [{ key: 'quest', label: context?.quests.find(q => q.id === questFilter)?.title || 'Linked quest' }] : []),
    ...(missionFilter ? [{ key: 'mission', label: context?.missions.find(m => m.id === missionFilter)?.title || 'Linked mission' }] : []),
  ];
  const canPost = !!viewer?.can_post;
  const canCreate = canPost && categories.some(c => !c.staff_only || staff);
  const total = topicId ? thread?.total || 0 : view === 'reports' ? reports.total : list.total;
  const currentPage = topicId ? thread?.page || page : page;
  const pageSize = topicId ? thread?.pageSize || 20 : view === 'reports' ? reports.pageSize : list.pageSize;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const topicPath = thread ? `/forum/topics/${encodeURIComponent(thread.topic.id)}` : '';
  const startTopic = () => { const category = community && (!community.staff_only || staff) ? community.id : categories.find(c => !c.staff_only)?.id || categories[0]?.id || ''; setEditor({ kind: 'create', title: '', body: '', category, quest: questFilter, mission: missionFilter }); setReportTarget(null); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const toggleCollapsed = (id: string) => setCollapsed(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleState = (key: 'saved' | 'following', topic: Topic) => void mutate(async () => { await api.put(`/forum/topics/${encodeURIComponent(topic.id)}/state`, { [key]: !topic.states?.[0]?.[key] }); });
  const share = async (topic: Topic) => {
    const url = new URL('/forum?topic=' + encodeURIComponent(topic.id), window.location.origin).href;
    try { await navigator.clipboard.writeText(url); setShareUrl(''); setMessage('Link copied to clipboard.'); }
    catch { setShareUrl(url); setMessage('Copy the topic link below.'); }
  };

  const submitEditor = (event: FormEvent) => { event.preventDefault(); if (!editor) return; void mutate(async () => {
    if (editor.kind === 'create') { const created = await api.post<{ id: string }>('/forum/topics', { title: editor.title, body: editor.body, category_id: editor.category, quest_id: editor.quest || null, mission_id: editor.mission || null }); setParams({ topic: created.id }); }
    else await api.patch(editor.kind === 'topic' ? topicPath : `${topicPath}/replies/${editor.id}`, { title: editor.title, body: editor.body, ...(editor.kind === 'topic' ? { quest_id: editor.quest || null, mission_id: editor.mission || null } : {}) });
    setEditor(null); setMessage('Your post has been saved.');
  }); };
  const editorForm = (current: Editor) => <form className="talk-card talk-form" onSubmit={submitEditor}>{current.kind === 'create' && <h2>Create a post</h2>}<fieldset disabled={busy || loading}>
    {current.kind === 'create' && <label>Community<select value={current.category} onChange={event => setEditor({ ...current, category: event.target.value })}>{categories.filter(c => !c.staff_only || staff).map(c => <option key={c.id} value={c.id}>c/{c.id} · {c.name}</option>)}</select></label>}
    {current.kind !== 'reply' && <label>Title<input id="forum-topic-title" required minLength={8} maxLength={160} value={current.title} onChange={event => setEditor({ ...current, title: event.target.value })} placeholder="A title that clearly describes the topic"/></label>}
    <label htmlFor="live-editor">Body</label><MarkdownEditor id="live-editor" required disabled={busy} value={current.body} onChange={body => setEditor({ ...current, body: body.slice(0, current.kind === 'reply' ? 5000 : 10000) })} placeholder={hints[current.category] || 'What would you like to share?'} rows={8}/>
    {current.kind !== 'reply' && <details className="forum-optional-context" open={!!(current.quest || current.mission) || undefined}><summary>Link a quest or mission <span>Optional</span></summary><ContextFields context={context} quest={current.quest || ''} mission={current.mission || ''} onChange={(quest, mission) => setEditor({ ...current, quest, mission })}/></details>}
    <MentionPicker onPick={token => setEditor({ ...current, body: (current.body + '\n' + token).slice(0, current.kind === 'reply' ? 5000 : 10000) })}/>
    <p className="talk-hint">{current.kind === 'reply' ? 'Up to 5,000' : '15–10,000'} characters · Markdown supported · no image uploads</p>
    <div className="talk-form-actions"><button type="button" className="talk-btn is-ghost" onClick={() => setEditor(null)}>Cancel</button><button className="talk-btn is-primary" disabled={current.body.trim().length < (current.kind === 'reply' ? 1 : 15) || (current.kind !== 'reply' && current.title.trim().length < 8)}>{busy ? 'Saving…' : current.kind === 'create' ? 'Post' : 'Save'}</button></div>
  </fieldset></form>;
  const reportForm = <form className="talk-card talk-form" onSubmit={event => { event.preventDefault(); void mutate(async () => { await api.post(`${topicPath}/reports`, { ...reportTarget, reason }); setReportTarget(null); setMessage('Thanks — the moderators will take a look.'); }); }}><label>Why are you reporting this?<textarea required minLength={10} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} placeholder="Briefly explain the problem."/></label><div className="talk-form-actions"><button type="button" className="talk-btn is-ghost" disabled={busy} onClick={() => setReportTarget(null)}>Cancel</button><button className="talk-btn is-primary" disabled={busy || reason.trim().length < 10}>Report</button></div></form>;
  const deleteConfirm = (target: string) => deleteTarget === target && <div className="talk-card talk-danger" role="alert"><p>Remove this post from the discussion? Its history will be retained for moderation.</p><div className="talk-form-actions"><button className="talk-btn is-ghost" disabled={busy} onClick={() => setDeleteTarget(null)}>Cancel</button><button className="talk-btn is-danger" disabled={busy} onClick={() => void mutate(async () => { await api.delete(target); if (target === topicPath) setParams({}); setDeleteTarget(null); setMessage('The post has been deleted.'); })}>Delete</button></div></div>;
  const quote = (post: Post) => { setReply(text => `${text}${text ? '\n\n' : ''}> ${(post.body || '').slice(0, 800).replace(/\n/g, '\n> ')}\n\n`); document.getElementById('live-reply')?.focus(); };
  const ownActions = (post: Post, first: boolean) => <>
    {canPost && post.author?.id === user?.id && !thread?.topic.locked && <button className="talk-pill" disabled={busy} onClick={() => { setEditor({ kind: first ? 'topic' : 'reply', id: post.id, title: thread?.topic.title || '', body: post.body, category: thread?.topic.category_id || '', quest: thread?.topic.context?.quest?.id, mission: thread?.topic.context?.mission?.id }); setReportTarget(null); }}><Pencil size={14}/>Edit</button>}
    {(post.author?.id === user?.id || staff) && <button className="talk-pill" disabled={busy} onClick={() => setDeleteTarget(first ? topicPath : `${topicPath}/replies/${post.id}`)}><Trash2 size={14}/>Delete</button>}
    <button className="talk-pill" disabled={busy} onClick={() => { setReportTarget(first ? {} : { reply_id: post.id }); setReason(''); setEditor(null); }}><Flag size={14}/>Report</button>
  </>;
  const contextLinks = (topic: Topic) => <div className="forum-context-links">{topic.context?.quest && <Link to="/quests">Quest · {topic.context.quest.title}</Link>}{topic.context?.mission && <Link to={`/missions/${topic.context.mission.id}`}>Mission · {topic.context.mission.title}</Link>}</div>;
  const flairs = (topic: Topic) => <>
    {topic.pinned && <span className="talk-flair is-pinned"><Pin size={11}/>Pinned</span>}
    {topic.locked && <span className="talk-flair"><LockKeyhole size={11}/>Locked</span>}
    {topic.accepted_reply_id && <span className="talk-flair is-solved"><CheckCircle2 size={11}/>Solved</span>}
  </>;
  const renderComment = (post: Post) => {
    const accepted = thread?.topic.accepted_reply_id === post.id;
    const hidden = collapsed.has(post.id);
    return <li className={`talk-comment ${accepted ? 'is-accepted' : ''}`} key={post.id} id={`reply-${post.id}`} tabIndex={-1}>
      <div className="talk-comment-rail">
        <PortalAvatar author={post.author} size={28}/>
        <button className="talk-thread-line" aria-label={hidden ? 'Expand comment' : 'Collapse comment'} aria-expanded={!hidden} onClick={() => toggleCollapsed(post.id)}/>
      </div>
      <div className="talk-comment-body">
        <div className="talk-meta"><AuthorIdentity author={post.author}/>
          {post.author?.id && post.author.id === thread?.topic.author?.id && <span className="talk-op-tag">OP</span>}
          <span>·</span><time dateTime={post.created_at} title={date(post.created_at)}>{ago(post.created_at)}</time>{post.updated_at !== post.created_at && <span title={date(post.updated_at)}>· edited</span>}
          {hidden && <button className="talk-expand" onClick={() => toggleCollapsed(post.id)}><Plus size={12}/></button>}
        </div>
        {!hidden && <>
          {accepted && <p className="talk-accepted"><CheckCircle2 size={14}/>Accepted answer</p>}
          {editor?.kind === 'reply' && editor.id === post.id ? editorForm(editor) : <Markdown text={post.body}/>}
          {post.author?.signature && <p className="forum-signature">{post.author.signature}</p>}
          <div className="talk-actions">
            {canPost && !thread?.topic.locked && <button className="talk-pill" onClick={() => quote(post)}><MessageCircle size={14}/>Reply</button>}
            {canPost && thread?.topic.category_id === 'help' && thread.topic.author?.id === user?.id && !thread.topic.locked && <button className="talk-pill" disabled={busy} onClick={() => void mutate(async () => { await api.put(`${topicPath}/answer`, { reply_id: accepted ? null : post.id }); })}><CheckCircle2 size={14}/>{accepted ? 'Unmark answer' : 'Accept answer'}</button>}
            {ownActions(post, false)}
            <button className="talk-pill" onClick={() => toggleCollapsed(post.id)}><Minus size={14}/>Collapse</button>
          </div>
          {reportTarget?.reply_id === post.id && reportForm}
          {deleteConfirm(`${topicPath}/replies/${post.id}`)}
        </>}
      </div>
    </li>;
  };
  const pagination = (pages > 1 || currentPage > 1) && <nav className="talk-pagination" aria-label="Pages">
    <button className="talk-btn is-ghost" disabled={busy || currentPage <= 1} onClick={() => changePage(currentPage - 1)}>Previous</button>
    <span>Page {currentPage} of {pages}</span>
    <button className="talk-btn is-ghost" disabled={busy || currentPage >= pages} onClick={() => changePage(currentPage + 1)}>Next</button>
  </nav>;

  const statsNotice = <p className="talk-hint" role="status">{statsStatus === 'loading' ? 'Loading community activity…' : 'Community activity is unavailable.'}{statsStatus === 'error' && <button className="talk-pill" disabled={busy} onClick={() => setRevision(n => n + 1)}>Retry</button>}</p>;
  const saveProfile = (value: { badge_ids: string[]; signature: string }) => void mutate(async () => {
    await api.put('/forum/me/profile', value); setPreferences(false); setMessage('Your forum profile has been saved.');
  });
  return <div className="cube-forum talk-forum" aria-busy={loading || busy}>
    <nav className="talk-mobile-nav" aria-label="Mobile forum navigation">
      <label>Browse<select aria-label="Browse forum" value={topicId ? '__topic' : activeFilters.length ? '__filtered' : view} disabled={busy} onChange={e => go(e.target.value === 'all' ? {} : { view: e.target.value })}>{topicId && <option value="__topic" disabled>Current discussion</option>}{!topicId && !!activeFilters.length && <option value="__filtered" disabled>Filtered discussions</option>}{feeds.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Community<select aria-label="Choose community" value={categoryId} disabled={busy || loading} onChange={e => go(forumListParams(params, { category: e.target.value, view: 'all' }))}><option value="">All communities</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    </nav>
    <nav className="talk-nav" aria-label="Forum navigation">
      <ul>{feeds.map(([key, label, Icon]) => <li key={key}><button disabled={busy} aria-current={!topicId && !categoryId && !query && view === key ? 'page' : undefined} className={!topicId && !categoryId && !query && view === key ? 'selected' : ''} onClick={() => go(key === 'all' ? {} : { view: key })}><Icon size={18}/>{label}</button></li>)}</ul>
      <h2>Communities</h2>
      <ul>{categories.map(category => <li key={category.id}><button disabled={busy} className={community?.id === category.id && !query ? 'selected' : ''} aria-current={categoryId === category.id ? 'page' : undefined} onClick={() => go(forumListParams(params, { category: category.id, view: 'all' }))}><CommunityIcon id={category.id} size={26}/><span className="talk-community-name">{category.name}</span><small className="talk-nav-count">{category._count?.topics || 0}</small></button></li>)}</ul>
    </nav>

    <main className="talk-main">
      <div className="talk-topbar">
        <form className="talk-search" role="search" onSubmit={event => { event.preventDefault(); go(forumSearchParams(params, search, thread?.topic.category_id)); }}><Search size={16} aria-hidden="true"/><label htmlFor="forum-search" className="sr-only">Search the forum</label><input id="forum-search" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} placeholder={community ? `Search in ${community.name}` : 'Search discussions, questions, ideas…'}/>{search && <button type="button" className="talk-search-clear" aria-label="Clear search" onClick={() => { setSearch(''); go(forumListParams(params, { q: undefined })); }}><X size={16}/></button>}</form>
        {!['reports', 'profile', 'categories'].includes(view) && canCreate && <button className="talk-btn is-primary" disabled={busy || loading} onClick={startTopic}><Plus size={16}/>Create post</button>}
      </div>

      {thread ? <button className="talk-back" disabled={busy} onClick={() => go({ category: thread.topic.category_id })}><ArrowLeft size={16}/>c/{thread.topic.category_id}</button>
        : community && categoryId ? <header className="talk-community-head">
          <CommunityIcon id={community.id} size={56}/>
          <div><h1 ref={pageHeading} tabIndex={-1}>{community.name}</h1><p>c/{community.id}</p></div>
        </header>
          : <header className="talk-heading"><div><span className="talk-eyebrow">Cube Forum</span><h1 ref={pageHeading} tabIndex={-1} className="talk-title">{title}</h1>{isListing && !query && <p>{view === 'all' ? 'Questions, project logs and shared discoveries.' : view === 'unanswered' ? 'A little help can move someone forward.' : view === 'saved' ? 'Your reading list, ready when you are.' : view === 'following' ? 'Conversations you are keeping up with.' : 'Solutions shared by the community.'}</p>}</div>{isListing && !loading && <span className="talk-result-count">{list.total} {list.total === 1 ? 'discussion' : 'discussions'}</span>}</header>}
      {thread && <h1 ref={pageHeading} tabIndex={-1} className="sr-only">{title}</h1>}
      {!thread && query && <p className="talk-hint">{list.total} {list.total === 1 ? 'result' : 'results'} for “{query}”</p>}

      {isListing && <>
        <div className="talk-feed-toolbar"><div className="talk-sort" role="group" aria-label="Sort topics">
          <button aria-pressed={sort === 'active'} className={sort === 'active' ? 'selected' : ''} disabled={busy} onClick={() => go(forumListParams(params, { sort: 'active' }))}><Flame size={15}/>Recently active</button>
          <button aria-pressed={sort === 'newest'} className={sort === 'newest' ? 'selected' : ''} disabled={busy} onClick={() => go(forumListParams(params, { sort: 'newest' }))}><Clock size={15}/>Newest</button>
        </div><button className={`talk-filter-toggle ${showFilters || filterCount ? 'is-on' : ''}`} aria-expanded={showFilters} aria-controls="forum-context-filters" disabled={busy} onClick={() => setShowFilters(v => !v)}><SlidersHorizontal size={15}/>Filters{filterCount > 0 && <span>{filterCount}</span>}</button></div>
        {showFilters && <div className="forum-context-filter" id="forum-context-filters"><label>Quest<select value={questFilter} disabled={busy} onChange={e => go(forumListParams(params, { quest: e.target.value }))}><option value="">All quests</option>{questFilter && !context?.quests.some(q => q.id === questFilter) && <option value={questFilter}>Linked quest</option>}{context?.quests.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}</select></label><label>Mission<select value={missionFilter} disabled={busy} onChange={e => go(forumListParams(params, { mission: e.target.value }))}><option value="">All missions</option>{missionFilter && !context?.missions.some(m => m.id === missionFilter) && <option value={missionFilter}>Linked mission</option>}{context?.missions.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}</select></label>{!context && <p className="talk-hint">Portal filters could not be loaded.</p>}</div>}
        {!!activeFilters.length && <div className="talk-filter-chips" aria-label="Active filters">{activeFilters.map(filter => <button key={filter.key} disabled={busy} aria-label={'Remove filter: ' + filter.label} onClick={() => go(forumListParams(params, { [filter.key]: undefined }))}>{filter.label}<X size={12}/></button>)}<button className="talk-clear-filters" disabled={busy} onClick={() => go(forumListParams(params, { q: undefined, category: undefined, quest: undefined, mission: undefined }))}>Clear filters</button></div>}
      </>}
      {!loading && viewer && !canPost && <p className="talk-notice">Your portal account has read-only forum access.</p>}
      {error && <div className="talk-card talk-danger" role="alert"><p>{error}</p><div className="talk-form-actions"><button className="talk-btn is-ghost" disabled={busy} onClick={() => setRevision(n => n + 1)}>Reload</button></div></div>}
      {message && <p className="talk-notice" role="status">{message}</p>}
      {shareUrl && <label className="talk-card talk-share-link">Topic link<input readOnly value={shareUrl} onFocus={e => e.currentTarget.select()}/></label>}
      {editor?.kind === 'create' && editorForm(editor)}

      {(preferences || (!topicId && view === 'profile')) && viewer && <ForumPreferences key={viewer.author?.id + '-' + revision} viewer={viewer} busy={busy} onSave={saveProfile} onCancel={() => { setPreferences(false); if (view === 'profile') go(); }}/>}
      {!topicId && view === 'categories' && user?.role === 'ADMIN' && <CategoryManager categories={categories} busy={busy} onSave={(category, existing) => void mutate(async () => { if (existing) await api.patch('/forum/categories/' + encodeURIComponent(category.id), category); else await api.post('/forum/categories', category); setMessage('Community saved.'); })} onRemove={id => void mutate(async () => { await api.delete('/forum/categories/' + encodeURIComponent(id)); setMessage('Community removed.'); })}/>}
      {loading ? <div className="talk-loading" role="status"><span className="sr-only">Loading discussions…</span>{[0, 1, 2].map(n => <div className="talk-card talk-skeleton" aria-hidden="true" key={n}><i/><b/><span/><span/></div>)}</div> : thread ? <>
        <article className="talk-card talk-post">
          <p className="talk-meta"><CommunityIcon id={thread.topic.category_id} size={24}/><button disabled={busy} onClick={() => go({ category: thread.topic.category_id })}><strong>c/{thread.topic.category_id}</strong></button><span>·</span><time dateTime={thread.topic.created_at} title={date(thread.topic.created_at)}>{ago(thread.topic.created_at)}</time></p>
          <div className="talk-meta is-sub"><AuthorIdentity author={thread.topic.author}/>{thread.topic.edited && <span title={date(thread.topic.updated_at)}>· edited</span>}</div>
          <h2 className="talk-post-title">{thread.topic.title}</h2>
          <div className="talk-flairs">{flairs(thread.topic)}</div>{contextLinks(thread.topic)}
          {editor?.kind === 'topic' ? editorForm(editor) : <Markdown text={thread.topic.body}/>}
          {thread.topic.author?.signature && <p className="forum-signature">{thread.topic.author.signature}</p>}
          <div className="talk-actions">
            <span className="talk-pill is-static"><MessageCircle size={16}/>{thread.total}</span>
            <button className={`talk-pill ${thread.topic.states?.[0]?.saved ? 'is-on' : ''}`} disabled={busy} onClick={() => toggleState('saved', thread.topic)}><Bookmark size={16}/>{thread.topic.states?.[0]?.saved ? 'Saved' : 'Save'}</button>
            <button className={`talk-pill ${thread.topic.states?.[0]?.following ? 'is-on' : ''}`} disabled={busy} onClick={() => toggleState('following', thread.topic)}>{thread.topic.states?.[0]?.following ? <BellOff size={16}/> : <Bell size={16}/>}{thread.topic.states?.[0]?.following ? 'Following' : 'Follow'}</button>
            <button className="talk-pill" onClick={() => void share(thread.topic)}><Link2 size={16}/>Share</button>
            {ownActions(thread.topic, true)}
            {staff && <><button className="talk-pill" disabled={busy} onClick={() => void mutate(async () => { await api.patch(`${topicPath}/moderation`, { locked: !thread.topic.locked, pinned: thread.topic.pinned }); })}><LockKeyhole size={14}/>{thread.topic.locked ? 'Unlock' : 'Lock'}</button><button className="talk-pill" disabled={busy} onClick={() => void mutate(async () => { await api.patch(`${topicPath}/moderation`, { locked: thread.topic.locked, pinned: !thread.topic.pinned }); })}><Pin size={14}/>{thread.topic.pinned ? 'Unpin' : 'Pin'}</button></>}
          </div>
          {staff && <label className="forum-move">Move to community<select aria-label="Move to community" value={thread.topic.category_id} disabled={busy} onChange={e => void mutate(async () => { await api.patch(`${topicPath}/moderation`, { locked: thread.topic.locked, pinned: thread.topic.pinned, category_id: e.target.value }); setMessage('Topic moved.'); })}>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
          {reportTarget && !reportTarget.reply_id && reportForm}
          {deleteConfirm(topicPath)}
        </article>

        {!canPost ? null : thread.topic.locked ? <p className="talk-notice"><LockKeyhole size={14}/>This topic is locked. New comments cannot be posted.</p> : <form className="talk-composer" onSubmit={event => { event.preventDefault(); void mutate(async () => { await api.post(`${topicPath}/replies`, { body: reply }); setReply(''); setParams({ topic: thread.topic.id, page: String(Math.ceil((thread.total + 1) / pageSize)) }); setMessage('Your comment has been posted.'); }); }}>
          <label htmlFor="live-reply" className="talk-reply-label">Join the conversation</label><MarkdownEditor id="live-reply" required disabled={busy} value={reply} onChange={value => setReply(value.slice(0, 5000))} placeholder="Join the conversation"/>
          <MentionPicker onPick={token => setReply(value => (value + '\n' + token).slice(0, 5000))}/>
          <div className="talk-form-actions"><small>{reply.length}/5000</small><button className="talk-btn is-primary" disabled={busy || !reply.trim()}>{busy ? 'Posting…' : 'Comment'}</button></div>
        </form>}

        {!thread.total && <p className="talk-empty">No comments yet. Be the first to share what you think.</p>}
        <ol className="talk-comments">
          {thread.acceptedReply && !thread.replies.some(post => post.id === thread.acceptedReply?.id) && renderComment(thread.acceptedReply)}
          {thread.replies.map(renderComment)}
        </ol>
      </> : topicId || ['profile', 'categories'].includes(view) ? null : view === 'reports' ? <section className="talk-feed">
        {reports.reports.map(report => <article className="talk-card" key={report.id}><h3 className="talk-card-title">{report.topic?.title || 'Deleted topic'}</h3><p className="talk-hint">Reported by <b>{report.reporter?.name || 'Unknown Cube'}</b>: {report.reason}</p><blockquote className="talk-quote"><Markdown text={report.reply?.body || report.topic?.body || ''}/></blockquote><div className="talk-form-actions"><button className="talk-btn is-ghost" onClick={() => openTopic(report.topic_id)}>Open topic</button><button className="talk-btn is-primary" disabled={busy} onClick={() => void mutate(async () => { await api.patch(`/forum/reports/${report.id}`, {}); setMessage('The report has been closed.'); })}>Mark reviewed</button></div></article>)}
        {!reports.total && <p className="talk-empty">There are no reports waiting for review.</p>}
      </section> : view === 'index' && !categoryId && !query ? <section className="talk-feed">
        {categories.map(category => <article className="talk-card talk-community-card" key={category.id}>
          <CommunityIcon id={category.id} size={44}/>
          <div>
            <button className="talk-card-title" onClick={() => go({ category: category.id })}>{category.name}</button>
            <p className="talk-meta is-sub">c/{category.id} · {category._count?.topics || 0} topics · {category.reply_count || 0} comments{category.staff_only && ' · Mentors & Admins post here'}</p>
            <p className="talk-snippet">{category.description}</p>{category.topics?.[0] && <button className="talk-hint" onClick={() => openTopic(category.topics[0].id)}>Latest: {category.topics[0].title} · {ago(category.topics[0].last_activity_at)}</button>}
          </div>
          <button className="talk-btn is-ghost" onClick={() => go({ category: category.id })}>View</button>
        </article>)}
        {!categories.length && !error && <p className="talk-empty">No communities have been set up yet.</p>}
      </section> : <section className="talk-feed">
        {list.topics.map(topic => <article className={`talk-card talk-feed-card ${topic.pinned ? 'is-pinned' : ''}`} key={topic.id} onClick={event => { if (!(event.target as HTMLElement).closest('button, a, input, select, summary')) openTopic(topic.id); }}>
          <div className="talk-meta"><CommunityIcon id={topic.category_id} size={22}/><button onClick={() => go({ category: topic.category_id })}><strong>c/{topic.category_id}</strong></button><span>·</span><time dateTime={topic.created_at} title={date(topic.created_at)}>{ago(topic.created_at)}</time><span>·</span><AuthorIdentity author={topic.author} compact/></div>
          <h3><Link className="talk-card-title" to={`/forum?topic=${encodeURIComponent(topic.id)}`}>{topic.title}</Link></h3>
          <div className="talk-flairs">{flairs(topic)}{forumReadStatus(topic.last_activity_at, topic.states?.[0]?.read_at) && <span className="talk-flair is-unread">{forumReadStatus(topic.last_activity_at, topic.states?.[0]?.read_at)}</span>}</div>{contextLinks(topic)}
          <p className="talk-snippet">{preview(topic.body)}</p>
          <div className="talk-actions">
            <Link className="talk-pill" aria-label={`${topic._count?.replies || 0} comments on ${topic.title}`} to={`/forum?topic=${encodeURIComponent(topic.id)}`}><MessageCircle size={16}/>{topic._count?.replies || 0}<span>{topic._count?.replies === 1 ? 'comment' : 'comments'}</span></Link>
            <button className={`talk-pill ${topic.states?.[0]?.saved ? 'is-on' : ''}`} disabled={busy} onClick={() => toggleState('saved', topic)}><Bookmark size={16}/>{topic.states?.[0]?.saved ? 'Saved' : 'Save'}</button>
            <button className={`talk-pill ${topic.states?.[0]?.following ? 'is-on' : ''}`} disabled={busy} onClick={() => toggleState('following', topic)}><Bell size={16}/>{topic.states?.[0]?.following ? 'Following' : 'Follow'}</button>
            <button className="talk-pill" onClick={() => void share(topic)}><Link2 size={16}/>Share</button>
            <span className="talk-active">active {ago(topic.last_activity_at)}</span>
          </div>
        </article>)}
        {!list.topics.length && !error && <div className="talk-empty"><h3>{query ? 'No matches found' : view === 'unanswered' ? 'No unanswered topics' : view === 'solved' ? 'Solved questions will collect here' : 'Nothing here yet'}</h3><p>{query ? 'Try searching with a different word.' : view === 'saved' ? 'Save topics to build your reading list.' : view === 'following' ? 'Follow topics to get notified about new comments.' : 'Ask a question, share what you are building or post something you learned.'}</p><div className="talk-empty-actions">{!!activeFilters.length && <button className="talk-btn is-ghost" onClick={() => go(forumListParams(params, { q: undefined, category: undefined, quest: undefined, mission: undefined }))}>Clear filters</button>}{canCreate && <button className="talk-btn is-primary" onClick={startTopic}>Start a discussion</button>}</div></div>}
      </section>}

      {!loading && pagination}
    </main>

    <aside className="talk-side">
      {viewer && <section className="talk-card forum-viewer"><h2 className="talk-side-title">Your portal identity</h2><AuthorIdentity author={viewer.author}/><button className="talk-btn is-ghost" disabled={busy} onClick={() => { setPreferences(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit badges & signature</button></section>}
      {context && <section className="talk-card"><h2 className="talk-side-title">{context.personal_progress ? 'Your portal context' : 'Portal catalogue'}</h2>{context.quests.slice(0, 3).map(q => <p className="forum-context-item" key={q.id}><Link to="/quests">{q.title}</Link>{context.personal_progress && <small>{q.completed ? 'Completed' : `${q.current || 0}/${q.criteria_value || 1}`}</small>}</p>)}{context.missions.slice(0, 3).map(m => <p className="forum-context-item" key={m.id}><Link to={`/missions/${m.id}`}>{m.title}</Link></p>)}{!context.quests.length && !context.missions.length && <p className="talk-hint">No linked quests or missions yet.</p>}</section>}
      {community ? <section className="talk-card talk-about">
        <div className="talk-about-banner" style={{ background: (communityStyle[community.id] || { color: '#14141c' }).color }}/>
        <h2>{community.name}</h2>
        <p className="talk-snippet">{community.description}</p>
        <dl className="talk-stats"><div><dt>Topics</dt><dd>{community._count?.topics || 0}</dd></div><div><dt>Posting</dt><dd>{community.staff_only ? 'Staff' : 'Everyone'}</dd></div></dl>
        {canPost && (!community.staff_only || staff) && <button className="talk-btn is-primary is-block" disabled={busy || loading} onClick={startTopic}>Create post</button>}
      </section> : <section className="talk-card talk-about">
        <div className="talk-about-banner"/>
        <h2>Cube Community</h2>
        <p className="talk-snippet">Ask questions, share what you are building and help other Cubes along the way.</p>
        {statsStatus === 'ready' ? <dl className="talk-stats"><div><dt>Topics</dt><dd>{stats.topics}</dd></div><div><dt>Comments</dt><dd>{stats.replies}</dd></div><div><dt>Solved</dt><dd>{stats.solved}</dd></div></dl> : statsNotice}
      </section>}

      <section className="talk-card">
        <h2 className="talk-side-title">Most active · last 30 days</h2>
        {statsStatus !== 'ready' ? statsNotice : stats.contributors.length ? <ol className="talk-people">{stats.contributors.map(({ author, topics, replies }) => <li key={author.id}><PortalAvatar author={author} size={28}/><AuthorIdentity author={author} compact/><small title={`${topics} topics, ${replies} comments`}>{topics + replies} posts</small></li>)}</ol> : <p className="talk-hint">No posts in the last 30 days.</p>}
      </section>

      <section className="talk-card">
        <h2 className="talk-side-title">Waiting for a reply</h2>
        {statsStatus !== 'ready' ? statsNotice : stats.unanswered.length ? <ul className="talk-side-topics">{stats.unanswered.map(topic => <li key={topic.id}><p className="talk-meta is-sub"><CommunityIcon id={topic.category_id} size={18}/>c/{topic.category_id} · {ago(topic.created_at)}</p><button disabled={busy} onClick={() => openTopic(topic.id)}>{topic.title}</button></li>)}</ul> : <p className="talk-hint">Every topic has a reply. 🎉</p>}
      </section>
    </aside>
  </div>;
}
