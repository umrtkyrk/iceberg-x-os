import { useEffect, useState, type FormEvent } from 'react';
import { TrendingUp, X } from 'lucide-react';
import { api } from '../../utils/api';
import { AttachmentPicker } from '../../components/Attachments';

/**
 * Posts the same mission progress update as "Post an update" on the dashboard (POST /updates), without
 * leaving the group chat. Optionally drops a short summary into the group so teammates see it too.
 */
interface MissionRow { mission: { id: string; title: string } | null }
const TYPES = [['daily', 'Daily'], ['weekly', 'Weekly'], ['mission_progress', 'Mission progress']] as const;
type UpdateType = typeof TYPES[number][0];

export function MissionUpdatePanel({ roomPath, canShare, onClose, onPosted }: { roomPath: string; canShare: boolean; onClose: () => void; onPosted: (shared: boolean) => void }) {
  const [missions, setMissions] = useState<{ id: string; title: string }[] | null>(null);
  const [missionId, setMissionId] = useState(''), [type, setType] = useState<UpdateType>('daily');
  const [content, setContent] = useState(''), [blockers, setBlockers] = useState('');
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]), [uploading, setUploading] = useState(false);
  const [share, setShare] = useState(canShare), [busy, setBusy] = useState(false), [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    api.get<{ activeMissions?: MissionRow[]; activeMission?: { id: string; title: string } | null }>('/cube/dashboard').then(data => {
      if (!live) return;
      const rows = data.activeMissions?.length ? data.activeMissions.map(row => row.mission).filter((m): m is { id: string; title: string } => !!m) : data.activeMission ? [data.activeMission] : [];
      setMissions(rows); setMissionId(rows[0]?.id || '');
    }).catch(err => { if (live) { setMissions([]); setError(err instanceof Error ? err.message : 'Your missions could not be loaded.'); } });
    return () => { live = false; };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || uploading || !missionId || !content.trim()) return;
    setBusy(true); setError('');
    try {
      await api.post('/updates', { mission_id: missionId, type, content: content.trim(), blockers: blockers.trim() || undefined, attachment_ids: attachmentIds });
      let shared = false;
      if (share) {
        const title = missions?.find(m => m.id === missionId)?.title || 'Mission';
        const label = TYPES.find(([key]) => key === type)?.[1] || '';
        const summary = `📈 ${label} update · ${title}\n\n${content.trim()}${blockers.trim() ? `\n\nBlockers: ${blockers.trim()}` : ''}`;
        try { await api.post(`${roomPath}/messages`, { body: summary.slice(0, 5000) }); shared = true; }
        catch { setError('The update was posted, but it could not be shared in this group.'); setBusy(false); return; }
      }
      onPosted(shared);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The update could not be posted.');
    } finally { setBusy(false); }
  };

  return <form className="talk-poll-editor talk-update-panel" onSubmit={submit}>
    <p className="talk-update-head"><TrendingUp size={15} aria-hidden="true"/>Mission update<button type="button" className="talk-poll-icon" aria-label="Close mission update" onClick={onClose}><X size={15}/></button></p>
    {error && <p className="talk-chat-error" role="alert">{error}</p>}
    {missions === null ? <p className="talk-hint" role="status">Loading your missions…</p>
      : !missions.length ? <p className="talk-hint">You have no active missions to update.</p> : <>
      {missions.length > 1 && <label className="talk-update-field">Mission<select value={missionId} disabled={busy} onChange={e => setMissionId(e.target.value)}>{missions.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}</select></label>}
      {missions.length === 1 && <p className="talk-update-mission">{missions[0].title}</p>}
      <div className="talk-update-types" role="radiogroup" aria-label="Update type">{TYPES.map(([key, label]) => <button type="button" key={key} role="radio" aria-checked={type === key} className={`talk-pill ${type === key ? 'is-on' : ''}`} disabled={busy} onClick={() => setType(key)}>{label}</button>)}</div>
      <label className="sr-only" htmlFor="room-update-content">What did you build or discover?</label>
      <textarea id="room-update-content" required maxLength={4000} rows={3} value={content} disabled={busy} placeholder="What did you build or discover?" onChange={e => setContent(e.target.value)}/>
      <label className="sr-only" htmlFor="room-update-blockers">Blockers</label>
      <input id="room-update-blockers" maxLength={500} value={blockers} disabled={busy} placeholder="Blockers (optional)" onChange={e => setBlockers(e.target.value)}/>
      <AttachmentPicker onChange={setAttachmentIds} onBusyChange={setUploading}/>
      {canShare && <label className="talk-poll-switch"><input type="checkbox" checked={share} disabled={busy} onChange={e => setShare(e.target.checked)}/>Also share in this group</label>}
      <div className="talk-update-actions"><button type="button" className="talk-btn is-ghost" disabled={busy} onClick={onClose}>Cancel</button><button className="talk-btn is-primary" disabled={busy || uploading || !missionId || !content.trim()}>{busy ? 'Posting…' : 'Post update'}</button></div>
    </>}
  </form>;
}
