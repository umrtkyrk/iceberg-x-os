import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import { FORUM_ENABLED } from '../config/features';

export function MissionRoomButton({missionId, canCreate}: {missionId: string; canCreate: boolean}) {
  const [room, setRoom] = useState<{id: string} | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let alive = true; setRoom(null); setError('');
    if (FORUM_ENABLED) api.get(`/missions/${missionId}/forum-room`).then(data => { if(alive) setRoom(data.room); }).catch(e => {if(alive) setError(e.message);});
    return () => {alive = false;};
  }, [missionId]);
  if (!FORUM_ENABLED || (!canCreate && !room)) return null;
  const create = async () => {setBusy(true); setError(''); try {const result = await api.post(`/missions/${missionId}/forum-room`, {}); setRoom(result.room);} catch(e) {setError(e instanceof Error ? e.message : 'Room unavailable.');} finally {setBusy(false);} };
  return <section className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col gap-3">
    <h3 className="font-extrabold text-gray-900">Mission private room</h3>
    <p className="text-sm text-gray-500">Assigned Cubes join automatically. All Admins and Mentors have access. New members can read the conversation history.</p>
    {room ? <Link className="workspace-primary-action" to={`/forum?view=rooms&room=${encodeURIComponent(room.id)}`}>Open mission room →</Link> : <button className="workspace-primary-action" onClick={create} disabled={busy}>{busy ? 'Creating…' : 'Create private room'}</button>}
    {error && <p role="alert" className="text-red-600">{error}</p>}
  </section>;
}
