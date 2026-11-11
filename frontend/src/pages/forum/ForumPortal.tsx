import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { BadgeDisc, RarityPill } from '../../components/BadgeMedal';
import { getAssetUrl } from '../../utils/assets';

export interface ForumBadge { id: string; name: string; icon: string; rarity: string }
export interface Author {
  id: string; name: string; role: string; avatar_url?: string | null;
  cube_id?: string | null; cube_number?: string | null; stage?: string; founding?: boolean;
  badges?: ForumBadge[]; signature?: string;
}
export interface Viewer { author: Author | null; can_post: boolean; earned_badges: ForumBadge[]; badge_ids: string[] }
export interface ForumContext {
  quests: { id: string; title: string; current?: number; completed?: boolean; criteria_value?: number }[];
  missions: { id: string; title: string; status: string }[]; personal_progress: boolean;
}
export interface Category {
  id: string; name: string; description: string; position: number; staff_only: boolean; reply_count?: number;
  _count: { topics: number }; topics: { id: string; title: string; last_activity_at: string }[];
}
const stages: Record<string, { label: string; color: string }> = {
  cube: { label: 'Cube', color: '#2563eb' }, candidate: { label: 'Senior Cube Candidate', color: '#0e7490' },
  senior: { label: 'Senior Cube', color: '#7c3aed' }, iceberger: { label: 'Iceberger', color: '#a16207' },
  mentor: { label: 'Mentor', color: '#047857' }, admin: { label: 'Admin', color: '#be185d' },
  alumni: { label: 'Alumni', color: '#475569' }, former: { label: 'Former Cube', color: '#6b7280' },
};
export function authorStyle(author: Author | null): CSSProperties {
  return { '--author-color': stages[author?.stage || '']?.color || '#64748b' } as CSSProperties;
}
export function StageTag({ author }: { author: Author | null }) {
  return <span className="forum-stage" style={authorStyle(author)}>{stages[author?.stage || '']?.label || (author?.role === 'ADMIN' ? 'Admin' : author?.role === 'MENTOR' ? 'Mentor' : 'Cube')}</span>;
}
export function PortalAvatar({ author, size = 32 }: { author: Author | null; size?: number }) {
  const avatar = getAssetUrl(author?.avatar_url);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [avatar]);
  return <span className="forum-avatar" style={{ ...authorStyle(author), width: size, height: size }} aria-hidden="true">{avatar && !failed ? <img src={avatar} alt="" onError={() => setFailed(true)}/> : <span>{(author?.name || 'Cube').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}</span>}</span>;
}
export function AuthorIdentity({ author, compact = false }: { author: Author | null; compact?: boolean }) {
  const identity = <><PortalAvatar author={author}/><strong>{author?.name || 'Unknown Cube'}</strong></>;
  return <div className={`forum-author-card ${compact ? 'is-compact' : ''}`} style={authorStyle(author)}>
    {author?.cube_id ? <Link className="forum-author-link" to={`/x/${author.cube_number || author.cube_id}`}>{identity}</Link> : <span className="forum-author-link">{identity}</span>}
    {author?.cube_number && <small>#{author.cube_number}</small>}<StageTag author={author}/>
    {author?.founding && <span className="forum-founding">♛ Founding Cube</span>}
    {!compact && <div className="forum-showcase">{author?.badges?.slice(0, 3).map(b => <span key={b.id} title={`${b.name} · ${b.rarity}`} aria-label={`${b.name} · ${b.rarity}`}><BadgeDisc icon={b.icon} rarity={b.rarity} size="sm"/></span>)}</div>}
  </div>;
}

/**
 * A post signature. Admin and Mentor signatures get the Legendary gold
 * treatment so the programme team is recognisable at a glance.
 */
export function ForumSignature({ author }: { author: Author | null }) {
  if (!author?.signature) return null;
  const { signature } = author;
  const staffRole = author.role === 'ADMIN' ? 'Admin' : author.role === 'MENTOR' ? 'Mentor' : null;
  if (!staffRole) return <p className="forum-signature">{signature}</p>;
  return (
    <div className="forum-signature-legendary" aria-label={`${staffRole} signature`}>
      <span className="forum-signature-crest" aria-hidden="true">✦ {staffRole}</span>
      <p className="forum-signature-text">{signature}</p>
    </div>
  );
}

export function ForumPreferences({ viewer, onSave, busy, onCancel }: { viewer: Viewer; onSave: (value: { badge_ids: string[]; signature: string }) => void; busy: boolean; onCancel: () => void }) {
  const [selected, setSelected] = useState(viewer.badge_ids);
  const [signature, setSignature] = useState(viewer.author?.signature || '');
  const move = (index: number, delta: number) => setSelected(ids => { const next = [...ids]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; return next; });
  return <form className="talk-card talk-form forum-preferences" onSubmit={e => { e.preventDefault(); onSave({ badge_ids: selected, signature }); }}>
    <h2>Your forum profile</h2><p className="talk-hint">Choose up to three earned badges and arrange their display order. Your name and progression stay connected to the portal.</p>
    {viewer.author && <div className="forum-profile-preview"><span className="talk-eyebrow">How you appear in discussions</span><AuthorIdentity author={{ ...viewer.author, badges: selected.flatMap(id => { const badge = viewer.earned_badges.find(b => b.id === id); return badge ? [badge] : []; }) }}/><p className="forum-signature">{signature || 'Your signature will appear here.'}</p></div>}
    <fieldset disabled={busy}><div className="forum-badge-picker">{viewer.earned_badges.map(b => <button type="button" key={b.id} aria-pressed={selected.includes(b.id)} disabled={!selected.includes(b.id) && selected.length === 3} onClick={() => setSelected(ids => ids.includes(b.id) ? ids.filter(id => id !== b.id) : [...ids, b.id])}><BadgeDisc icon={b.icon} rarity={b.rarity} size="sm"/><span>{b.name}<RarityPill rarity={b.rarity}/></span><b>{selected.includes(b.id) ? selected.indexOf(b.id) + 1 : '+'}</b></button>)}</div>
    {!viewer.earned_badges.length && <p className="talk-hint">No earned badges yet. <Link to="/badges">Explore portal badges</Link>.</p>}
    <ol className="forum-badge-order">{selected.map((id, index) => <li key={id}><span>{index + 1}. {viewer.earned_badges.find(b => b.id === id)?.name}</span><button type="button" aria-label="Move badge earlier" disabled={!index} onClick={() => move(index, -1)}>↑</button><button type="button" aria-label="Move badge later" disabled={index === selected.length - 1} onClick={() => move(index, 1)}>↓</button></li>)}</ol>
    <label>Signature<textarea maxLength={140} rows={3} value={signature} onChange={e => setSignature(e.target.value)} placeholder="A short note below your posts…"/></label><small>{signature.length}/140 · Plain text</small>
    <div className="talk-form-actions"><button type="button" className="talk-btn is-ghost" onClick={onCancel}>Cancel</button><button className="talk-btn is-primary">{busy ? 'Saving…' : 'Save preferences'}</button></div></fieldset>
  </form>;
}

export function ContextFields({ context, quest, mission, onChange }: { context: ForumContext | null; quest: string; mission: string; onChange: (quest: string, mission: string) => void }) {
  if (!context) return <p className="talk-hint">Quest and mission options could not be loaded. You can still post without a link.</p>;
  return <div className="forum-context-fields"><label>Related quest <select value={quest} onChange={e => onChange(e.target.value, mission)}><option value="">No link</option>{quest && !context.quests.some(q => q.id === quest) && <option value={quest}>Linked quest</option>}{context.quests.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}</select></label><label>Related mission <select value={mission} onChange={e => onChange(quest, e.target.value)}><option value="">No link</option>{mission && !context.missions.some(m => m.id === mission) && <option value={mission}>Linked mission</option>}{context.missions.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}</select></label><p className="talk-hint">Links provide context; they do not advance quests or grant rewards.</p></div>;
}

export function CategoryManager({ categories, busy, onSave, onRemove }: { categories: Category[]; busy: boolean; onSave: (category: Omit<Category, '_count' | 'topics'>, existing: boolean) => void; onRemove: (id: string) => void }) {
  const blank = { id: '', name: '', description: '', position: categories.length + 1, staff_only: false };
  const [draft, setDraft] = useState(blank);
  const [existing, setExisting] = useState(false);
  const [remove, setRemove] = useState<string | null>(null);
  // Reset the form only when the saved communities actually change (e.g. after a successful save),
  // not on every refetch, which hands us a new array with the same data and would wipe an unsaved edit.
  const savedSignature = categories.map(c => [c.id, c.name, c.description, c.position, c.staff_only].join('\u0001')).join('\u0002');
  useEffect(() => { setDraft({ id: '', name: '', description: '', position: categories.length + 1, staff_only: false }); setExisting(false); }, [savedSignature]); // eslint-disable-line react-hooks/exhaustive-deps
  return <section><h3>Manage communities</h3><p className="talk-hint">Community codes stay fixed. Edit names, descriptions, order and posting permissions. Communities with topic history cannot be deleted.</p>
    <div className="forum-category-admin">{categories.map(c => <div key={c.id}><span>{c.position}. {c.name}<small>{c._count?.topics || 0} topics · {c.staff_only ? 'Mentor/Admin' : 'All Cubes'}</small></span><button type="button" className="talk-pill" disabled={busy} onClick={() => { setDraft(c); setExisting(true); }}>Edit</button><button type="button" className="talk-pill" disabled={busy || c.id === 'announcements' || (c._count?.topics || 0) > 0} title={(c._count?.topics || 0) > 0 ? 'Move topics first before removing this community' : undefined} onClick={() => setRemove(c.id)}>Remove</button></div>)}</div>
    {remove && <div className="talk-card talk-danger" role="alert"><p>Remove this empty community?</p><div className="talk-form-actions"><button type="button" className="talk-btn is-ghost" disabled={busy} onClick={() => setRemove(null)}>Cancel</button><button type="button" className="talk-btn is-danger" disabled={busy} onClick={() => { onRemove(remove); setRemove(null); }}>Remove</button></div></div>}
    <form className="talk-card talk-form" onSubmit={e => { e.preventDefault(); onSave(draft, existing); }}><h3>{existing ? 'Edit community' : 'New community'}</h3><fieldset disabled={busy}>
      <label>Community code<input required pattern="[a-z][a-z0-9-]+" minLength={2} maxLength={60} disabled={existing} value={draft.id} onChange={e => setDraft({ ...draft, id: e.target.value })}/></label>
      <label>Name<input required minLength={2} maxLength={80} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}/></label>
      <label>Description<textarea required maxLength={300} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })}/></label>
      <label>Position<input type="number" min={0} max={999} required value={draft.position} onChange={e => setDraft({ ...draft, position: Number(e.target.value) })}/></label>
      <label className="forum-check"><input type="checkbox" checked={draft.id === 'announcements' || draft.staff_only} disabled={draft.id === 'announcements'} onChange={e => setDraft({ ...draft, staff_only: e.target.checked })}/>Only Mentors/Admins can create topics</label>
      <div className="talk-form-actions"><button type="button" className="talk-btn is-ghost" onClick={() => { setDraft(blank); setExisting(false); }}>Create another community</button><button className="talk-btn is-primary">{busy ? 'Saving…' : 'Save'}</button></div>
    </fieldset></form>
  </section>;
}
