import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, Bookmark, BookOpen, CheckCircle2, Clock, Coffee, Flame, Hand, Hash, LayoutGrid, LifeBuoy, Link2, LockKeyhole, Megaphone, MessageCircle, MessageCircleQuestion, Minus, Pencil, Pin, Plus, Rocket, Search, Shield, Trash2, Flag, Bell, BellOff, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import { MarkdownEditor } from '../../components/MarkdownEditor';
import './talks.css';

interface Author { id: string; name: string; role: string }
interface Category { id: string; name: string; description: string; staff_only: boolean; _count: { topics: number }; topics: { id: string; title: string; last_activity_at: string }[] }
interface Post { id: string; body: string; author: Author | null; created_at: string; updated_at: string }
interface Topic extends Post { accepted_reply_id: string | null; title: string; category_id: string; category?: Category; locked: boolean; pinned: boolean; last_activity_at: string; states: { saved: boolean; following: boolean; read_at?: string }[]; _count?: { replies: number } }
interface TopicList { topics: Topic[]; total: number; pageSize: number }
interface Thread { acceptedReply?: Post | null; topic: Topic; replies: Post[]; total: number; pageSize: number }
interface Report { id: string; topic_id: string; reply_id: string | null; reason: string; reporter: Author | null; topic: { title: string; body: string; deleted_at: string | null }; reply?: { body: string; deleted_at: string | null } | null }
interface ReportList { reports: Report[]; total: number; pageSize: number }
interface Stats { topics: number; replies: number; solved: number; contributors: { author: Author; topics: number; replies: number }[]; unanswered: { id: string; title: string; category_id: string; created_at: string; author: Author | null }[] }
const emptyStats: Stats = { topics: 0, replies: 0, solved: 0, contributors: [], unanswered: [] };
interface Editor { kind: 'create' | 'topic' | 'reply'; id?: string; title: string; body: string; category: string }
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
const roleLabel = (role?: string) => role === 'ADMIN' ? 'Admin' : role === 'MENTOR' ? 'Mentor' : 'Cube';
const emptyList: TopicList = { topics: [], total: 0, pageSize: 20 };
const hints: Record<string, string> = {
  announcements: 'State the scope and date of the announcement and what Cubes are expected to do.',
  introductions: 'Hi! I am…\n\nWhat I am into:\nWhat I am learning right now:\nWhat I would like to work on together:',
  help: 'What am I trying to do?\n\nThe error I get:\n\nWhat I tried:\n\nRelevant code (no secrets or passwords):',
  showcase: 'What my project is for:\n\nWhat I finished this week:\n\nWhere I am stuck:\n\nWhat I would like feedback on:',
  resources: 'Resource name and link:\n\nWhat does it cover?\n\nWho is it useful for?\n\nMy notes:',
  lounge: 'Start the conversation: a recommendation, a question or a small story from your day…',
};
const communityStyle: Record<string, { icon: LucideIcon; color: string }> = {
  announcements: { icon: Megaphone, color: '#e6007e' },
  introductions: { icon: Hand, color: '#f59e0b' },
  help: { icon: LifeBuoy, color: '#0ea5e9' },
  showcase: { icon: Rocket, color: '#8b5cf6' },
  resources: { icon: BookOpen, color: '#10b981' },
  lounge: { icon: Coffee, color: '#f97316' },
};
const avatarColors = ['#e6007e', '#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#f97316', '#14141c', '#0d9488'];
function Avatar({ name, size = 32 }: { name?: string | null; size?: number }) {
  const label = name || 'Cube';
  const color = avatarColors[[...label].reduce((sum, char) => sum + char.charCodeAt(0), 0) % avatarColors.length];
  return <span className="talk-avatar" style={{ width: size, height: size, background: color, fontSize: Math.round(size * 0.38) }} aria-hidden="true">{label.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()}</span>;
}
function CommunityIcon({ id, size = 24 }: { id?: string; size?: number }) {
  const style = communityStyle[id || ''] || { icon: Hash, color: '#6b7280' };
  const Icon = style.icon;
  return <span className="talk-community-icon" style={{ width: size, height: size, background: style.color }} aria-hidden="true"><Icon size={Math.round(size * 0.55)}/></span>;
}
function Markdown({ text }: { text: string }) { return <div className="markdown"><ReactMarkdown skipHtml components={{ img: () => null }}>{text || ''}</ReactMarkdown></div>; }
function RoleBadge({ role }: { role?: string }) { return role && role !== 'CUBE' ? <span className={`talk-role is-${role.toLowerCase()}`}>{roleLabel(role)}</span> : null; }

