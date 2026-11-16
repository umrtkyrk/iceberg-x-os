import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, GitBranch, GitCommitHorizontal, GitPullRequest, Github, Link2, Pencil, Plus, RefreshCw, Trash2, Upload, X } from 'lucide-react';
import { api } from '../../utils/api';

export type TaskStatus = 'TODO' | 'DOING' | 'DONE';
export interface RoomTask { id: string; title: string; status: TaskStatus; created_at: string; creator: { id: string; name: string } | null }
export interface RoomLink { id: string; title: string; url: string; created_at: string }
interface GithubActivity {
  repo: string; url: string; fetched_at: string; error: string | null;
  pulls: { number: number; title: string; state: 'open' | 'closed' | 'merged' | 'draft'; author: string | null; url: string; updated_at: string }[];
  commits: { sha: string; message: string; author: string | null; url: string; date: string }[];
  pushes: { actor: string | null; branch: string; commits: number | null; date: string }[];
}

const COLUMNS: { status: TaskStatus; label: string }[] = [{ status: 'TODO', label: 'To do' }, { status: 'DOING', label: 'Doing' }, { status: 'DONE', label: 'Done' }];
const errorText = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' });
function ago(value: string) {
  const seconds = (new Date(value).getTime() - Date.now()) / 1000;
  for (const [unit, size] of [['day', 86400], ['hour', 3600], ['minute', 60]] as const) if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  return 'just now';
}

/** Runs one change at a time and reports failures inside the panel. */
function usePanelAction(onChanged: () => void) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(false);
  const run = async (fn: () => Promise<unknown>) => {
    if (pending.current) return false;
    pending.current = true; setBusy(true); setError('');
    try { await fn(); onChanged(); return true; } catch (err) { setError(errorText(err, 'The change could not be saved.')); return false; }
    finally { pending.current = false; setBusy(false); }
  };
  return { busy, error, setError, run };
}

/** The room's to-do board: To do, Doing and Done, with tasks moved one column at a time. */
export function RoomBoard({ roomPath, tasks, canPost, onChanged }: { roomPath: string; tasks: RoomTask[]; canPost: boolean; onChanged: () => void }) {
  const { busy, error, run } = usePanelAction(onChanged);
  const [title, setTitle] = useState('');
  const move = (task: RoomTask, step: number) => {
    const next = COLUMNS[COLUMNS.findIndex(column => column.status === task.status) + step];
    if (next) void run(() => api.patch(`${roomPath}/tasks/${task.id}`, { status: next.status }));
  };
  const add = (event: FormEvent) => { event.preventDefault(); if (title.trim()) void run(async () => { await api.post(`${roomPath}/tasks`, { title }); setTitle(''); }); };
  return <section className="talk-room-panel talk-room-board" aria-label="Task board">
    <header><h3>Board</h3><span>{tasks.filter(task => task.status !== 'DONE').length} open</span></header>
    <div className="talk-room-columns">{COLUMNS.map((column, index) => {
      const items = tasks.filter(task => task.status === column.status);
      return <div key={column.status} className={`talk-room-column is-${column.status.toLowerCase()}`}>
        <h4>{column.label}<small>{items.length}</small></h4>
        <ul>{items.map(task => <li key={task.id}>
          <span title={task.creator ? `Added by ${task.creator.name}` : undefined}>{task.title}</span>
          {canPost && <div className="talk-room-task-actions">
            {index > 0 && <button type="button" disabled={busy} aria-label={`Move “${task.title}” to ${COLUMNS[index - 1].label}`} onClick={() => move(task, -1)}><ArrowLeft size={13}/></button>}
            {index < COLUMNS.length - 1 && <button type="button" disabled={busy} aria-label={`Move “${task.title}” to ${COLUMNS[index + 1].label}`} onClick={() => move(task, 1)}><ArrowRight size={13}/></button>}
            <button type="button" disabled={busy} aria-label={`Delete “${task.title}”`} onClick={() => void run(() => api.delete(`${roomPath}/tasks/${task.id}`))}><Trash2 size={13}/></button>
          </div>}
        </li>)}</ul>
        {!items.length && <p className="talk-room-empty">Nothing here</p>}
      </div>;
    })}</div>
    {canPost && <form className="talk-room-inline-form" onSubmit={add}><label className="sr-only" htmlFor="room-task">New task</label>
      <input id="room-task" maxLength={200} value={title} disabled={busy} onChange={e => setTitle(e.target.value)} placeholder="Add a task…"/>
      <button type="submit" className="talk-room-icon-btn" disabled={busy || !title.trim()} aria-label="Add task"><Plus size={16}/></button></form>}
    {error && <p className="talk-room-error" role="alert">{error}</p>}
  </section>;
}

