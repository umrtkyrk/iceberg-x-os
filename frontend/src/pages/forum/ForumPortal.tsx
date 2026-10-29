import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { BadgeDisc, RarityPill } from '../../components/BadgeMedal';
import { api } from '../../utils/api';
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
export function AuthorIdentity({ author }: { author: Author | null }) {
  const avatar = getAssetUrl(author?.avatar_url);
  const identity = <><span className="forum-avatar" style={authorStyle(author)}>{avatar ? <img src={avatar} alt="" onError={e => { e.currentTarget.hidden = true; }}/>: null}<span>{(author?.name || 'Cube').split(' ').map(p => p[0]).slice(0, 2).join('')}</span></span><strong>{author?.name || 'Bilinmeyen Cube'}</strong></>;
  return <div className="forum-author-card" style={authorStyle(author)}>
    {author?.cube_id ? <Link className="forum-author-link" to={`/x/${author.cube_number || author.cube_id}`}>{identity}</Link> : <div className="forum-author-link">{identity}</div>}
    {author?.cube_number && <small>Cube #{author.cube_number}</small>}<StageTag author={author}/>
    {author?.founding && <span className="forum-founding">♛ Founding Cube</span>}
    <div className="forum-showcase">{author?.badges?.slice(0, 3).map(b => <span key={b.id} title={`${b.name} · ${b.rarity}`} aria-label={`${b.name} · ${b.rarity}`}><BadgeDisc icon={b.icon} rarity={b.rarity} size="sm"/></span>)}</div>
  </div>;
}

export function ForumPreferences({ viewer, onSave, busy, onCancel }: { viewer: Viewer; onSave: (value: { badge_ids: string[]; signature: string }) => void; busy: boolean; onCancel: () => void }) {
  const [selected, setSelected] = useState(viewer.badge_ids);
  const [signature, setSignature] = useState(viewer.author?.signature || '');
  const move = (index: number, delta: number) => setSelected(ids => { const next = [...ids]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; return next; });
  return <form className="live-editor forum-preferences" onSubmit={e => { e.preventDefault(); onSave({ badge_ids: selected, signature }); }}>
    <h3>Forum kimliğin</h3><p className="live-hint">Kademen ve kimliğin portalından gelir. Kazandığın rozetlerden en fazla üçünü seç ve görünme sırasını düzenle.</p>
    <fieldset disabled={busy}><div className="forum-badge-picker">{viewer.earned_badges.map(b => <button type="button" key={b.id} aria-pressed={selected.includes(b.id)} disabled={!selected.includes(b.id) && selected.length === 3} onClick={() => setSelected(ids => ids.includes(b.id) ? ids.filter(id => id !== b.id) : [...ids, b.id])}><BadgeDisc icon={b.icon} rarity={b.rarity} size="sm"/><span>{b.name}<RarityPill rarity={b.rarity}/></span><b>{selected.includes(b.id) ? selected.indexOf(b.id) + 1 : '+'}</b></button>)}</div>
    {!viewer.earned_badges.length && <p className="live-hint">Henüz kazanılmış rozetin yok. Rozetlerini <Link to="/badges">portalda keşfet</Link>.</p>}
    <ol className="forum-badge-order">{selected.map((id, index) => <li key={id}><span>{index + 1}. {viewer.earned_badges.find(b => b.id === id)?.name}</span><button type="button" aria-label="Rozeti öne taşı" disabled={!index} onClick={() => move(index, -1)}>↑</button><button type="button" aria-label="Rozeti arkaya taşı" disabled={index === selected.length - 1} onClick={() => move(index, 1)}>↓</button></li>)}</ol>
    <label>İmzan<textarea maxLength={140} rows={3} value={signature} onChange={e => setSignature(e.target.value)} placeholder="Mesajlarının altında görünecek kısa bir not…"/></label><small>{signature.length}/140 · Düz metin</small>
    <div className="live-actions"><button type="button" onClick={onCancel}>Vazgeç</button><button className="button button-dark">{busy ? 'Kaydediliyor…' : 'Tercihlerimi kaydet'}</button></div></fieldset>
  </form>;
}

export function ContextFields({ context, quest, mission, onChange }: { context: ForumContext | null; quest: string; mission: string; onChange: (quest: string, mission: string) => void }) {
  if (!context) return <p className="live-hint">Quest ve mission seçenekleri yüklenemedi. Konuyu bağlantı eklemeden paylaşabilirsin.</p>;
  return <div className="forum-context-fields"><label>İlgili quest <select value={quest} onChange={e => onChange(e.target.value, mission)}><option value="">Bağlantı ekleme</option>{context.quests.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}</select></label><label>İlgili mission <select value={mission} onChange={e => onChange(quest, e.target.value)}><option value="">Bağlantı ekleme</option>{context.missions.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}</select></label><p className="live-hint">Etiketler konuşmayı bağlar; quest ilerlemesi veya ödül oluşturmaz.</p></div>;
}

export function MentionPicker({ onPick }: { onPick: (token: string) => void }) {
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<{ id: string; name: string; handle: string }[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      if (query.trim().length < 2) { setPeople([]); return; }
      void api.get<typeof people>(`/forum/mentions?q=${encodeURIComponent(query.trim())}`).then(rows => { if (current) { setPeople(rows); setError(false); } }).catch(() => { if (current) setError(true); });
    }, 250);
    return () => { current = false; clearTimeout(timer); };
  }, [query]);
  return <details className="forum-mentions"><summary>@ Bir Cube’dan veya ekip üyesinden bahset</summary><label>Kişi ara<input value={query} onChange={e => setQuery(e.target.value)} maxLength={80} placeholder="En az iki harf yaz"/></label>{error && <p role="status">Kişiler şu anda yüklenemedi.</p>}<div>{people.map(person => <button type="button" key={person.id} onClick={() => { onPick(`@${person.handle} `); setQuery(''); }}>{person.name} <small>@{person.handle}</small></button>)}</div><small>Bir mesajda en fazla 10 farklı mention bildirim alır. Kod ve alıntılardaki mentionlar bildirim göndermez.</small></details>;
}

