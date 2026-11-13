import { useEffect, useRef, useState, type FormEvent, type ChangeEvent } from 'react';
import { api } from '../../utils/api';
import { EMOJIS } from '../../components/MarkdownEditor';

interface Person { id: string; name: string; role: string; cube_profile?: { cube_number: string } | null }
interface Room { id: string; name: string; _count: { members: number } }
interface Detail { id: string; name: string; members: Person[]; typing: { id: string; name: string }[] }
interface Attachment { id: string; original_name: string; byte_size: number }
interface Message { id: string; body: string; created_at: string; edited_at: string | null; deleted_at: string | null; author: Person | null;
  attachments: Attachment[]; reactions: { user_id: string; emoji: string }[]; read_by: string[]; reply_to: { id: string; body: string; deleted_at: string | null; author: { name: string } | null } | null }
const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const FILE_MAX = 10 * 1024 * 1024;
const fileSize = (bytes: number) => bytes >= 1024 * 1024 ? (bytes / 1024 / 1024).toFixed(1) + ' MB' : Math.ceil(bytes / 1024) + ' KB';
function MessageText({ text }: { text: string }) { return <>{text.split(/(https?:\/\/[^\s<>]+)/gi).map((part, i) => /^https?:\/\//i.test(part) ? <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a> : part)}</>; }
const base = '/forum/chat';
const personLabel = (person: Person) => `${person.name}${person.cube_profile ? ` · #${person.cube_profile.cube_number}` : ''} · ${person.role}`;

function PeoplePicker({ onAdd, disabled, excluded }: { onAdd: (person: Person) => void; disabled: boolean; excluded: string[] }) {
  const [query, setQuery] = useState(''), [page, setPage] = useState(1);
  const [data, setData] = useState<{ people: Person[]; total: number; pageSize: number } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true; setData(null); setError('');
    const timer = window.setTimeout(() => { api.get(`${base}/people?${new URLSearchParams({ ...(query.trim() ? { q: query.trim() } : {}), page: String(page) })}`)
      .then(next => { if (current) setData(next); }).catch(err => { if (current) setError(err.message); }); }, 200);
    return () => { current = false; window.clearTimeout(timer); };
  }, [query, page]);
  return <section className="talk-chat-picker" aria-label="Choose room members">
    <label>Find people<input type="search" placeholder="Search by name" maxLength={80} value={query} onChange={e => { setQuery(e.target.value); setPage(1); }}/></label>
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p role="status">Loading people…</p>}
    {data && <><ul>{data.people.map(person => <li key={person.id}><span>{personLabel(person)}</span>
      <button type="button" className="talk-btn is-ghost" disabled={disabled || excluded.includes(person.id)} onClick={() => onAdd(person)}>{excluded.includes(person.id) ? 'Added' : 'Add'}</button></li>)}</ul>
      {!data.total && <p>No matching people.</p>}
      <div className="talk-form-actions"><button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous people</button><span>Page {page}</span><button type="button" disabled={page * data.pageSize >= data.total} onClick={() => setPage(page + 1)}>Next people</button></div></>}
  </section>;
}

