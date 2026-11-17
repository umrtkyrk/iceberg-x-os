import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Check, Heart, Link2, MessageCircle, MoreHorizontal, Repeat2, Send, Users } from 'lucide-react';
import { api } from '../../utils/api';
import { getAssetUrl } from '../../utils/assets';

export interface MenuItem { label: string; icon?: ReactNode; onClick: () => void; danger?: boolean; hidden?: boolean; disabled?: boolean }

/** The "⋯" button in a post's or comment's top-right corner, holding everything except like, comment and send. */
export function PostMenu({ items, label }: { items: MenuItem[]; label: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null), button = useRef<HTMLButtonElement>(null);
  const visible = items.filter(item => !item.hidden);
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); button.current?.focus(); } };
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', key); };
  }, [open]);
  if (!visible.length) return null;
  return <div className="talk-post-menu" ref={root}>
    <button ref={button} type="button" className="talk-post-menu-btn" aria-label={`More options for ${label}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}><MoreHorizontal size={18}/></button>
    {open && <div className="talk-post-menu-list" role="menu">{visible.map(item => <button type="button" role="menuitem" key={item.label} disabled={item.disabled}
      className={item.danger ? 'is-danger' : ''} onClick={() => { setOpen(false); item.onClick(); }}>{item.icon}{item.label}</button>)}</div>}
  </div>;
}

interface Room { id: string; name: string; _count: { members: number } }

/**
 * The paper-plane sheet: repost to the community, copy the link, or send it to one or more of your
 * groups with an optional note. The groups show the link as a small preview card.
 */
export function SendSheet({ url, title, repost, restricted, onClose, onDone }: { url: string; title: string; restricted?: boolean; repost?: { reposted: boolean; onToggle: () => Promise<void> } | null; onClose: () => void; onDone: (message: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const [rooms, setRooms] = useState<Room[] | null>(null), [chosen, setChosen] = useState<string[]>([]);
  const [note, setNote] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [copied, setCopied] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    let live = true;
    api.get<{ rooms: Room[] }>('/forum/chat/rooms?page=1').then(data => { if (live) setRooms(data.rooms); }).catch(() => { if (live) setRooms([]); });
    return () => { live = false; };
  }, []);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }
    catch { setError('Copy the link: ' + url); }
  };
  const send = async () => {
    if (!chosen.length || busy) return;
    setBusy(true); setError('');
    const body = (note.trim() ? `${note.trim()}\n` : '') + url;
    const failed: string[] = [];
    for (const id of chosen) {
      try { await api.post(`/forum/chat/rooms/${encodeURIComponent(id)}/messages`, { body }); }
      catch { failed.push(id); }
    }
    setBusy(false);
    const sent = chosen.length - failed.length;
    // Only the groups that failed stay selected, so "Send" again cannot post twice to the others.
    if (failed.length) { setError(`Could not send to ${failed.map(id => rooms?.find(room => room.id === id)?.name || 'a group').join(', ')}.${sent ? ` Sent to ${sent} other ${sent === 1 ? 'group' : 'groups'}.` : ''}`); setChosen(failed); return; }
    onDone(`Sent to ${sent} ${sent === 1 ? 'group' : 'groups'}.`); dialog.current?.close();
  };
  return <dialog ref={dialog} className="talk-send-sheet" aria-labelledby={heading} onClose={onClose} onClick={event => { if (event.target === dialog.current) dialog.current?.close(); }}>
    <header><h2 id={heading}>Send</h2><p>{title}</p></header>
    <div className="talk-send-quick">
      {repost && <button type="button" className={repost.reposted ? 'is-on' : ''} disabled={busy} aria-pressed={repost.reposted} onClick={() => void repost.onToggle()}><Repeat2 size={20}/>{repost.reposted ? 'Reposted' : 'Repost'}</button>}
      <button type="button" onClick={() => void copy()}>{copied ? <Check size={20}/> : <Link2 size={20}/>}{copied ? 'Copied' : 'Copy link'}</button>
    </div>
    <h3><Users size={14}/>Send to a group</h3>
    {restricted && <p className="talk-hint">This post is not public: only people who can already see it will be able to open it.</p>}
    {rooms === null ? <p className="talk-hint" role="status">Loading your groups…</p> : !rooms.length ? <p className="talk-hint">You are not in any groups yet.</p> :
      <ul className="talk-send-rooms">{rooms.map(room => {
        const on = chosen.includes(room.id);
        return <li key={room.id}><label className={on ? 'is-on' : ''}>
          <span className="talk-send-avatar" aria-hidden="true">{(room.name || '?').charAt(0).toUpperCase()}</span>
          <span className="talk-send-name">{room.name}<small>{room._count.members} members</small></span>
          <input type="checkbox" checked={on} disabled={busy} onChange={() => setChosen(on ? chosen.filter(id => id !== room.id) : [...chosen, room.id])}/>
        </label></li>;
      })}</ul>}
    {!!chosen.length && <><label className="sr-only" htmlFor={`${heading}-note`}>Add a message</label><input id={`${heading}-note`} className="talk-send-note" maxLength={500} value={note} disabled={busy} placeholder="Add a message…" onChange={e => setNote(e.target.value)}/></>}
    {error && <p className="talk-chat-error" role="alert">{error}</p>}
    <div className="talk-form-actions"><button type="button" className="talk-btn is-ghost" onClick={() => dialog.current?.close()}>Close</button>
      <button type="button" className="talk-btn is-primary" disabled={!chosen.length || busy} onClick={() => void send()}><Send size={15}/> {busy ? 'Sending…' : chosen.length > 1 ? `Send to ${chosen.length} groups` : 'Send'}</button></div>
  </dialog>;
}

interface Preview { id: string; title: string; category_id: string; created_at: string; author: { name: string; avatar_url?: string | null } | null; snippet: string; image: string | null; has_poll: boolean; like_count: number; comment_count: number }
const previews = new Map<string, Promise<Preview | null>>();
const TOPIC_LINK = /\/forum\?topic=([0-9a-f-]{36})(?:&reply=([0-9a-f-]{36}))?/i;
export const forumLinkIn = (text: string) => { const match = TOPIC_LINK.exec(text); return match ? { topic: match[1], reply: match[2] || null } : null; };

/** A shared forum post inside a chat bubble, like a shared reel: cover, title, author and counts. */
export function TopicLinkPreview({ topicId, replyId }: { topicId: string; replyId?: string | null }) {
  const [data, setData] = useState<Preview | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    if (!previews.has(topicId)) previews.set(topicId, api.get<Preview>(`/forum/topics/${encodeURIComponent(topicId)}/preview`).catch(() => null));
    previews.get(topicId)!.then(value => { if (live) setData(value); });
    return () => { live = false; };
  }, [topicId]);
  if (data === undefined) return <div className="talk-post-card is-loading" aria-hidden="true"/>;
  if (data === null) return <p className="talk-post-card is-gone">This post is not available to you.</p>;
  const to = `/forum?topic=${encodeURIComponent(data.id)}${replyId ? `&reply=${encodeURIComponent(replyId)}` : ''}`;
  return <Link className="talk-post-card" to={to} aria-label={`Open post: ${data.title}`}>
    <span className="talk-post-card-head">
      <span className="talk-post-card-avatar" aria-hidden="true">{data.author?.avatar_url ? <img src={getAssetUrl(data.author.avatar_url) || ''} alt=""/> : (data.author?.name || '?').charAt(0).toUpperCase()}</span>
      <span><strong>{data.author?.name || 'Former member'}</strong><small>c/{data.category_id} · {new Date(data.created_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}{replyId ? ' · comment' : ''}</small></span>
    </span>
    <span className="talk-post-card-title">{data.title}</span>
    {data.snippet && <span className="talk-post-card-text">{data.snippet}</span>}
    {data.image && <img className="talk-post-card-image" src={getAssetUrl(data.image) || data.image} alt="" loading="lazy"/>}
    <span className="talk-post-card-stats"><Heart size={14}/>{data.like_count}<MessageCircle size={14}/>{data.comment_count}{data.has_poll && <><BarChart3 size={14}/>Poll</>}</span>
  </Link>;
}
