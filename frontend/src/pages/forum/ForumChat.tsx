import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '../../utils/api';

interface Person { id: string; name: string; role: string; cube_profile?: { cube_number: string } | null }
interface Room { id: string; name: string; _count: { members: number } }
interface Detail { id: string; name: string; members: Person[] }
interface Message { id: string; body: string; created_at: string; author: Person | null }
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
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0);
  const pending = useRef(false);
  const mode = admin && manage;
  const refresh = () => setRevision(n => n + 1);
  const choose = (id: string) => { setDetail(null); setMessages([]); setBody(''); setSelected(id); setMessagePage(1); setCreating(false); setError(''); };
  useEffect(() => {
    let current = true, running = false;
    setRooms([]); setLoading(true);
    const load = async () => {
      if (running) return; running = true;
      try {
        const data = await api.get(`${base}/${mode ? 'admin/' : ''}rooms?page=${page}`);
        if (current) { setRooms(data.rooms); setTotal(data.total); }
      } catch (err) { if (current) { setRooms([]); setError(err instanceof Error ? err.message : 'Rooms unavailable.'); } }
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
        const data = !mode ? await api.get(`${base}/rooms/${encodeURIComponent(selected)}/messages?page=${messagePage}`) : null;
        if (current) { setDetail(next); setMessages(data?.messages || []); setMessageTotal(data?.total || 0); setError(''); }
      } catch (err) { if (current) { setDetail(null); setMessages([]); setBody(''); setError(err instanceof Error ? err.message : 'Room unavailable.'); } }
      finally { running = false; }
    };
    void load(); const timer = window.setInterval(load, 4000);
    const onFocus = () => { setDetail(null); setMessages([]); void load(); };
    window.addEventListener('focus', onFocus);
    return () => { current = false; window.clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [selected, mode, messagePage, revision, userId]);
  const mutate = async (fn: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await fn(); refresh(); } catch (err) { setError(err instanceof Error ? err.message : 'The change could not be saved.'); }
    finally { pending.current = false; setBusy(false); }
  };
  const create = (event: FormEvent) => { event.preventDefault(); void mutate(async () => {
    const room = await api.post<Room>(`${base}/rooms`, { name, member_ids: members.map(person => person.id) });
    setName(''); setMembers([]); setCreating(false); setManage(false); setPage(1); choose(room.id);
  }); };
  const send = (event: FormEvent) => { event.preventDefault(); void mutate(async () => {
    await api.post(`${base}/rooms/${encodeURIComponent(selected)}/messages`, { body }); setBody(''); setMessagePage(1);
  }); };
  return <section className="talk-private-chat">
    <header className="talk-heading"><div><span className="talk-eyebrow">Members only</span><h1 className="talk-title">Private rooms</h1><p>Only room members can read and send messages.</p></div></header>
    <div className="talk-form-actions">
      <button type="button" className={`talk-btn ${!mode ? 'is-primary' : 'is-ghost'}`} onClick={() => { choose(''); setManage(false); setPage(1); }}>My rooms</button>
      {admin && <><button type="button" className={`talk-btn ${mode ? 'is-primary' : 'is-ghost'}`} onClick={() => { choose(''); setManage(true); setPage(1); }}>Manage rooms</button>
        <button type="button" className="talk-btn is-ghost" onClick={() => { choose(''); setCreating(true); setMembers([]); setName(''); }}>Create room</button></>}
    </div>
    {error && <p className="talk-chat-error" role="alert">{error}<button type="button" className="talk-pill" onClick={refresh}>Retry</button></p>}
    {creating ? <form className="talk-card" onSubmit={create}><h2>Create a private room</h2>
      <label>Room name<input required maxLength={80} value={name} disabled={busy} onChange={e => setName(e.target.value)}/></label>
      <p>You are added automatically. Members can see the room's existing messages.</p>
      <ul>{members.map(person => <li key={person.id}>{personLabel(person)} <button type="button" disabled={busy} onClick={() => setMembers(members.filter(item => item.id !== person.id))}>Remove</button></li>)}</ul>
      <PeoplePicker disabled={busy || members.length >= 99} excluded={[userId, ...members.map(person => person.id)]} onAdd={person => setMembers(old => [...old, person])}/>
      <div className="talk-form-actions"><button className="talk-btn is-primary" disabled={busy || !name.trim()}>{busy ? 'Creating…' : 'Create room'}</button><button type="button" className="talk-btn is-ghost" onClick={() => setCreating(false)}>Cancel</button></div>
    </form> : <div className="talk-chat-layout">
      <aside className="talk-card talk-chat-rooms" aria-label={mode ? 'Manage all rooms' : 'My private rooms'}>
        <h2>{mode ? 'Room management' : 'Your rooms'}</h2>
        {mode && <p className="talk-hint">Management lists room names and members. Messages require membership.</p>}
        {loading && <p role="status">Loading rooms…</p>}
        {!loading && !rooms.length && <p>No rooms here yet.</p>}
        <ul>{rooms.map(room => <li key={room.id}><button type="button" className={selected === room.id ? 'selected' : ''} onClick={() => choose(room.id)}>{room.name}<small>{room._count.members} members</small></button></li>)}</ul>
        <div className="talk-form-actions"><button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><span>{page}</span><button type="button" disabled={page * 25 >= total} onClick={() => setPage(page + 1)}>Next</button></div>
      </aside>
      <article className="talk-card talk-chat-thread" aria-label="Private room">
        {!selected ? <p>Choose a room{admin ? ' or create one for your team' : ' assigned to you by an admin'}.</p> : !detail ? <p role="status">{error ? 'This room is unavailable.' : 'Loading room…'}</p> : <>
          <h2>{detail.name}</h2><details><summary>{detail.members.length} members</summary><ul>{detail.members.map(person => <li key={person.id}>{personLabel(person)}
            {mode && <button type="button" className="talk-pill" disabled={busy} onClick={() => void mutate(async () => { await api.delete(`${base}/rooms/${detail.id}/members/${person.id}`); })}>Remove{person.id === userId ? ' me' : ''}</button>}</li>)}</ul></details>
          {mode ? <><h3>Add members</h3><PeoplePicker disabled={busy || detail.members.length >= 100} excluded={detail.members.map(person => person.id)} onAdd={person => void mutate(async () => { await api.put(`${base}/rooms/${detail.id}/members/${person.id}`, {}); })}/></> : <>
            <p className="talk-hint">Messages refresh every 4 seconds. Adding a member grants access to the existing conversation.</p>
            <div className="talk-form-actions"><button type="button" disabled={messagePage * 50 >= messageTotal} onClick={() => { setMessages([]); setMessagePage(messagePage + 1); }}>Older messages</button><span>Page {messagePage}</span><button type="button" disabled={messagePage === 1} onClick={() => { setMessages([]); setMessagePage(messagePage - 1); }}>Newer messages</button></div>
            <ol className="talk-chat-messages">{messages.map(message => <li key={message.id} className={message.author?.id === userId ? 'is-own' : ''}><div><strong>{message.author?.name || 'Former member'}</strong> <time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString()}</time></div><p>{message.body}</p></li>)}</ol>
            {!messageTotal && <p>No messages yet. Start the conversation.</p>}
            {canPost ? <form onSubmit={send}><label>Message<textarea required maxLength={5000} rows={3} value={body} disabled={busy} onChange={e => setBody(e.target.value)} placeholder="Write to this room…"/></label>
              <div className="talk-form-actions"><small>{body.length}/5000</small><button className="talk-btn is-primary" disabled={busy || !body.trim()}>{busy ? 'Sending…' : 'Send message'}</button></div></form> : <p>This account has read-only access.</p>}
          </>}
        </>}
      </article>
    </div>}
  </section>;
}
