import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ChangeEvent, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { ArrowLeft, BarChart3, TrendingUp, Pin, Check, CheckCheck, Lock, Paperclip, Plus, Search, Send, Smile, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../utils/api';
import { ChatUnreadBadge, useChatUnread } from './ForumChatUnread';
import { EMOJIS } from '../../components/MarkdownEditor';
import { RoomBoard, RoomGithub, RoomLinks, type RoomLink, type RoomTask } from './ForumRoomPanels';
import { PollCard, PollEditor, emptyPoll, pollPayload, pollProblem, type Poll, type PollDraft } from './ForumPoll';
import { MissionUpdatePanel } from './ForumMissionUpdate';
import { TopicLinkPreview, forumLinkIn } from './ForumPostMenu';
import { GroupInfo, PeoplePicker, RoomAvatar, personLabel, type GroupDetail, type Person } from './ForumGroupInfo';

interface Room { id: string; name: string; updated_at: string; my_role: 'ADMIN' | 'MEMBER'; _count: { members: number };
  last_message: { created_at: string; body: string; deleted: boolean; author: { id: string; name: string } | null } | null }
interface Detail extends GroupDetail { mission_id?: string | null; typing: { id: string; name: string }[]; github_repo?: string | null; github_repos?: string[];
  pinned?: { id: string; body: string; created_at: string; author: { id: string; name: string } | null }[]; tasks?: RoomTask[]; links?: RoomLink[] }
interface Attachment { id: string; original_name: string; byte_size: number }
interface Message { id: string; body: string; created_at: string; pinned_at?: string | null; edited_at: string | null; deleted_at: string | null; author: Person | null;
  attachments: Attachment[]; poll?: Poll | null; reactions: { user_id: string; emoji: string }[]; read_by: string[]; read_all: boolean; reply_to: { id: string; body: string; deleted_at: string | null; author: { name: string } | null } | null }
const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const FILE_MAX = 10 * 1024 * 1024;
const fileSize = (bytes: number) => bytes >= 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(1) + ' MB' : Math.ceil(bytes / 1024) + ' KB';
function MessageText({ text }: { text: string }) { return <>{text.split(/(https?:\/\/[^\s<>]+)/gi).map((part, i) => /^https?:\/\//i.test(part) ? <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a> : part)}</>; }
const base = '/forum/chat';
const PANE_LIMITS = { left: [200, 480, 270], right: [220, 520, 300] } as const;
const CHAT_MIN = 360;
type Pane = keyof typeof PANE_LIMITS;
const paneKey = (side: Pane) => `forum-room-pane-${side}`;
const storedPane = (side: Pane) => {
  try { const value = Number(localStorage.getItem(paneKey(side))); if (value) return Math.min(PANE_LIMITS[side][1], Math.max(PANE_LIMITS[side][0], value)); } catch { /* storage unavailable */ }
  return PANE_LIMITS[side][2];
};
function PaneResizer({ side, width, setWidth, otherWidth, container }: { side: Pane; width: number; setWidth: (value: number) => void; otherWidth: number; container: RefObject<HTMLDivElement> }) {
  const [min, max, fallback] = PANE_LIMITS[side];
  const clamp = (value: number) => {
    const room = (container.current?.clientWidth || Infinity) - otherWidth - CHAT_MIN - 40;
    return Math.round(Math.max(min, Math.min(max, room, value)));
  };
  const save = (value: number) => { setWidth(value); try { localStorage.setItem(paneKey(side), String(value)); } catch { /* storage unavailable */ } };
  const start = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const handle = e.currentTarget, startX = e.clientX, startWidth = width;
    handle.setPointerCapture(e.pointerId); document.querySelector('.cube-forum')?.classList.add('is-resizing-pane');
    let last = startWidth;
    const move = (ev: PointerEvent) => { last = clamp(startWidth + (side === 'left' ? ev.clientX - startX : startX - ev.clientX)); setWidth(last); };
    const stop = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', stop); handle.removeEventListener('pointercancel', stop); document.querySelector('.cube-forum')?.classList.remove('is-resizing-pane'); save(last); };
    handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', stop); handle.addEventListener('pointercancel', stop);
  };
  const key = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 48 : 16, grow = side === 'left' ? 'ArrowRight' : 'ArrowLeft', shrink = side === 'left' ? 'ArrowLeft' : 'ArrowRight';
    if (e.key === grow) save(clamp(width + step)); else if (e.key === shrink) save(clamp(width - step)); else if (e.key === 'Home') save(min); else if (e.key === 'End') save(clamp(max)); else return;
    e.preventDefault();
  };
  return <div className="talk-room-resizer" role="separator" tabIndex={0} aria-orientation="vertical" aria-label={`Resize ${side} panel`} aria-valuemin={min} aria-valuemax={max} aria-valuenow={width}
    title="Drag to resize · double-click to reset" onPointerDown={start} onKeyDown={key} onDoubleClick={() => save(clamp(fallback))}/>;
}
const listTime = (value: string) => { const date = new Date(value); return date.toDateString() === new Date().toDateString() ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : date.toLocaleDateString([], { day: 'numeric', month: 'short' }); };

export function ForumChat({ userId, canPost, isCube = false }: { userId: string; canPost: boolean; isCube?: boolean }) {
  const [creating, setCreating] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]), [total, setTotal] = useState(0), [page, setPage] = useState(1);
  const [selected, setSelected] = useState(() => new URLSearchParams(window.location.search).get('room') || ''), [detail, setDetail] = useState<Detail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]), [messagePage, setMessagePage] = useState(1), [messageTotal, setMessageTotal] = useState(0);
  const [name, setName] = useState(''), [description, setDescription] = useState(''), [members, setMembers] = useState<Person[]>([]), [body, setBody] = useState('');
  const [query, setQuery] = useState(''), [searchDraft, setSearchDraft] = useState(''), [searchOpen, setSearchOpen] = useState(false), [infoOpen, setInfoOpen] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]), [uploading, setUploading] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null), [editing, setEditing] = useState<Message | null>(null);
  const [reacting, setReacting] = useState(''), [deleting, setDeleting] = useState(''), [emojiOpen, setEmojiOpen] = useState(false);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0);
  const [pinIndex, setPinIndex] = useState(0);
  const [workspaceHeight, setWorkspaceHeight] = useState(0), [pollDraft, setPollDraft] = useState<PollDraft | null>(null), [updateOpen, setUpdateOpen] = useState(false), [notice, setNotice] = useState('');
  const [leftWidth, setLeftWidth] = useState(() => storedPane('left')), [rightWidth, setRightWidth] = useState(() => storedPane('right'));
  const pending = useRef(false), uploadingRef = useRef(false), bodyRef = useRef(''), lastTyped = useRef(0), readMessage = useRef<string | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null), fileInput = useRef<HTMLInputElement>(null), messageList = useRef<HTMLOListElement>(null), workspace = useRef<HTMLDivElement>(null);
  const draftBeforeEdit = useRef<string | null>(null), acknowledgedRead = useRef<string | null>(null);
  const pendingFiles = useRef<Attachment[]>([]); pendingFiles.current = attachments; bodyRef.current = body;
  const unread = useChatUnread(userId);
  const roomPath = `${base}/rooms/${encodeURIComponent(selected)}`;
  const refresh = () => setRevision(n => n + 1);
  const inRoom = !!selected && !creating;

  // An open room fills the rest of the window, so the board, chat and side panel are visible without page scrolling.
  useLayoutEffect(() => {
    if (!inRoom) { setWorkspaceHeight(0); return; }
    window.scrollTo({ top: 0 });
    const fit = () => { const node = workspace.current; if (node) setWorkspaceHeight(Math.max(480, Math.floor(window.innerHeight - node.getBoundingClientRect().top - 16))); };
    fit(); window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [inRoom, !!detail?.mission_id]); // the mission banner above the workspace changes its top
  const clearDraft = () => { setBody(''); setReplyTo(null); setEditing(null); setEmojiOpen(false); lastTyped.current = 0; };
  const choose = (id: string) => {
    if (uploadingRef.current) return;
    for (const file of pendingFiles.current) void api.delete(`${base}/rooms/${selected}/files/${file.id}`).catch(() => {});
    setAttachments([]); setDetail(null); setMessages([]); clearDraft(); setSelected(id); setMessagePage(1); setCreating(false); setError('');
    setQuery(''); setSearchDraft(''); setSearchOpen(false); setInfoOpen(false); setDeleting(''); setReacting(''); readMessage.current = null; acknowledgedRead.current = null;
  };
  useEffect(() => {
    if (inRoom) return;
    let current = true, running = false;
    setLoading(true);
    const load = async () => {
      if (running) return; running = true;
      try { const data = await api.get(`${base}/rooms?page=${page}`); if (current) { setRooms(data.rooms); setTotal(data.total); } }
      catch (err) { if (current) { setRooms([]); setError(err instanceof Error ? err.message : 'Groups unavailable.'); } }
      finally { running = false; if (current) setLoading(false); }
    };
    void load(); const timer = window.setInterval(load, 4000);
    return () => { current = false; window.clearInterval(timer); };
  }, [inRoom, page, revision, userId]);
  useEffect(() => {
    if (!selected) return;
    let current = true, running = false;
    const load = async () => {
      if (running) return; running = true;
      try {
        const next = await api.get<Detail>(roomPath);
        const data = await api.get(`${roomPath}/messages?${new URLSearchParams({ page: String(messagePage), ...(query ? { q: query } : {}) })}`);
        if (current) {
          const list = messageList.current;
          const atBottom = !list || list.scrollHeight - list.scrollTop - list.clientHeight < 100;
          setDetail(next); setMessages(data.messages); setMessageTotal(data.total);
          readMessage.current = !query && messagePage === 1 ? data.messages.at(-1)?.id || null : null;
          if (atBottom && messagePage === 1) window.setTimeout(() => { const node = messageList.current; if (node) node.scrollTop = node.scrollHeight; }, 0);
        }
      } catch (err) {
        if (!current) return;
        // Removed from the group, or the group was deleted: back to the list like WhatsApp.
        if ((err as { status?: number }).status === 404) { choose(''); setError('You are no longer a member of that group.'); return; }
        setError(err instanceof Error ? err.message : 'Group unavailable.');
      }
      finally { running = false; }
    };
    void load(); const timer = window.setInterval(load, 3000);
    return () => { current = false; window.clearInterval(timer); };
  }, [selected, messagePage, revision, userId, query]);
  useEffect(() => {
    if (!selected) return;
    let current = true, running = false;
    const presence = async () => {
      if (running || document.visibilityState !== 'visible' || !document.hasFocus()) return;
      running = true;
      const readId = readMessage.current;
      try { await api.put(`${roomPath}/presence`, { typing: canPost && !!bodyRef.current.trim() && Date.now() - lastTyped.current < 3500, read_message_id: readId });
        if (current && readId && acknowledgedRead.current !== readId) { acknowledgedRead.current = readId; window.dispatchEvent(new Event('forum-chat-read')); }
      } catch { /* the room poll reports access changes */ }
      finally { running = false; }
    };
    const timer = window.setInterval(presence, 2500);
    return () => { current = false; window.clearInterval(timer); };
  }, [selected, userId, canPost]);
  const mutate = async (fn: () => Promise<void>) => {
    if (pending.current || uploadingRef.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await fn(); refresh(); } catch (err) { setError(err instanceof Error ? err.message : 'The change could not be saved.'); }
    finally { pending.current = false; setBusy(false); }
  };
  const create = (event: FormEvent) => { event.preventDefault(); void mutate(async () => {
    const room = await api.post<{ id: string }>(`${base}/rooms`, { name, description, member_ids: members.map(person => person.id) });
    setName(''); setDescription(''); setMembers([]); setPage(1); choose(room.id);
  }); };
  const send = (event: FormEvent) => { event.preventDefault(); void mutate(async () => {
    if (pollDraft) { await api.post(`${roomPath}/messages`, { poll: pollPayload(pollDraft), reply_to_id: replyTo?.id }); setPollDraft(null); setReplyTo(null); setMessagePage(1); setQuery(''); setSearchDraft(''); return; }
    if (editing) await api.patch(`${roomPath}/messages/${editing.id}`, { body });
    else await api.post(`${roomPath}/messages`, { body, attachment_ids: attachments.map(file => file.id), reply_to_id: replyTo?.id });
    setAttachments([]); clearDraft(); if (editing && draftBeforeEdit.current) setBody(draftBeforeEdit.current); draftBeforeEdit.current = null; setMessagePage(1); setQuery(''); setSearchDraft('');
  }); };
  const addFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []); event.target.value = '';
    if (uploadingRef.current || pending.current || !files.length) return;
    if (files.length + attachments.length > 5) { setError('Attach up to five files per message.'); return; }
    if (files.some(file => !file.size || file.size > FILE_MAX)) { setError('Each file must be non-empty and no larger than 10 MB.'); return; }
    uploadingRef.current = true; setUploading(true); setError('');
    try {
      for (const file of files) { const form = new FormData(); form.append('file', file); const uploaded = await api.post<Attachment>(`${roomPath}/files`, form); setAttachments(old => [...old, uploaded]); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Upload failed.'); }
    finally { uploadingRef.current = false; setUploading(false); }
  };
  const download = (file: Attachment) => void mutate(async () => {
    const { blob } = await api.downloadBlob(`${roomPath}/files/${encodeURIComponent(file.id)}`);
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = file.original_name; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const insertEmoji = (emoji: string) => {
    const field = textarea.current; const start = field?.selectionStart ?? body.length, end = field?.selectionEnd ?? body.length;
    const next = body.slice(0, start) + emoji + body.slice(end);
    if (next.length > 5000) { setError('Messages can be up to 5,000 characters.'); return; }
    setBody(next); lastTyped.current = Date.now(); setEmojiOpen(false);
    window.setTimeout(() => { field?.focus(); field?.setSelectionRange(start + emoji.length, start + emoji.length); }, 0);
  };
  const reaction = (message: Message, emoji: string) => void mutate(async () => {
    await api.put(`${roomPath}/messages/${message.id}/reaction`, { emoji: message.reactions.some(row => row.user_id === userId && row.emoji === emoji) ? null : emoji }); setReacting('');
  });
  const edit = (message: Message) => { if (attachments.length) { setError('Send or remove staged files before editing another message.'); return; } if (!editing) draftBeforeEdit.current = body; setEditing(message); setReplyTo(null); setBody(message.body); textarea.current?.focus(); };
  const memberName = (id: string) => detail?.members.find(person => person.id === id)?.name || 'Former member';
  const locked = busy || uploading;
  const canSend = canPost && !!detail?.can_send;
  const cancelCompose = () => { if (editing) { clearDraft(); setBody(draftBeforeEdit.current || ''); draftBeforeEdit.current = null; } else setReplyTo(null); };
  const errorBox = error && <p className="talk-chat-error" role="alert">{error}<button type="button" className="talk-pill" onClick={() => { setError(''); refresh(); }}>Dismiss</button></p>;

  if (inRoom) return <section className="talk-private-chat is-room">
    {detail?.mission_id && <p className="talk-room-mission"><Link to={`/missions/${encodeURIComponent(detail.mission_id)}`}>Open mission →</Link><span>Membership follows mission assignments.</span></p>}
    <div className="talk-room-workspace" ref={workspace} style={{ height: workspaceHeight ? `${workspaceHeight}px` : undefined, '--room-left': `${leftWidth}px`, '--room-right': `${rightWidth}px` } as CSSProperties}>
      <aside className="talk-room-side is-left" aria-label="Board and pinned links">
        {detail ? <><RoomBoard roomPath={roomPath} tasks={detail.tasks || []} canPost={canPost} onChanged={refresh}/><RoomLinks roomPath={roomPath} links={detail.links || []} canPost={canPost} onChanged={refresh}/></> : <div className="talk-room-panel"><p className="talk-room-empty" role="status">Loading…</p></div>}
      </aside>
      <PaneResizer side="left" width={leftWidth} setWidth={setLeftWidth} otherWidth={rightWidth} container={workspace}/>
      <article className="talk-room-chat" aria-label="Group conversation">
        <header className="talk-room-chat-head">
          <button type="button" className="talk-room-icon-btn" disabled={locked} aria-label="Back to groups" onClick={() => choose('')}><ArrowLeft size={18}/></button>
          <button type="button" className="talk-room-head-info" aria-label="Open group info" aria-expanded={infoOpen} onClick={() => setInfoOpen(!infoOpen)}>
            <RoomAvatar name={detail?.name || '?'}/>
            <span className="talk-room-title"><strong>{detail?.name || 'Loading group…'}</strong>
              <small>{detail?.typing.length ? <span className="is-typing">{detail.typing.map(person => person.name.split(' ')[0]).join(', ')} {detail.typing.length === 1 ? 'is' : 'are'} typing…</span> : detail ? detail.members.map(person => person.id === userId ? 'You' : person.name.split(' ')[0]).join(', ') : ''}</small></span>
          </button>
          <button type="button" className={`talk-room-icon-btn ${searchOpen || query ? 'is-on' : ''}`} aria-label="Search messages" aria-expanded={searchOpen || !!query} onClick={() => setSearchOpen(!searchOpen)}><Search size={17}/></button>
        </header>
        {!!detail?.pinned?.length && (() => {
          const pins = detail.pinned!, pin = pins[pinIndex % pins.length];
          // Tapping the bar jumps to the pinned message and then shows the next pin, like WhatsApp.
          const jump = () => {
            const node = document.getElementById(`room-msg-${pin.id}`);
            if (node) { node.scrollIntoView({ behavior: 'smooth', block: 'center' }); node.classList.add('is-flash'); window.setTimeout(() => node.classList.remove('is-flash'), 1600); }
            setPinIndex(index => (index + 1) % pins.length);
          };
          return <button type="button" className="talk-room-pinned" onClick={jump} aria-label={`Pinned message ${pinIndex % pins.length + 1} of ${pins.length}: ${pin.body}. Show in chat`}>
            {pins.length > 1 && <span className="talk-room-pinned-dots" aria-hidden="true">{pins.map((row, index) => <i key={row.id} className={index === pinIndex % pins.length ? 'is-on' : ''}/>)}</span>}
            <Pin size={14} aria-hidden="true"/>
            <span><strong>{pin.author?.name || 'Former member'}</strong><small>{pin.body || 'Message'}</small></span>
          </button>;
        })()}
        {(searchOpen || query) && <form className="talk-room-search" role="search" onSubmit={e => { e.preventDefault(); setQuery(searchDraft.trim()); setMessagePage(1); setMessages([]); readMessage.current = null; }}>
          <Search size={15} aria-hidden="true"/><label className="sr-only" htmlFor="room-search">Search this group</label>
          <input id="room-search" type="search" autoFocus value={searchDraft} maxLength={100} onChange={e => setSearchDraft(e.target.value)} placeholder="Search messages…"/>
          {query && <span className="talk-room-search-count">{messageTotal} {messageTotal === 1 ? 'match' : 'matches'}</span>}
          {query && <button type="button" className="talk-pill" onClick={() => { setQuery(''); setSearchDraft(''); setMessagePage(1); setSearchOpen(false); }}>Clear</button>}
        </form>}
        {errorBox}
        {!detail ? <p className="talk-room-empty is-center" role="status">Loading group…</p> : <>
          <ol className="talk-chat-messages" ref={messageList}>
            <li className="talk-room-notice"><Lock size={12}/>Messages, files, tasks and links in this group are stored encrypted. Only its members can read them.</li>
            {messagePage * 50 < messageTotal && <li className="talk-room-older"><button type="button" className="talk-pill" onClick={() => { setMessages([]); setMessagePage(messagePage + 1); }}>Load older messages</button></li>}
            {messages.map(message => {
              const own = message.author?.id === userId;
              return <li key={message.id} id={`room-msg-${message.id}`} className={`talk-room-message ${own ? 'is-own' : ''} ${own && message.read_all ? 'is-seen' : ''}`}>
                {!own && <RoomAvatar name={message.author?.name || '?'} size="sm"/>}
                <div className="talk-room-bubble">
                  {!own && <strong className="talk-room-author">{message.author?.name || 'Former member'}</strong>}
                  {message.deleted_at ? <p className="talk-hint">This message was deleted.</p> : <>
                    {message.reply_to && <blockquote className="talk-chat-reply"><strong>{message.reply_to.author?.name || 'Former member'}</strong><p>{message.reply_to.deleted_at ? 'This message was deleted.' : message.reply_to.body || 'Attachment'}</p></blockquote>}
                    {message.body && <p><MessageText text={message.body}/></p>}
                    {(() => { const link = forumLinkIn(message.body); return link && <TopicLinkPreview topicId={link.topic} replyId={link.reply}/>; })()}
                    {message.poll && <PollCard poll={message.poll} busy={locked} canVote={canPost} onVote={option_ids => void mutate(async () => { await api.put(`${roomPath}/messages/${message.id}/poll/vote`, { option_ids }); })}/>}
                    {!!message.attachments.length && <ul className="talk-chat-files">{message.attachments.map(file => <li key={file.id}><button type="button" className="talk-chat-file" disabled={locked} onClick={() => download(file)}><Paperclip size={14}/> {file.original_name} <small>{fileSize(file.byte_size)} · Download</small></button></li>)}</ul>}
                    {!!message.reactions.length && <div className="talk-chat-reactions">{[...new Set(message.reactions.map(row => row.emoji))].map(emoji => <button type="button" className="talk-pill" key={emoji} disabled={locked || !canPost} aria-pressed={message.reactions.some(row => row.user_id === userId && row.emoji === emoji)} title={message.reactions.filter(row => row.emoji === emoji).map(row => memberName(row.user_id)).join(', ')} onClick={() => reaction(message, emoji)}>{emoji} {message.reactions.filter(row => row.emoji === emoji).length}</button>)}</div>}
                  </>}
                  <div className="talk-room-bubble-foot">
                    {!message.deleted_at && canPost && <span className="talk-chat-message-actions">{canSend && <button type="button" disabled={locked} onClick={() => { setReplyTo(message); setEditing(null); textarea.current?.focus(); }}>Reply</button>}<button type="button" disabled={locked} aria-expanded={reacting === message.id} onClick={() => setReacting(reacting === message.id ? '' : message.id)}>React</button>{detail?.my_role === 'ADMIN' && <button type="button" disabled={locked} onClick={() => void mutate(async () => { await api.put(`${roomPath}/messages/${message.id}/pin`, { pinned: !message.pinned_at }); setPinIndex(0); })}>{message.pinned_at ? 'Unpin' : 'Pin'}</button>}{own && canSend && <>{!message.poll && <button type="button" disabled={locked} onClick={() => edit(message)}>Edit</button>}<button type="button" disabled={locked} onClick={() => setDeleting(message.id)}>Delete</button></>}</span>}
                    <time dateTime={message.created_at} title={new Date(message.created_at).toLocaleString()}>{message.edited_at && !message.deleted_at ? 'edited · ' : ''}{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                    {own && !message.deleted_at && <span className={`talk-room-ticks ${message.read_all ? 'is-seen' : ''}`} title={message.read_all ? 'Seen by everyone' : message.read_by.length ? `Seen by ${message.read_by.map(memberName).join(', ')}` : 'Sent'} aria-label={message.read_all ? 'Seen by everyone' : 'Not seen by everyone yet'}>{message.read_by.length ? <CheckCheck size={15}/> : <Check size={15}/>}</span>}
                  </div>
                  {reacting === message.id && <div className="talk-chat-reactions" role="group" aria-label="Choose a reaction">{REACTIONS.map(emoji => <button type="button" key={emoji} className="talk-pill" disabled={locked} aria-label={`React ${emoji}`} onClick={() => reaction(message, emoji)}>{emoji}</button>)}</div>}
                  {deleting === message.id && <div className="talk-chat-delete" role="alert"><span>Delete this message for everyone?</span><button type="button" className="talk-pill" disabled={locked} onClick={() => void mutate(async () => { await api.delete(`${roomPath}/messages/${message.id}`); setDeleting(''); })}>Delete for everyone</button><button type="button" className="talk-pill" onClick={() => setDeleting('')}>Cancel</button></div>}
                </div>
              </li>;
            })}
            {!messageTotal && <li className="talk-room-empty is-center">{query ? 'No matching messages.' : 'No messages yet. Say hello to the group.'}</li>}
            {messagePage > 1 && <li className="talk-room-older"><button type="button" className="talk-pill" onClick={() => { setMessages([]); setMessagePage(messagePage - 1); }}>Back to newer messages</button></li>}
          </ol>
          <p className="talk-chat-typing sr-only" role="status">{detail.typing.length ? `${detail.typing.map(person => person.name).join(', ')} ${detail.typing.length === 1 ? 'is' : 'are'} typing…` : ''}</p>
          {updateOpen && <MissionUpdatePanel roomPath={roomPath} canShare={canSend} onClose={() => setUpdateOpen(false)} onPosted={shared => { setUpdateOpen(false); setNotice(shared ? 'Update posted and shared in this group.' : 'Update posted to your mission.'); window.setTimeout(() => setNotice(''), 4000); if (shared) { setMessagePage(1); refresh(); } }}/>}
          {notice && <p className="talk-update-notice" role="status">{notice}</p>}
          {canSend ? <form onSubmit={send} className="talk-chat-composer">
            {(replyTo || editing) && <div className="talk-chat-reply is-draft"><div><strong>{editing ? 'Editing your message' : `Replying to ${replyTo?.author?.name || 'Former member'}`}</strong><p>{(editing || replyTo)?.body.slice(0, 160) || 'Attachment'}</p></div><button type="button" className="talk-room-icon-btn" aria-label={`Cancel ${editing ? 'edit' : 'reply'}`} onClick={cancelCompose}><X size={16}/></button></div>}
            {!!attachments.length && <ul className="talk-chat-files is-staged" aria-label="Files to send">{attachments.map(file => <li key={file.id}><span><Paperclip size={13}/> {file.original_name} · {fileSize(file.byte_size)}</span><button type="button" className="talk-room-icon-btn" disabled={locked} aria-label={`Remove ${file.original_name}`} onClick={() => void mutate(async () => { await api.delete(`${roomPath}/files/${file.id}`); setAttachments(old => old.filter(item => item.id !== file.id)); })}><X size={14}/></button></li>)}</ul>}
            {pollDraft && <PollEditor idPrefix="room-poll" value={pollDraft} disabled={locked} onChange={setPollDraft} onRemove={() => setPollDraft(null)}/>}
            {emojiOpen && <div className="talk-chat-emoji" role="group" aria-label="Choose an emoji" onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setEmojiOpen(false); textarea.current?.focus(); } }}>{EMOJIS.map(([emoji, label]) => <button type="button" key={label} aria-label={`Insert ${label} emoji`} disabled={locked} onClick={() => insertEmoji(emoji)}>{emoji}</button>)}</div>}
            <div className="talk-room-composer-row">
              <button type="button" className={`talk-room-icon-btn ${emojiOpen ? 'is-on' : ''}`} disabled={locked} aria-label="Add emoji to message" aria-expanded={emojiOpen} onClick={() => setEmojiOpen(!emojiOpen)}><Smile size={19}/></button>
              <button type="button" className="talk-room-icon-btn" disabled={locked || !!editing || !!pollDraft || attachments.length >= 5} aria-label="Attach files (10 MB each, up to 5)" title="10 MB per file · up to 5 files" onClick={() => fileInput.current?.click()}><Paperclip size={18}/></button>
              <button type="button" className={`talk-room-icon-btn ${pollDraft ? 'is-on' : ''}`} disabled={locked || !!editing || attachments.length > 0} aria-label="Create a poll" aria-expanded={!!pollDraft} title="Poll" onClick={() => { setPollDraft(pollDraft ? null : emptyPoll()); setEmojiOpen(false); setUpdateOpen(false); }}><BarChart3 size={18}/></button>
              {isCube && <button type="button" className={`talk-room-icon-btn ${updateOpen ? 'is-on' : ''}`} disabled={locked || !!editing} aria-label="Post a mission update" aria-expanded={updateOpen} title="Mission update" onClick={() => { setUpdateOpen(!updateOpen); setPollDraft(null); setEmojiOpen(false); }}><TrendingUp size={18}/></button>}
              <label className="sr-only" htmlFor="room-message">Message</label>
              {pollDraft ? <p className="talk-poll-ready" role="status">{pollProblem(pollDraft) || 'Poll ready to send'}</p> : <textarea id="room-message" ref={textarea} required={!attachments.length && !editing?.attachments.length} maxLength={5000} rows={1} value={body} disabled={locked} placeholder={uploading ? 'Uploading file…' : 'Write a message…'}
                onChange={e => { setBody(e.target.value); lastTyped.current = Date.now(); }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (body.trim() || attachments.length) void send(e); } }}/>}
              <button className="talk-room-send" disabled={locked || (pollDraft ? !!pollProblem(pollDraft) : (!body.trim() && !attachments.length && !editing?.attachments.length))} aria-label={editing ? 'Save changes' : pollDraft ? 'Send poll' : 'Send message'}>{editing ? <Check size={18}/> : <Send size={17}/>}</button>
            </div>
            {body.length > 4500 && <small className="talk-hint">{body.length}/5000</small>}
            <input ref={fileInput} type="file" multiple hidden aria-label="Attach chat files" onChange={e => void addFiles(e)}/>
          </form> : <p className="talk-room-readonly">{canPost ? 'Only group admins can send messages.' : 'This account has read-only access.'}</p>}
        </>}
      </article>
      <PaneResizer side="right" width={rightWidth} setWidth={setRightWidth} otherWidth={leftWidth} container={workspace}/>
      <aside className="talk-room-side is-right" aria-label={infoOpen ? 'Group info' : 'GitHub activity'}>
        {detail && (infoOpen
          ? <GroupInfo key={detail.id} room={detail} userId={userId} canPost={canPost} onClose={() => setInfoOpen(false)} onChanged={refresh} onLeft={() => choose('')}/>
          : <RoomGithub key={detail.id} roomPath={roomPath} repos={detail.github_repos || (detail.github_repo ? [detail.github_repo] : [])} canPost={canPost} onChanged={refresh}/>)}
      </aside>
    </div>
  </section>;

  return <section className="talk-private-chat">
    <header className="talk-heading"><div><span className="talk-eyebrow"><Lock size={11}/> Encrypted · members only</span><h1 className="talk-title">Groups <ChatUnreadBadge count={unread.total}/></h1><p>Team conversations, tasks, links and GitHub activity in one place.</p></div>
      {!creating && canPost && <button type="button" className="talk-btn is-primary" disabled={locked} onClick={() => { setCreating(true); setMembers([]); setName(''); setDescription(''); setError(''); }}><Plus size={16}/>New group</button>}
    </header>
    {errorBox}
    {creating ? <form className="talk-card talk-form talk-group-create" onSubmit={create}>
      <h2>New group</h2>
      <label>Group name<input required maxLength={80} value={name} disabled={locked} onChange={e => setName(e.target.value)} placeholder="e.g. Team Orion"/></label>
      <label>Description <small>optional</small><textarea maxLength={500} rows={2} value={description} disabled={locked} onChange={e => setDescription(e.target.value)} placeholder="What is this group for?"/></label>
      <h3>Participants <small>{members.length + 1}</small></h3>
      <ul className="talk-group-chips"><li><RoomAvatar name="You" size="sm"/>You · Group admin</li>{members.map(person => <li key={person.id}><RoomAvatar name={person.name} size="sm"/>{personLabel(person)}<button type="button" className="talk-room-icon-btn" aria-label={`Remove ${person.name}`} disabled={locked} onClick={() => setMembers(members.filter(item => item.id !== person.id))}><X size={13}/></button></li>)}</ul>
      <PeoplePicker disabled={locked || members.length >= 99} excluded={[userId, ...members.map(person => person.id)]} onAdd={person => setMembers(old => [...old, person])}/>
      <p className="talk-hint">You become the group admin. Everything in the group is stored encrypted and only its members can read it — portal admins included.</p>
      <div className="talk-form-actions"><button type="button" className="talk-btn is-ghost" onClick={() => setCreating(false)}>Cancel</button><button className="talk-btn is-primary" disabled={locked || !name.trim()}>{busy ? 'Creating…' : 'Create group'}</button></div>
    </form> : <>
      {loading && !rooms.length && <p className="talk-hint" role="status">Loading groups…</p>}
      {!loading && !rooms.length && <div className="talk-card talk-room-empty-state"><p>You are not in any group yet.</p>{canPost && <button type="button" className="talk-btn is-primary" onClick={() => setCreating(true)}><Plus size={16}/>Start a group</button>}</div>}
      {!!rooms.length && <ul className="talk-card talk-room-list">{rooms.map(room => { const count = unread.rooms.find(item => item.id === room.id)?.count || 0; const last = room.last_message; return <li key={room.id}>
        <button type="button" disabled={locked} onClick={() => choose(room.id)}>
          <RoomAvatar name={room.name}/>
          <span className="talk-room-list-main"><strong>{room.name}</strong>
            <small>{last ? `${last.author?.id === userId ? 'You' : last.author?.name.split(' ')[0] || 'Former member'}: ${last.deleted ? 'This message was deleted.' : last.body}` : `${room._count.members} members`}</small></span>
          <span className="talk-room-list-meta"><time>{listTime(last?.created_at || room.updated_at)}</time>{count > 0 ? <ChatUnreadBadge count={count}/> : room.my_role === 'ADMIN' && <small>Admin</small>}</span>
        </button></li>; })}</ul>}
      {(page > 1 || page * 25 < total) && <div className="talk-form-actions"><button type="button" className="talk-btn is-ghost" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page}</span><button type="button" className="talk-btn is-ghost" disabled={page * 25 >= total} onClick={() => setPage(page + 1)}>Next</button></div>}
    </>}
  </section>;
}