export function ForumChat({ admin, userId, canPost }: { admin: boolean; userId: string; canPost: boolean }) {
  const [manage, setManage] = useState(false), [creating, setCreating] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]), [total, setTotal] = useState(0), [page, setPage] = useState(1);
  const [selected, setSelected] = useState(''), [detail, setDetail] = useState<Detail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]), [messagePage, setMessagePage] = useState(1), [messageTotal, setMessageTotal] = useState(0);
  const [name, setName] = useState(''), [members, setMembers] = useState<Person[]>([]), [body, setBody] = useState('');
  const [query, setQuery] = useState(''), [searchDraft, setSearchDraft] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]), [uploading, setUploading] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null), [editing, setEditing] = useState<Message | null>(null);
  const [reacting, setReacting] = useState(''), [deleting, setDeleting] = useState(''), [emojiOpen, setEmojiOpen] = useState(false);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0);
  const pending = useRef(false), uploadingRef = useRef(false), bodyRef = useRef(''), lastTyped = useRef(0), readMessage = useRef<string | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null), fileInput = useRef<HTMLInputElement>(null), messageList = useRef<HTMLOListElement>(null);
  const draftBeforeEdit = useRef<string | null>(null);
  const pendingFiles = useRef<Attachment[]>([]); pendingFiles.current = attachments; bodyRef.current = body;
  const mode = admin && manage;
  const roomPath = `${base}/rooms/${encodeURIComponent(selected)}`;
  const refresh = () => setRevision(n => n + 1);
  const clearDraft = () => { setBody(''); setReplyTo(null); setEditing(null); setEmojiOpen(false); lastTyped.current = 0; };
  const choose = (id: string) => {
    if (uploadingRef.current) return;
    for (const file of pendingFiles.current) void api.delete(`${base}/rooms/${selected}/files/${file.id}`).catch(() => {});
    setAttachments([]); setDetail(null); setMessages([]); clearDraft(); setSelected(id); setMessagePage(1); setCreating(false); setError('');
    setQuery(''); setSearchDraft(''); setDeleting(''); setReacting(''); readMessage.current = null;
  };
  useEffect(() => {
    let current = true, running = false;
    setRooms([]); setLoading(true);
    const load = async () => {
      if (running) return; running = true;
      try { const data = await api.get(`${base}/${mode ? 'admin/' : ''}rooms?page=${page}`); if (current) { setRooms(data.rooms); setTotal(data.total); } }
      catch (err) { if (current) { setRooms([]); setError(err instanceof Error ? err.message : 'Rooms unavailable.'); } }
      finally { running = false; if (current) setLoading(false); }
    };
    void load(); const timer = window.setInterval(load, 4000);
    return () => { current = false; window.clearInterval(timer); };
  }, [mode, page, revision, userId]);
  useEffect(() => {
    if (!selected) return;
    let current = true, running = false;
    const load = async () => {
      if (running) return; running = true;
      try {
        const next = await api.get<Detail>(`${base}/${mode ? 'admin/' : ''}rooms/${encodeURIComponent(selected)}`);
        const data = !mode ? await api.get(`${roomPath}/messages?${new URLSearchParams({ page: String(messagePage), ...(query ? { q: query } : {}) })}`) : null;
        if (current) {
          const list = messageList.current;
          const atBottom = !list || list.scrollHeight - list.scrollTop - list.clientHeight < 100;
          setDetail(next); setMessages(data?.messages || []); setMessageTotal(data?.total || 0);
          readMessage.current = !query && messagePage === 1 ? data?.messages.at(-1)?.id || null : null;
          if (atBottom && messagePage === 1) window.setTimeout(() => { const node = messageList.current; if (node) node.scrollTop = node.scrollHeight; }, 0);
        }
      } catch (err) { if (current) { setDetail(null); setMessages([]); clearDraft(); setAttachments([]); readMessage.current = null; setError(err instanceof Error ? err.message : 'Room unavailable.'); } }
      finally { running = false; }
    };
    void load(); const timer = window.setInterval(load, 3000);
    const onFocus = () => { setDetail(null); setMessages([]); void load(); };
    window.addEventListener('focus', onFocus);
    return () => { current = false; window.clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [selected, mode, messagePage, revision, userId, query]);
  useEffect(() => {
    if (!selected || mode) return;
    let current = true, running = false;
    const presence = async () => {
      if (running || document.visibilityState !== 'visible' || !document.hasFocus()) return;
      running = true;
      try { await api.put(`${roomPath}/presence`, { typing: canPost && !!bodyRef.current.trim() && Date.now() - lastTyped.current < 3500, read_message_id: readMessage.current }); }
      catch (err) { if (current && (err as { status?: number }).status === 404) { setDetail(null); setMessages([]); clearDraft(); } }
      finally { running = false; }
    };
    const timer = window.setInterval(presence, 2500);
    return () => { current = false; window.clearInterval(timer); };
  }, [selected, mode, userId, canPost]);
  const mutate = async (fn: () => Promise<void>) => {
    if (pending.current || uploadingRef.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await fn(); refresh(); } catch (err) { setError(err instanceof Error ? err.message : 'The change could not be saved.'); }
    finally { pending.current = false; setBusy(false); }
  };
  const create = (event: FormEvent) => { event.preventDefault(); void mutate(async () => {
    const room = await api.post<Room>(`${base}/rooms`, { name, member_ids: members.map(person => person.id) });
    setName(''); setMembers([]); setCreating(false); setManage(false); setPage(1); choose(room.id);
  }); };
  const send = (event: FormEvent) => { event.preventDefault(); void mutate(async () => {
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
  return <section className="talk-private-chat">
    <header className="talk-heading"><div><span className="talk-eyebrow">Members only</span><h1 className="talk-title">Private rooms</h1><p>Team conversations, files and reactions.</p></div></header>
    <div className="talk-form-actions">
      <button type="button" disabled={locked} className={`talk-btn ${!mode ? 'is-primary' : 'is-ghost'}`} onClick={() => { choose(''); setManage(false); setPage(1); }}>My rooms</button>
      {admin && <><button type="button" disabled={locked} className={`talk-btn ${mode ? 'is-primary' : 'is-ghost'}`} onClick={() => { choose(''); setManage(true); setPage(1); }}>Manage rooms</button><button type="button" disabled={locked} className="talk-btn is-ghost" onClick={() => { choose(''); setCreating(true); setMembers([]); setName(''); }}>Create room</button></>}
    </div>
    {error && <p className="talk-chat-error" role="alert">{error}<button type="button" className="talk-pill" onClick={() => { setError(''); refresh(); }}>Retry</button></p>}
    {creating ? <form className="talk-card" onSubmit={create}><h2>Create a private room</h2><label>Room name<input required maxLength={80} value={name} disabled={locked} onChange={e => setName(e.target.value)}/></label><p>You are added automatically. New members can read the existing conversation.</p>
      <ul>{members.map(person => <li key={person.id}>{personLabel(person)} <button type="button" disabled={locked} onClick={() => setMembers(members.filter(item => item.id !== person.id))}>Remove</button></li>)}</ul>
      <PeoplePicker disabled={locked || members.length >= 99} excluded={[userId, ...members.map(person => person.id)]} onAdd={person => setMembers(old => [...old, person])}/>
      <div className="talk-form-actions"><button className="talk-btn is-primary" disabled={locked || !name.trim()}>{busy ? 'Creating…' : 'Create room'}</button><button type="button" className="talk-btn is-ghost" onClick={() => setCreating(false)}>Cancel</button></div>
    </form> : <div className="talk-chat-layout">
      <aside className="talk-card talk-chat-rooms" aria-label={mode ? 'Manage all rooms' : 'My private rooms'}><h2>{mode ? 'Room management' : 'Your rooms'}</h2>
        {mode && <p className="talk-hint">Management shows room names and members, never messages.</p>}{loading && <p role="status">Loading rooms…</p>}{!loading && !rooms.length && <p>No rooms here yet.</p>}
        <ul>{rooms.map(room => <li key={room.id}><button type="button" disabled={locked} className={selected === room.id ? 'selected' : ''} onClick={() => choose(room.id)}>{room.name}<small>{room._count.members} members</small></button></li>)}</ul>
        <div className="talk-form-actions"><button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><span>{page}</span><button type="button" disabled={page * 25 >= total} onClick={() => setPage(page + 1)}>Next</button></div>
      </aside>
      <article className="talk-card talk-chat-thread" aria-label="Private room">
        {!selected ? <p>Choose a room{admin ? ' or create one for your team' : ' assigned to you by an admin'}.</p> : !detail ? <p role="status">{error ? 'This room is unavailable.' : 'Loading room…'}</p> : <>
          <h2>{detail.name}</h2><details><summary>{detail.members.length} members</summary><ul>{detail.members.map(person => <li key={person.id}>{personLabel(person)}{mode && <button type="button" className="talk-pill" disabled={locked} onClick={() => void mutate(async () => { await api.delete(`${base}/rooms/${detail.id}/members/${person.id}`); })}>Remove{person.id === userId ? ' me' : ''}</button>}</li>)}</ul></details>
          {mode ? <><h3>Add members</h3><PeoplePicker disabled={locked || detail.members.length >= 100} excluded={detail.members.map(person => person.id)} onAdd={person => void mutate(async () => { await api.put(`${base}/rooms/${detail.id}/members/${person.id}`, {}); })}/></> : <>
            <form className="talk-chat-search" onSubmit={e => { e.preventDefault(); setQuery(searchDraft.trim()); setMessagePage(1); setMessages([]); readMessage.current = null; }}><label>Search this room<input type="search" value={searchDraft} maxLength={100} onChange={e => setSearchDraft(e.target.value)} placeholder="Search messages…"/></label><button className="talk-btn is-ghost">Search</button>{query && <button type="button" className="talk-btn is-ghost" onClick={() => { setQuery(''); setSearchDraft(''); setMessagePage(1); }}>Clear</button>}</form>
            <div className="talk-form-actions"><button type="button" disabled={messagePage * 50 >= messageTotal} onClick={() => { setMessages([]); setMessagePage(messagePage + 1); }}>Older messages</button><span>{query ? `${messageTotal} matches · ` : ''}Page {messagePage}</span><button type="button" disabled={messagePage === 1} onClick={() => { setMessages([]); setMessagePage(messagePage - 1); }}>Newer messages</button></div>
            <ol className="talk-chat-messages" ref={messageList}>{messages.map(message => <li key={message.id} className={message.author?.id === userId ? 'is-own' : ''}>
              <div className="talk-chat-message-meta"><strong>{message.author?.name || 'Former member'}</strong> <time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString()}</time>{message.edited_at && !message.deleted_at && <small>edited</small>}</div>
              {message.deleted_at ? <p className="talk-hint">This message was deleted.</p> : <>
                {message.reply_to && <blockquote className="talk-chat-reply"><strong>{message.reply_to.author?.name || 'Former member'}</strong><p>{message.reply_to.deleted_at ? 'This message was deleted.' : message.reply_to.body || 'Attachment'}</p></blockquote>}
                {message.body && <p><MessageText text={message.body}/></p>}
                {!!message.attachments.length && <ul className="talk-chat-files">{message.attachments.map(file => <li key={file.id}><button type="button" className="talk-chat-file" disabled={locked} onClick={() => download(file)}>📎 {file.original_name} <small>{fileSize(file.byte_size)} · Download</small></button></li>)}</ul>}
                <div className="talk-chat-reactions">{[...new Set(message.reactions.map(row => row.emoji))].map(emoji => <button type="button" className="talk-pill" key={emoji} disabled={locked || !canPost} aria-pressed={message.reactions.some(row => row.user_id === userId && row.emoji === emoji)} title={message.reactions.filter(row => row.emoji === emoji).map(row => memberName(row.user_id)).join(', ')} onClick={() => reaction(message, emoji)}>{emoji} {message.reactions.filter(row => row.emoji === emoji).length}</button>)}</div>
                {canPost && <div className="talk-chat-message-actions"><button type="button" disabled={locked} onClick={() => { setReplyTo(message); setEditing(null); textarea.current?.focus(); }}>Reply</button><button type="button" disabled={locked} aria-expanded={reacting === message.id} onClick={() => setReacting(reacting === message.id ? '' : message.id)}>React</button>{message.author?.id === userId && <><button type="button" disabled={locked} onClick={() => edit(message)}>Edit</button><button type="button" disabled={locked} onClick={() => setDeleting(message.id)}>Delete</button></>}</div>}
                {reacting === message.id && <div className="talk-chat-reactions" role="group" aria-label="Choose a reaction">{REACTIONS.map(emoji => <button type="button" key={emoji} className="talk-pill" disabled={locked} aria-label={`React ${emoji}`} onClick={() => reaction(message, emoji)}>{emoji}</button>)}</div>}
                {deleting === message.id && <div className="talk-chat-delete" role="alert"><span>Delete this message for everyone?</span><button type="button" className="talk-pill" disabled={locked} onClick={() => void mutate(async () => { await api.delete(`${roomPath}/messages/${message.id}`); setDeleting(''); })}>Delete for everyone</button><button type="button" className="talk-pill" onClick={() => setDeleting('')}>Cancel</button></div>}
                {message.author?.id === userId && <small className={`talk-chat-read ${message.read_by.length ? 'is-read' : ''}`} title={message.read_by.map(memberName).join(', ')}>{message.read_by.length ? `✓✓ Read by ${message.read_by.length}` : '✓ Sent'}</small>}
              </>}
            </li>)}</ol>
            {!messageTotal && <p>{query ? 'No matching messages.' : 'No messages yet. Start the conversation.'}</p>}
            <p className="talk-chat-typing" role="status">{detail.typing.length ? `${detail.typing.map(person => person.name).join(', ')} ${detail.typing.length === 1 ? 'is' : 'are'} typing…` : ''}</p>
            {canPost ? <form onSubmit={send} className="talk-chat-composer">
              {(replyTo || editing) && <div className="talk-chat-reply"><strong>{editing ? 'Editing your message' : `Replying to ${replyTo?.author?.name || 'Former member'}`}</strong><p>{(editing || replyTo)?.body.slice(0, 160) || 'Attachment'}</p><button type="button" className="talk-pill" onClick={() => { if (editing) { clearDraft(); setBody(draftBeforeEdit.current || ''); draftBeforeEdit.current = null; } else setReplyTo(null); }}>Cancel {editing ? 'edit' : 'reply'}</button></div>}
              <label>Message<textarea ref={textarea} required={!attachments.length && !editing?.attachments.length} maxLength={5000} rows={3} value={body} disabled={locked} onChange={e => { setBody(e.target.value); lastTyped.current = Date.now(); }} placeholder="Write to this room…" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (body.trim() || attachments.length) void send(e); } }}/></label>
              {!!attachments.length && <ul className="talk-chat-files" aria-label="Files to send">{attachments.map(file => <li key={file.id}><span>📎 {file.original_name} · {fileSize(file.byte_size)}</span><button type="button" className="talk-pill" disabled={locked} onClick={() => void mutate(async () => { await api.delete(`${roomPath}/files/${file.id}`); setAttachments(old => old.filter(item => item.id !== file.id)); })}>Remove file</button></li>)}</ul>}
              {uploading && <p role="status">Uploading file…</p>}
              <div className="talk-form-actions"><button type="button" className="talk-btn is-ghost" disabled={locked} aria-label="Add emoji to message" aria-expanded={emojiOpen} onClick={() => setEmojiOpen(!emojiOpen)}>😊 Emoji</button><button type="button" className="talk-btn is-ghost" disabled={locked || !!editing || attachments.length >= 5} onClick={() => fileInput.current?.click()}>📎 Attach files</button><small>10 MB per file · up to 5 files</small><button className="talk-btn is-primary" disabled={locked || (!body.trim() && !attachments.length && !editing?.attachments.length)}>{uploading ? 'Uploading…' : busy ? 'Saving…' : editing ? 'Save changes' : 'Send message'}</button></div>
              <input ref={fileInput} type="file" multiple hidden aria-label="Attach chat files" onChange={e => void addFiles(e)}/>
              {emojiOpen && <div className="talk-chat-emoji" role="group" aria-label="Choose an emoji" onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setEmojiOpen(false); textarea.current?.focus(); } }}>{EMOJIS.map(([emoji, label]) => <button type="button" key={label} aria-label={`Insert ${label} emoji`} disabled={locked} onClick={() => insertEmoji(emoji)}>{emoji}</button>)}</div>}
              <small className="talk-hint">{body.length}/5000 · Ctrl+Enter to send · Only members can download attachments.</small>
            </form> : <p>This account has read-only access.</p>}
          </>}
        </>}
      </article>
    </div>}
  </section>;
}