export function CategoryManager({ categories, busy, onSave, onRemove }: { categories: Category[]; busy: boolean; onSave: (category: Omit<Category, '_count' | 'topics'>, existing: boolean) => void; onRemove: (id: string) => void }) {
  const blank = { id: '', name: '', description: '', position: categories.length + 1, staff_only: false };
  const [draft, setDraft] = useState(blank);
  const [existing, setExisting] = useState(false);
  const [remove, setRemove] = useState<string | null>(null);
  return <section><h3>Kategorileri yönet</h3><p className="live-hint">Kodu sabit kalır; ad, açıklama, sıra ve konu açma izinleri değiştirilebilir. Geçmişi olan kategori silinmez.</p>
    <div className="forum-category-admin">{categories.map(c => <div key={c.id}><span>{c.position}. {c.name}<small>{c._count?.topics || 0} konu · {c.staff_only ? 'Mentor/Admin' : 'Tüm Cubelar'}</small></span><button disabled={busy} onClick={() => { setDraft(c); setExisting(true); }}>Düzenle</button><button disabled={busy || c.id === 'announcements'} onClick={() => setRemove(c.id)}>Kaldır</button></div>)}</div>
    {remove && <p className="live-error">Bu boş kategoriyi kaldırmak istiyor musun? <button disabled={busy} onClick={() => { onRemove(remove); setRemove(null); }}>Kaldır</button><button onClick={() => setRemove(null)}>Vazgeç</button></p>}
    <form className="live-editor" onSubmit={e => { e.preventDefault(); onSave(draft, existing); }}><h3>{existing ? 'Kategoriyi düzenle' : 'Yeni kategori'}</h3><fieldset disabled={busy}>
      <label>Kategori kodu<input required pattern="[a-z][a-z0-9-]+" minLength={2} maxLength={60} disabled={existing} value={draft.id} onChange={e => setDraft({ ...draft, id: e.target.value })}/></label>
      <label>Ad<input required minLength={2} maxLength={80} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}/></label>
      <label>Açıklama<textarea required maxLength={300} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })}/></label>
      <label>Sıra<input type="number" min={0} max={999} required value={draft.position} onChange={e => setDraft({ ...draft, position: Number(e.target.value) })}/></label>
      <label className="forum-check"><input type="checkbox" checked={draft.id === 'announcements' || draft.staff_only} disabled={draft.id === 'announcements'} onChange={e => setDraft({ ...draft, staff_only: e.target.checked })}/>Yalnızca Mentor/Admin konu açabilir</label>
      <div className="live-actions"><button className="button button-dark">Kaydet</button><button type="button" onClick={() => { setDraft(blank); setExisting(false); }}>Yeni kategoriye geç</button></div>
    </fieldset></form>
  </section>;
}
