import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LogOut, Pencil, Search, ShieldCheck, ShieldOff, Trash2, UserMinus, UserPlus, X } from 'lucide-react';
import { api } from '../../utils/api';

export interface Person { id: string; name: string; role: string; cube_profile?: { cube_number: string } | null }
export interface GroupMember extends Person { group_role: 'ADMIN' | 'MEMBER'; joined_at: string }
export interface GroupDetail {
  mission_id?: string | null; id: string; name: string; description: string; created_at: string; my_role: 'ADMIN' | 'MEMBER';
  can_edit_info: boolean; can_send: boolean; only_admins_edit: boolean; only_admins_send: boolean; members: GroupMember[];
}
const base = '/forum/chat';
const errorText = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;
export const personLabel = (person: Person) => `${person.name}${person.cube_profile ? ` · #${person.cube_profile.cube_number}` : ''}`;

/** A room or person initial on a coloured circle, picked from the name so it stays stable. */
const AVATAR_COLORS = ['#e6007e', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#f97316', '#6366f1'];
export function RoomAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const color = AVATAR_COLORS[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_COLORS.length];
  return <span className={`talk-room-avatar is-${size}`} style={{ background: color }} aria-hidden="true">{name.trim().charAt(0).toUpperCase() || '?'}</span>;
}

/** Searchable list of portal people; already chosen people are marked and cannot be added twice. */
export function PeoplePicker({ onAdd, disabled, excluded }: { onAdd: (person: Person) => void; disabled: boolean; excluded: string[] }) {
  const [query, setQuery] = useState(''), [page, setPage] = useState(1);
  const [data, setData] = useState<{ people: Person[]; total: number; pageSize: number } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true; setData(null); setError('');
    const timer = window.setTimeout(() => { api.get(`${base}/people?${new URLSearchParams({ ...(query.trim() ? { q: query.trim() } : {}), page: String(page) })}`)
      .then(next => { if (current) setData(next); }).catch(err => { if (current) setError(errorText(err, 'People could not be loaded.')); }); }, 200);
    return () => { current = false; window.clearTimeout(timer); };
  }, [query, page]);
  return <section className="talk-people-picker" aria-label="Choose people">
    <label className="talk-room-search-field"><Search size={15} aria-hidden="true"/><span className="sr-only">Search people</span><input type="search" placeholder="Search name" maxLength={80} value={query} onChange={e => { setQuery(e.target.value); setPage(1); }}/></label>
    {error && <p className="talk-room-error" role="alert">{error}</p>}
    {!data && !error && <p className="talk-room-empty" role="status">Loading people…</p>}
    {data && <><ul>{data.people.map(person => { const added = excluded.includes(person.id); return <li key={person.id}>
      <RoomAvatar name={person.name} size="sm"/><span>{personLabel(person)}<small>{person.role.charAt(0) + person.role.slice(1).toLowerCase()}</small></span>
      <button type="button" className="talk-pill" disabled={disabled || added} onClick={() => onAdd(person)}>{added ? 'Added' : 'Add'}</button></li>; })}</ul>
      {!data.total && <p className="talk-room-empty">No matching people.</p>}
      {data.total > data.pageSize && <div className="talk-form-actions"><button type="button" className="talk-pill" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page}</span><button type="button" className="talk-pill" disabled={page * data.pageSize >= data.total} onClick={() => setPage(page + 1)}>Next</button></div>}</>}
  </section>;
}