export default function Forum() {
  const { user } = useAuth();
  const staff = user?.role === 'ADMIN' || user?.role === 'MENTOR';
  const [params, setParams] = useSearchParams();
  // `konu` is the pre-English parameter still present in older notification links.
  const topicId = params.get('topic') || params.get('konu');
  const categoryId = params.get('category') || '';
  const view = params.get('view') || 'all';
  const query = params.get('q') || '';
  const sort = params.get('sort') === 'newest' ? 'newest' : 'active';
  const rawPage = Number(params.get('page'));
  const page = Number.isInteger(rawPage) && rawPage > 0 && rawPage < 100000 ? rawPage : 1;
  const [categories, setCategories] = useState<Category[]>([]);
  const [list, setList] = useState<TopicList>(emptyList);
  const [thread, setThread] = useState<Thread | null>(null);
  const [reports, setReports] = useState<ReportList>({ reports: [], total: 0, pageSize: 20 });
  const [stats, setStats] = useState<Stats>(emptyStats);
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
  useEffect(() => { setEditor(null); setReportTarget(null); setDeleteTarget(null); setReply(''); setMessage(''); setCollapsed(new Set()); }, [locationKey]);
  useEffect(() => {
    let current = true;
    setLoading(true); setError(''); setThread(null); setList(emptyList); setReports({ reports: [], total: 0, pageSize: 20 });
    const request = new URLSearchParams({ page: String(page), sort });
    if (categoryId) request.set('category', categoryId);
    if (query) request.set('q', query);
    if (['saved', 'following', 'unanswered', 'solved'].includes(view)) request.set('view', view);
    async function load() {
      try {
        const [nextCategories, data] = await Promise.all([
          api.get<Category[]>('/forum/categories'),
          topicId ? api.get<Thread>(`/forum/topics/${encodeURIComponent(topicId)}?page=${page}`)
            : view === 'reports' ? api.get<ReportList>(`/forum/reports?page=${page}`)
              : view !== 'index' || categoryId || query ? api.get<TopicList>(`/forum/topics?${request}`) : Promise.resolve(null),
        ]);
        if (!current) return;
        setCategories(nextCategories);
        if (topicId) setThread(data as Thread);
        else if (view === 'reports') setReports(data as ReportList);
        else setList((data as TopicList | null) || emptyList);
      } catch (err) { if (current) setError(err instanceof Error ? err.message : 'The forum could not be loaded.'); }
      finally { if (current) { setLoading(false); pageHeading.current?.focus(); } }
    }
    void load();
    return () => { current = false; };
  }, [locationKey, revision, user?.id]);
  // Sidebar statistics are best-effort; a failure here must not hide the main content.
  useEffect(() => {
    let current = true;
    api.get<Stats>('/forum/stats')
      .then(next => { if (current && next) setStats(next); })
      .catch(() => undefined);
    return () => { current = false; };
  }, [revision, user?.id]);

  const go = (values: Record<string, string> = {}) => { if (!busyRef.current) setParams(values); };
  const openTopic = (id: string) => go({ topic: id });
  const changePage = (next: number) => { const values = Object.fromEntries(params); values.page = String(next); go(values); };
  async function mutate(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(''); setMessage('');
    try { await action(); setRevision(n => n + 1); }
    catch (err) { setError(err instanceof Error ? err.message : 'The action could not be completed. Your text has been kept.'); }
    finally { busyRef.current = false; setBusy(false); }
  }
  const community = categories.find(c => c.id === (thread?.topic.category_id || categoryId));
  const feeds: [string, string, LucideIcon][] = [['all', 'Home', Flame], ['index', 'All communities', LayoutGrid], ['unanswered', 'Unanswered', MessageCircleQuestion], ['solved', 'Solved', CheckCircle2], ['saved', 'Saved', Bookmark], ['following', 'Following', Bell], ...(staff ? [['reports', 'Moderation', Shield] as [string, string, LucideIcon]] : [])];
  const feedTitle = feeds.find(([key]) => key === view)?.[1] || 'Home';
  const title = thread?.topic.title || (topicId ? 'Topic' : (categoryId && community?.name) || (query ? 'Search results' : feedTitle));
  const canCreate = categories.some(c => !c.staff_only || staff);
  const total = topicId ? thread?.total || 0 : view === 'reports' ? reports.total : list.total;
  const pageSize = topicId ? thread?.pageSize || 20 : view === 'reports' ? reports.pageSize : list.pageSize;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const topicPath = thread ? `/forum/topics/${encodeURIComponent(thread.topic.id)}` : '';
  const startTopic = () => { const category = community && (!community.staff_only || staff) ? community.id : categories.find(c => !c.staff_only)?.id || categories[0]?.id || ''; setEditor({ kind: 'create', title: '', body: '', category }); setReportTarget(null); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const toggleCollapsed = (id: string) => setCollapsed(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleState = (key: 'saved' | 'following', topic: Topic) => void mutate(async () => { await api.put(`/forum/topics/${encodeURIComponent(topic.id)}/state`, { [key]: !topic.states?.[0]?.[key] }); });
  const share = async (topic: Topic) => {
    try { await navigator.clipboard.writeText(new URL(`?topic=${encodeURIComponent(topic.id)}`, window.location.href).href); setMessage('Link copied to clipboard.'); }
    catch { setMessage('Your browser blocked copying the link.'); }
  };

  const submitEditor = (event: FormEvent) => { event.preventDefault(); if (!editor) return; void mutate(async () => {
    if (editor.kind === 'create') { const created = await api.post<{ id: string }>('/forum/topics', { title: editor.title, body: editor.body, category_id: editor.category }); setParams({ topic: created.id }); }
    else await api.patch(editor.kind === 'topic' ? topicPath : `${topicPath}/replies/${editor.id}`, { title: editor.title, body: editor.body });
    setEditor(null); setMessage('Your post has been saved.');
  }); };
  const editorForm = (current: Editor) => <form className="talk-card talk-form" onSubmit={submitEditor}>{current.kind === 'create' && <h2>Create a post</h2>}<fieldset disabled={busy || loading}>
    {current.kind === 'create' && <label>Community<select value={current.category} onChange={event => setEditor({ ...current, category: event.target.value })}>{categories.filter(c => !c.staff_only || staff).map(c => <option key={c.id} value={c.id}>c/{c.id} · {c.name}</option>)}</select></label>}
    {current.kind !== 'reply' && <label>Title<input required minLength={8} maxLength={160} value={current.title} onChange={event => setEditor({ ...current, title: event.target.value })} placeholder="A title that clearly describes the topic"/></label>}
    <label htmlFor="live-editor">Body</label><MarkdownEditor id="live-editor" required disabled={busy} value={current.body} onChange={body => setEditor({ ...current, body: body.slice(0, current.kind === 'reply' ? 5000 : 10000) })} placeholder={hints[current.category] || 'What would you like to share?'} rows={8}/>
    <p className="talk-hint">{current.kind === 'reply' ? 'Up to 5,000' : '15–10,000'} characters · Markdown supported · no image uploads</p>
    <div className="talk-form-actions"><button type="button" className="talk-btn is-ghost" onClick={() => setEditor(null)}>Cancel</button><button className="talk-btn is-primary" disabled={current.body.trim().length < (current.kind === 'reply' ? 1 : 15) || (current.kind !== 'reply' && current.title.trim().length < 8)}>{busy ? 'Saving…' : current.kind === 'create' ? 'Post' : 'Save'}</button></div>
  </fieldset></form>;
  const reportForm = <form className="talk-card talk-form" onSubmit={event => { event.preventDefault(); void mutate(async () => { await api.post(`${topicPath}/reports`, { ...reportTarget, reason }); setReportTarget(null); setMessage('Thanks — the moderators will take a look.'); }); }}><label>Why are you reporting this?<textarea required minLength={10} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} placeholder="Briefly explain the problem."/></label><div className="talk-form-actions"><button type="button" className="talk-btn is-ghost" disabled={busy} onClick={() => setReportTarget(null)}>Cancel</button><button className="talk-btn is-primary" disabled={busy || reason.trim().length < 10}>Report</button></div></form>;
  const deleteConfirm = (target: string) => deleteTarget === target && <div className="talk-card talk-danger" role="alert"><p>Delete this post? This cannot be undone.</p><div className="talk-form-actions"><button className="talk-btn is-ghost" disabled={busy} onClick={() => setDeleteTarget(null)}>Cancel</button><button className="talk-btn is-danger" disabled={busy} onClick={() => void mutate(async () => { await api.delete(target); if (target === topicPath) setParams({}); setDeleteTarget(null); setMessage('The post has been deleted.'); })}>Delete</button></div></div>;
  const quote = (post: Post) => { setReply(text => `${text}${text ? '\n\n' : ''}> ${(post.body || '').slice(0, 800).replace(/\n/g, '\n> ')}\n\n`); document.getElementById('live-reply')?.focus(); };
  const ownActions = (post: Post, first: boolean) => <>
    {post.author?.id === user?.id && !thread?.topic.locked && <button className="talk-pill" disabled={busy} onClick={() => { setEditor({ kind: first ? 'topic' : 'reply', id: post.id, title: thread?.topic.title || '', body: post.body, category: thread?.topic.category_id || '' }); setReportTarget(null); }}><Pencil size={14}/>Edit</button>}
    {(post.author?.id === user?.id || staff) && <button className="talk-pill" disabled={busy} onClick={() => setDeleteTarget(first ? topicPath : `${topicPath}/replies/${post.id}`)}><Trash2 size={14}/>Delete</button>}
    <button className="talk-pill" disabled={busy} onClick={() => { setReportTarget(first ? {} : { reply_id: post.id }); setReason(''); setEditor(null); }}><Flag size={14}/>Report</button>
  </>;
  const flairs = (topic: Topic) => <>
    {topic.pinned && <span className="talk-flair is-pinned"><Pin size={11}/>Pinned</span>}
    {topic.locked && <span className="talk-flair"><LockKeyhole size={11}/>Locked</span>}
    {topic.accepted_reply_id && <span className="talk-flair is-solved"><CheckCircle2 size={11}/>Solved</span>}
  </>;
  const renderComment = (post: Post) => {
    const accepted = thread?.topic.accepted_reply_id === post.id;
    const hidden = collapsed.has(post.id);
    return <li className={`talk-comment ${accepted ? 'is-accepted' : ''}`} key={post.id}>
      <div className="talk-comment-rail">
        <Avatar name={post.author?.name} size={28}/>
        <button className="talk-thread-line" aria-label={hidden ? 'Expand comment' : 'Collapse comment'} aria-expanded={!hidden} onClick={() => toggleCollapsed(post.id)}/>
      </div>
      <div className="talk-comment-body">
        <p className="talk-meta">
          <strong>{post.author?.name || 'Unknown Cube'}</strong><RoleBadge role={post.author?.role}/>
          {post.author?.id && post.author.id === thread?.topic.author?.id && <span className="talk-op-tag">OP</span>}
          <span>·</span><time dateTime={post.created_at} title={date(post.created_at)}>{ago(post.created_at)}</time>{post.updated_at !== post.created_at && <span title={date(post.updated_at)}>· edited</span>}
          {hidden && <button className="talk-expand" onClick={() => toggleCollapsed(post.id)}><Plus size={12}/></button>}
        </p>
        {!hidden && <>
          {accepted && <p className="talk-accepted"><CheckCircle2 size={14}/>Accepted answer</p>}
          {editor?.kind === 'reply' && editor.id === post.id ? editorForm(editor) : <Markdown text={post.body}/>}
          <div className="talk-actions">
            {!thread?.topic.locked && <button className="talk-pill" onClick={() => quote(post)}><MessageCircle size={14}/>Reply</button>}
            {thread?.topic.category_id === 'help' && thread.topic.author?.id === user?.id && !thread.topic.locked && <button className="talk-pill" disabled={busy} onClick={() => void mutate(async () => { await api.put(`${topicPath}/answer`, { reply_id: accepted ? null : post.id }); })}><CheckCircle2 size={14}/>{accepted ? 'Unmark answer' : 'Accept answer'}</button>}
            {ownActions(post, false)}
            <button className="talk-pill" onClick={() => toggleCollapsed(post.id)}><Minus size={14}/>Collapse</button>
          </div>
          {reportTarget?.reply_id === post.id && reportForm}
          {deleteConfirm(`${topicPath}/replies/${post.id}`)}
        </>}
      </div>
    </li>;
  };
  const pagination = (pages > 1 || page > 1) && <nav className="talk-pagination" aria-label="Pages">
    <button className="talk-btn is-ghost" disabled={busy || page <= 1} onClick={() => changePage(page - 1)}>Previous</button>
    <span>Page {page} of {pages}</span>
    <button className="talk-btn is-ghost" disabled={busy || page >= pages} onClick={() => changePage(page + 1)}>Next</button>
  </nav>;

  return <div className="talk-forum" aria-busy={loading || busy}>
    <nav className="talk-nav" aria-label="Forum navigation">
      <ul>{feeds.map(([key, label, Icon]) => <li key={key}><button disabled={busy} className={!topicId && !categoryId && !query && view === key ? 'selected' : ''} onClick={() => go(key === 'all' ? {} : { view: key })}><Icon size={18}/>{label}</button></li>)}</ul>
      <h2>Communities</h2>
      <ul>{categories.map(category => <li key={category.id}><button disabled={busy} className={community?.id === category.id && !query ? 'selected' : ''} onClick={() => go({ category: category.id })}><CommunityIcon id={category.id} size={22}/><span>c/{category.id}</span></button></li>)}</ul>
    </nav>

    <main className="talk-main">
      <div className="talk-topbar">
        <form className="talk-search" role="search" onSubmit={event => { event.preventDefault(); go(search.trim() ? { q: search.trim() } : {}); }}><Search size={16} aria-hidden="true"/><label htmlFor="forum-search" className="sr-only">Search the forum</label><input id="forum-search" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} placeholder="Search the forum"/></form>
        {view !== 'reports' && canCreate && <button className="talk-btn is-primary" disabled={busy || loading} onClick={startTopic}><Plus size={16}/>Create post</button>}
      </div>

      {thread ? <button className="talk-back" disabled={busy} onClick={() => go({ category: thread.topic.category_id })}><ArrowLeft size={16}/>c/{thread.topic.category_id}</button>
        : community && categoryId ? <header className="talk-community-head">
          <CommunityIcon id={community.id} size={56}/>
          <div><h1 ref={pageHeading} tabIndex={-1}>{community.name}</h1><p>c/{community.id}</p></div>
        </header>
          : <h1 ref={pageHeading} tabIndex={-1} className="talk-title">{title}</h1>}
      {thread && <h1 ref={pageHeading} tabIndex={-1} className="sr-only">{title}</h1>}
      {!thread && query && <p className="talk-hint">{list.total} {list.total === 1 ? 'result' : 'results'} for “{query}”</p>}

      {!thread && view !== 'reports' && (view !== 'index' || categoryId || query) && <div className="talk-sort" role="group" aria-label="Sort topics">
        <button className={sort === 'active' ? 'selected' : ''} disabled={busy} onClick={() => go({ ...Object.fromEntries(params), sort: 'active', page: '1' })}><Flame size={15}/>Active</button>
        <button className={sort === 'newest' ? 'selected' : ''} disabled={busy} onClick={() => go({ ...Object.fromEntries(params), sort: 'newest', page: '1' })}><Clock size={15}/>New</button>
      </div>}

      {error && <div className="talk-card talk-danger" role="alert"><p>{error}</p><div className="talk-form-actions"><button className="talk-btn is-ghost" disabled={busy} onClick={() => setRevision(n => n + 1)}>Reload</button></div></div>}
      {message && <p className="talk-notice" role="status">{message}</p>}
      {editor?.kind === 'create' && editorForm(editor)}

      {loading ? <p className="talk-empty" role="status">Loading…</p> : thread ? <>
        <article className="talk-card talk-post">
          <p className="talk-meta"><CommunityIcon id={thread.topic.category_id} size={24}/><button disabled={busy} onClick={() => go({ category: thread.topic.category_id })}><strong>c/{thread.topic.category_id}</strong></button><span>·</span><time dateTime={thread.topic.created_at} title={date(thread.topic.created_at)}>{ago(thread.topic.created_at)}</time></p>
          <p className="talk-meta is-sub">{thread.topic.author?.name || 'Unknown Cube'}<RoleBadge role={thread.topic.author?.role}/>{thread.topic.updated_at !== thread.topic.created_at && <span title={date(thread.topic.updated_at)}>· edited</span>}</p>
          <h2 className="talk-post-title">{thread.topic.title}</h2>
          <div className="talk-flairs">{flairs(thread.topic)}</div>
          {editor?.kind === 'topic' ? editorForm(editor) : <Markdown text={thread.topic.body}/>}
          <div className="talk-actions">
            <span className="talk-pill is-static"><MessageCircle size={16}/>{thread.total}</span>
            <button className={`talk-pill ${thread.topic.states?.[0]?.saved ? 'is-on' : ''}`} disabled={busy} onClick={() => toggleState('saved', thread.topic)}><Bookmark size={16}/>{thread.topic.states?.[0]?.saved ? 'Saved' : 'Save'}</button>
            <button className={`talk-pill ${thread.topic.states?.[0]?.following ? 'is-on' : ''}`} disabled={busy} onClick={() => toggleState('following', thread.topic)}>{thread.topic.states?.[0]?.following ? <BellOff size={16}/> : <Bell size={16}/>}{thread.topic.states?.[0]?.following ? 'Following' : 'Follow'}</button>
            <button className="talk-pill" onClick={() => void share(thread.topic)}><Link2 size={16}/>Share</button>
            {ownActions(thread.topic, true)}
            {staff && <><button className="talk-pill" disabled={busy} onClick={() => void mutate(async () => { await api.patch(`${topicPath}/moderation`, { locked: !thread.topic.locked, pinned: thread.topic.pinned }); })}><LockKeyhole size={14}/>{thread.topic.locked ? 'Unlock' : 'Lock'}</button><button className="talk-pill" disabled={busy} onClick={() => void mutate(async () => { await api.patch(`${topicPath}/moderation`, { locked: thread.topic.locked, pinned: !thread.topic.pinned }); })}><Pin size={14}/>{thread.topic.pinned ? 'Unpin' : 'Pin'}</button></>}
          </div>
          {reportTarget && !reportTarget.reply_id && reportForm}
          {deleteConfirm(topicPath)}
        </article>

        {thread.topic.locked ? <p className="talk-notice"><LockKeyhole size={14}/>This topic is locked. New comments cannot be posted.</p> : <form className="talk-composer" onSubmit={event => { event.preventDefault(); void mutate(async () => { await api.post(`${topicPath}/replies`, { body: reply }); setReply(''); setParams({ topic: thread.topic.id, page: String(Math.ceil((thread.total + 1) / pageSize)) }); setMessage('Your comment has been posted.'); }); }}>
          <label htmlFor="live-reply" className="sr-only">Your comment</label><MarkdownEditor id="live-reply" required disabled={busy} value={reply} onChange={value => setReply(value.slice(0, 5000))} placeholder="Join the conversation"/>
          <div className="talk-form-actions"><small>{reply.length}/5000</small><button className="talk-btn is-primary" disabled={busy || !reply.trim()}>{busy ? 'Posting…' : 'Comment'}</button></div>
        </form>}

        {!thread.total && <p className="talk-empty">No comments yet. Be the first to share what you think.</p>}
        <ol className="talk-comments">
          {thread.acceptedReply && !thread.replies.some(post => post.id === thread.acceptedReply?.id) && renderComment(thread.acceptedReply)}
          {thread.replies.map(renderComment)}
        </ol>
      </> : topicId ? null : view === 'reports' ? <section className="talk-feed">
        {reports.reports.map(report => <article className="talk-card" key={report.id}><h3 className="talk-card-title">{report.topic?.title || 'Deleted topic'}</h3><p className="talk-hint">Reported by <b>{report.reporter?.name || 'Unknown Cube'}</b>: {report.reason}</p><blockquote className="talk-quote"><Markdown text={report.reply?.body || report.topic?.body || ''}/></blockquote><div className="talk-form-actions"><button className="talk-btn is-ghost" onClick={() => openTopic(report.topic_id)}>Open topic</button><button className="talk-btn is-primary" disabled={busy} onClick={() => void mutate(async () => { await api.patch(`/forum/reports/${report.id}`, {}); setMessage('The report has been closed.'); })}>Mark reviewed</button></div></article>)}
        {!reports.total && <p className="talk-empty">There are no reports waiting for review.</p>}
      </section> : view === 'index' && !categoryId && !query ? <section className="talk-feed">
        {categories.map(category => <article className="talk-card talk-community-card" key={category.id}>
          <CommunityIcon id={category.id} size={44}/>
          <div>
            <button className="talk-card-title" onClick={() => go({ category: category.id })}>{category.name}</button>
            <p className="talk-meta is-sub">c/{category.id} · {category._count?.topics || 0} topics{category.staff_only && ' · Mentors & Admins post here'}</p>
            <p className="talk-snippet">{category.description}</p>
          </div>
          <button className="talk-btn is-ghost" onClick={() => go({ category: category.id })}>View</button>
        </article>)}
        {!categories.length && !error && <p className="talk-empty">No communities have been set up yet.</p>}
      </section> : <section className="talk-feed">
        {list.topics.map(topic => <article className={`talk-card talk-feed-card ${topic.pinned ? 'is-pinned' : ''}`} key={topic.id} onClick={event => { if (!(event.target as HTMLElement).closest('button')) openTopic(topic.id); }}>
          <p className="talk-meta"><CommunityIcon id={topic.category_id} size={22}/><button onClick={() => go({ category: topic.category_id })}><strong>c/{topic.category_id}</strong></button><span>·</span><time dateTime={topic.created_at} title={date(topic.created_at)}>{ago(topic.created_at)}</time><span>·</span><span>{topic.author?.name || 'Unknown Cube'}</span><RoleBadge role={topic.author?.role}/></p>
          <h3><button className="talk-card-title" onClick={() => openTopic(topic.id)}>{topic.title}</button></h3>
          <div className="talk-flairs">{flairs(topic)}</div>
          <p className="talk-snippet">{preview(topic.body)}</p>
          <div className="talk-actions">
            <button className="talk-pill" onClick={() => openTopic(topic.id)}><MessageCircle size={16}/>{topic._count?.replies || 0}</button>
            <button className={`talk-pill ${topic.states?.[0]?.saved ? 'is-on' : ''}`} disabled={busy} onClick={() => toggleState('saved', topic)}><Bookmark size={16}/>{topic.states?.[0]?.saved ? 'Saved' : 'Save'}</button>
            <button className={`talk-pill ${topic.states?.[0]?.following ? 'is-on' : ''}`} disabled={busy} onClick={() => toggleState('following', topic)}><Bell size={16}/>{topic.states?.[0]?.following ? 'Following' : 'Follow'}</button>
            <button className="talk-pill" onClick={() => void share(topic)}><Link2 size={16}/>Share</button>
            <span className="talk-active">active {ago(topic.last_activity_at)}</span>
          </div>
        </article>)}
        {!list.topics.length && !error && <div className="talk-empty"><h3>{query ? 'No matches found' : view === 'unanswered' ? 'No unanswered topics' : view === 'solved' ? 'Solved questions will collect here' : 'Nothing here yet'}</h3><p>{query ? 'Try searching with a different word.' : view === 'saved' ? 'Save topics to build your reading list.' : view === 'following' ? 'Follow topics to get notified about new comments.' : 'Ask a question, share what you are building or post something you learned.'}</p></div>}
      </section>}

      {!loading && pagination}
    </main>

    <aside className="talk-side">
      {community ? <section className="talk-card talk-about">
        <div className="talk-about-banner" style={{ background: (communityStyle[community.id] || { color: '#14141c' }).color }}/>
        <h2>{community.name}</h2>
        <p className="talk-snippet">{community.description}</p>
        <dl className="talk-stats"><div><dt>Topics</dt><dd>{community._count?.topics || 0}</dd></div><div><dt>Posting</dt><dd>{community.staff_only ? 'Staff' : 'Everyone'}</dd></div></dl>
        {(!community.staff_only || staff) && <button className="talk-btn is-primary is-block" disabled={busy || loading} onClick={startTopic}>Create post</button>}
      </section> : <section className="talk-card talk-about">
        <div className="talk-about-banner"/>
        <h2>Cube Community</h2>
        <p className="talk-snippet">Ask questions, share what you are building and help other Cubes along the way.</p>
        <dl className="talk-stats"><div><dt>Topics</dt><dd>{stats.topics}</dd></div><div><dt>Comments</dt><dd>{stats.replies}</dd></div><div><dt>Solved</dt><dd>{stats.solved}</dd></div></dl>
      </section>}

      <section className="talk-card">
        <h2 className="talk-side-title">Most active · last 30 days</h2>
        {stats.contributors.length ? <ol className="talk-people">{stats.contributors.map(({ author, topics, replies }) => <li key={author.id}><Avatar name={author.name} size={28}/><span>{author.name || 'Unknown Cube'}<RoleBadge role={author.role}/></span><small title={`${topics} topics, ${replies} comments`}>{topics + replies} posts</small></li>)}</ol> : <p className="talk-hint">No posts in the last 30 days.</p>}
      </section>

      <section className="talk-card">
        <h2 className="talk-side-title">Waiting for a reply</h2>
        {stats.unanswered.length ? <ul className="talk-side-topics">{stats.unanswered.map(topic => <li key={topic.id}><p className="talk-meta is-sub"><CommunityIcon id={topic.category_id} size={18}/>c/{topic.category_id} · {ago(topic.created_at)}</p><button disabled={busy} onClick={() => openTopic(topic.id)}>{topic.title}</button></li>)}</ul> : <p className="talk-hint">Every topic has a reply. 🎉</p>}
      </section>
    </aside>
  </div>;
}