const host = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

/** Links pinned in the room (repository, design files, docs), shown as tiles. */
export function RoomLinks({ roomPath, links, canPost, onChanged }: { roomPath: string; links: RoomLink[]; canPost: boolean; onChanged: () => void }) {
  const { busy, error, run } = usePanelAction(onChanged);
  const [adding, setAdding] = useState(false), [url, setUrl] = useState(''), [title, setTitle] = useState('');
  const add = (event: FormEvent) => { event.preventDefault(); void run(async () => { await api.post(`${roomPath}/links`, { url, title }); setUrl(''); setTitle(''); setAdding(false); }); };
  return <section className="talk-room-panel talk-room-links" aria-label="Pinned links">
    <header><h3>Pinned</h3>{canPost && <button type="button" className="talk-room-icon-btn" aria-expanded={adding} aria-label={adding ? 'Cancel adding a link' : 'Pin a link'} onClick={() => setAdding(!adding)}>{adding ? <X size={16}/> : <Plus size={16}/>}</button>}</header>
    {adding && <form className="talk-room-link-form" onSubmit={add}>
      <label>Link<input required maxLength={500} value={url} disabled={busy} onChange={e => setUrl(e.target.value)} placeholder="https://github.com/team/repo"/></label>
      <label>Title <small>optional</small><input maxLength={80} value={title} disabled={busy} onChange={e => setTitle(e.target.value)} placeholder="Repository"/></label>
      <button className="talk-btn is-primary" disabled={busy || !url.trim()}>Pin link</button>
    </form>}
    {links.length ? <ul className="talk-room-tiles">{links.map(link => <li key={link.id}>
      <a href={link.url} target="_blank" rel="noopener noreferrer" title={link.url}>
        {/github\.com$/i.test(host(link.url)) ? <Github size={18}/> : <Link2 size={18}/>}<strong>{link.title}</strong><small>{host(link.url)}</small>
      </a>
      {canPost && <button type="button" disabled={busy} aria-label={`Unpin ${link.title}`} onClick={() => void run(() => api.delete(`${roomPath}/links/${link.id}`))}><X size={12}/></button>}
    </li>)}</ul> : !adding && <p className="talk-room-empty">Pin the repository, designs or docs the team uses every day.</p>}
    {error && <p className="talk-room-error" role="alert">{error}</p>}
  </section>;
}

const PR_STATE: Record<GithubActivity['pulls'][number]['state'], string> = { open: 'Open', draft: 'Draft', merged: 'Merged', closed: 'Closed' };