/** WhatsApp-style group info: name and description, group settings, participants, exit and delete. */
export function GroupInfo({ room, userId, canPost, onClose, onChanged, onLeft }: { room: GroupDetail; userId: string; canPost: boolean; onClose: () => void; onChanged: () => void; onLeft: () => void }) {
  const admin = !room.mission_id && room.my_role === 'ADMIN';
  const roomPath = `${base}/rooms/${encodeURIComponent(room.id)}`;
  const [editing, setEditing] = useState(false), [name, setName] = useState(room.name), [description, setDescription] = useState(room.description);
  const [adding, setAdding] = useState(false), [menu, setMenu] = useState(''), [confirm, setConfirm] = useState<'' | 'leave' | 'delete'>('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(false);
  const run = async (fn: () => Promise<unknown>, after?: () => void) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await fn(); after?.(); onChanged(); } catch (err) { setError(errorText(err, 'The change could not be saved.')); }
    finally { pending.current = false; setBusy(false); }
  };
  const save = (event: FormEvent) => { event.preventDefault(); void run(() => api.patch(roomPath, { name, description }), () => setEditing(false)); };
  const setting = (key: 'only_admins_edit' | 'only_admins_send', value: boolean) => void run(() => api.patch(roomPath, { [key]: value }));
  const admins = room.members.filter(member => member.group_role === 'ADMIN').length;
  return <section className="talk-room-panel talk-group-info" aria-label="Group info">
    <header><h3>Group info</h3><button type="button" className="talk-room-icon-btn" aria-label="Close group info" onClick={onClose}><X size={16}/></button></header>
    <div className="talk-group-hero">
      <RoomAvatar name={room.name} size="lg"/>
      {editing ? <form className="talk-group-edit" onSubmit={save}>
        <label>Group name<input required maxLength={80} value={name} disabled={busy} onChange={e => setName(e.target.value)}/></label>
        <label>Description<textarea maxLength={500} rows={3} value={description} disabled={busy} onChange={e => setDescription(e.target.value)} placeholder="What is this group for?"/></label>
        <div className="talk-form-actions"><button type="button" className="talk-btn is-ghost" disabled={busy} onClick={() => { setEditing(false); setName(room.name); setDescription(room.description); }}>Cancel</button><button className="talk-btn is-primary" disabled={busy || !name.trim()}>Save</button></div>
      </form> : <>
        <h4>{room.name}{room.can_edit_info && canPost && <button type="button" className="talk-room-icon-btn" aria-label="Edit group name and description" onClick={() => { setName(room.name); setDescription(room.description); setEditing(true); }}><Pencil size={14}/></button>}</h4>
        <p className="talk-room-empty">Group · {room.members.length} {room.members.length === 1 ? 'member' : 'members'}</p>
        {room.description ? <p className="talk-group-description">{room.description}</p> : room.can_edit_info && canPost && <button type="button" className="talk-pill" onClick={() => setEditing(true)}>Add group description</button>}
      </>}
    </div>

    {admin && canPost && <div className="talk-group-block">
      <h4>Group settings</h4>
      <label className="talk-switch"><span>Only admins can edit group info<small>Name and description</small></span><input type="checkbox" role="switch" checked={room.only_admins_edit} disabled={busy} onChange={e => setting('only_admins_edit', e.target.checked)}/></label>
      <label className="talk-switch"><span>Only admins can send messages<small>Others can still read and react</small></span><input type="checkbox" role="switch" checked={room.only_admins_send} disabled={busy} onChange={e => setting('only_admins_send', e.target.checked)}/></label>
    </div>}

    <div className="talk-group-block">
      <h4>{room.members.length} participants</h4>
      {admin && canPost && <button type="button" className="talk-group-row is-action" aria-expanded={adding} onClick={() => setAdding(!adding)}><span className="talk-group-icon"><UserPlus size={17}/></span>{adding ? 'Done adding' : 'Add participants'}</button>}
      {adding && <PeoplePicker disabled={busy} excluded={room.members.map(member => member.id)} onAdd={person => void run(() => api.post(`${roomPath}/members`, { user_ids: [person.id] }))}/>}
      <ul className="talk-group-members">{room.members.map(member => {
        const self = member.id === userId;
        return <li key={member.id}>
          <div className="talk-group-row">
            <RoomAvatar name={member.name} size="sm"/>
            <span>{self ? 'You' : member.name}<small>{member.cube_profile ? `Cube #${member.cube_profile.cube_number}` : member.role.charAt(0) + member.role.slice(1).toLowerCase()}</small></span>
            {member.group_role === 'ADMIN' && <span className="talk-group-badge">Group admin</span>}
            {admin && canPost && <div className="talk-group-member-actions">
              {!self && <button type="button" className="talk-room-icon-btn" aria-label={`Options for ${member.name}`} aria-expanded={menu === member.id} onClick={() => setMenu(menu === member.id ? '' : member.id)}>⋯</button>}
            </div>}
          </div>
          {menu === member.id && <div className="talk-group-menu">
            {member.group_role === 'ADMIN'
              ? <button type="button" disabled={busy} onClick={() => void run(() => api.patch(`${roomPath}/members/${member.id}`, { role: 'MEMBER' }), () => setMenu(''))}><ShieldOff size={14}/>Dismiss as admin</button>
              : <button type="button" disabled={busy} onClick={() => void run(() => api.patch(`${roomPath}/members/${member.id}`, { role: 'ADMIN' }), () => setMenu(''))}><ShieldCheck size={14}/>Make group admin</button>}
            <button type="button" className="is-danger" disabled={busy} onClick={() => void run(() => api.delete(`${roomPath}/members/${member.id}`), () => setMenu(''))}><UserMinus size={14}/>Remove {member.name.split(' ')[0]}</button>
          </div>}
        </li>;
      })}</ul>
    </div>

    <div className="talk-group-block">
      {!room.mission_id && <button type="button" className="talk-group-row is-danger" disabled={busy} onClick={() => setConfirm('leave')}><span className="talk-group-icon"><LogOut size={17}/></span>Exit group</button>}
      {room.mission_id && <p className="talk-room-empty">Participants and the room name are managed from the mission.</p>}
      {admin && canPost && <button type="button" className="talk-group-row is-danger" disabled={busy} onClick={() => setConfirm('delete')}><span className="talk-group-icon"><Trash2 size={17}/></span>Delete group</button>}
      {confirm && <div className="talk-chat-delete" role="alert">
        <span>{confirm === 'leave' ? (room.members.length === 1 ? 'You are the last member, so leaving deletes the group and its messages.' : `Exit “${room.name}”?${admin && admins === 1 ? ' Another member will become group admin.' : ''}`) : `Delete “${room.name}” and all of its messages, files, tasks and links for everyone? This cannot be undone.`}</span>
        <button type="button" className="talk-pill is-danger" disabled={busy} onClick={() => void run(() => confirm === 'leave' ? api.delete(`${roomPath}/members/${userId}`) : api.delete(roomPath), onLeft)}>{confirm === 'leave' ? 'Exit group' : 'Delete group'}</button>
        <button type="button" className="talk-pill" onClick={() => setConfirm('')}>Cancel</button>
      </div>}
    </div>
    {error && <p className="talk-room-error" role="alert">{error}</p>}
  </section>;
}