/** Latest pull requests, pushes and commits of the room's GitHub repository. */
const MAX_REPOS = 5;
const activeKey = (roomPath: string) => `forum-room-repo:${roomPath}`;
export function RoomGithub({ roomPath, repos, canPost, onChanged }: { roomPath: string; repos: string[]; canPost: boolean; onChanged: () => void }) {
  const { busy, error, run } = usePanelAction(onChanged);
  const [activity, setActivity] = useState<GithubActivity | null>(null), [loading, setLoading] = useState(false), [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState(''), [tick, setTick] = useState(0);
  // The chosen repository is remembered per group in this browser.
  const [chosen, setChosen] = useState(() => { try { return localStorage.getItem(activeKey(roomPath)) || ''; } catch { return ''; } });
  const repo = repos.find(item => item === chosen) || repos[0] || null;
  const choose = (next: string) => { setChosen(next); setActivity(null); try { localStorage.setItem(activeKey(roomPath), next); } catch { /* storage unavailable */ } };
  const saveRepos = (next: string[]) => run(async () => { await api.put(`${roomPath}/repo`, { repos: next }); });
  useEffect(() => {
    if (!repo) { setActivity(null); return; }
    let current = true;
    const load = () => { setLoading(true); api.get<GithubActivity | null>(`${roomPath}/github?repo=${encodeURIComponent(repo)}`)
      .then(data => { if (current) { setActivity(data); setLoadError(''); } })
      .catch(err => { if (current) setLoadError(errorText(err, 'GitHub activity is unavailable.')); })
      .finally(() => { if (current) setLoading(false); }); };
    load(); const timer = window.setInterval(load, 60000);
    return () => { current = false; window.clearInterval(timer); };
  }, [roomPath, repo, tick]);
  const add = (event: FormEvent) => { event.preventDefault(); if (!draft.trim()) return; void run(async () => { await api.put(`${roomPath}/repo`, { repos: [...repos, draft.trim()] }); setDraft(''); }); };
  const form = <>
    {!!repos.length && <ul className="talk-room-repo-list">{repos.map(item => <li key={item}><span>{item}</span>
      <button type="button" className="talk-room-icon-btn" disabled={busy} aria-label={`Remove ${item}`} onClick={() => void saveRepos(repos.filter(other => other !== item))}><X size={13}/></button></li>)}</ul>}
    {repos.length < MAX_REPOS && <form className="talk-room-inline-form" onSubmit={add}><label className="sr-only" htmlFor="room-repo">Add a GitHub repository</label>
      <input id="room-repo" maxLength={200} value={draft} disabled={busy} onChange={e => setDraft(e.target.value)} placeholder="owner/repository"/>
      <button className="talk-btn is-primary" disabled={busy || !draft.trim()}>Add</button></form>}
    {!!repos.length && <button type="button" className="talk-btn is-ghost talk-room-repo-done" disabled={busy} onClick={() => setEditing(false)}>Done</button>}
  </>;
  return <section className="talk-room-panel talk-room-github" aria-label="GitHub activity">
    <header><h3><Github size={16}/>GitHub</h3>{repo && <div className="talk-room-header-actions">
      <button type="button" className="talk-room-icon-btn" disabled={loading} aria-label="Refresh GitHub activity" onClick={() => setTick(n => n + 1)}><RefreshCw size={14} className={loading ? 'is-spinning' : ''}/></button>
      {canPost && <button type="button" className="talk-room-icon-btn" aria-label="Manage repositories" aria-expanded={editing} onClick={() => { setDraft(''); setEditing(!editing); }}><Pencil size={14}/></button>}</div>}</header>
    {!repo || editing ? <>{!repo && <p className="talk-room-empty">Connect the team repository to see its latest pull requests, pushes and commits here.</p>}{canPost ? form : !repo && <p className="talk-room-empty">No repository connected yet.</p>}</> : <>
      {repos.length > 1 && <div className="talk-room-repo-switch" role="tablist" aria-label="Repositories">{repos.map(item => <button type="button" role="tab" key={item} aria-selected={item === repo} className={item === repo ? 'is-on' : ''} onClick={() => choose(item)} title={item}>{item.split('/')[1]}</button>)}</div>}
      <a className="talk-room-repo" href={`https://github.com/${repo}`} target="_blank" rel="noopener noreferrer">{repo}<ExternalLink size={12}/></a>
      {loadError && <p className="talk-room-error" role="alert">{loadError}</p>}
      {activity?.error && <p className="talk-room-error" role="status">{activity.error}</p>}
      {!activity && !loadError && <p className="talk-room-empty" role="status">Loading activity…</p>}
      {activity && !activity.error && <>
        <h4><GitPullRequest size={14}/>Pull requests</h4>
        {activity.pulls.length ? <ul className="talk-room-feed">{activity.pulls.map(pull => <li key={pull.number}>
          <a href={pull.url} target="_blank" rel="noopener noreferrer"><span className={`talk-room-state is-${pull.state}`}>{PR_STATE[pull.state]}</span><strong>{pull.title}</strong></a>
          <small>#{pull.number}{pull.author ? ` · ${pull.author}` : ''} · {ago(pull.updated_at)}</small></li>)}</ul> : <p className="talk-room-empty">No pull requests yet.</p>}
        <h4><Upload size={14}/>Pushes</h4>
        {activity.pushes.length ? <ul className="talk-room-feed">{activity.pushes.map((push, index) => <li key={index}>
          <span><strong>{push.actor || 'Someone'}</strong> pushed{push.commits !== null ? ` ${push.commits} commit${push.commits === 1 ? '' : 's'}` : ''} to <code><GitBranch size={11}/>{push.branch || 'a branch'}</code></span>
          <small>{ago(push.date)}</small></li>)}</ul> : <p className="talk-room-empty">No recent pushes.</p>}
        <h4><GitCommitHorizontal size={14}/>Commits</h4>
        {activity.commits.length ? <ul className="talk-room-feed">{activity.commits.map(commit => <li key={commit.sha}>
          <a href={commit.url} target="_blank" rel="noopener noreferrer"><code>{commit.sha}</code><strong>{commit.message}</strong></a>
          <small>{commit.author || 'Unknown'}{commit.date ? ` · ${ago(commit.date)}` : ''}</small></li>)}</ul> : <p className="talk-room-empty">No commits yet.</p>}
        <p className="talk-room-updated">Updated {ago(activity.fetched_at)}</p>
      </>}
    </>}
    {error && <p className="talk-room-error" role="alert">{error}</p>}
  </section>;
}
