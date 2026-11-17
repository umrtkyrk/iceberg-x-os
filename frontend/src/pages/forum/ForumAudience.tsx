import { useEffect, useState } from 'react';
import { Globe2, Lock, Users, X } from 'lucide-react';
import { api } from '../../utils/api';
import { PeoplePicker } from './ForumGroupInfo';

/**
 * Who can see a post: everyone, the members of one of your groups, or people you choose.
 * The server enforces the same rule everywhere (feed, search, previews, notifications).
 */
export type Visibility = 'PUBLIC' | 'GROUP' | 'PRIVATE';
export interface AudienceDraft { visibility: Visibility; room_id: string; people: { id: string; name: string }[] }
export interface TopicAudience { room?: { id: string; name: string } | null; people?: { id: string; name: string }[] }

export const publicAudience = (): AudienceDraft => ({ visibility: 'PUBLIC', room_id: '', people: [] });
export const audienceFromTopic = (topic: { visibility?: string; audience?: TopicAudience | null }): AudienceDraft => ({
  visibility: (topic.visibility as Visibility) || 'PUBLIC', room_id: topic.audience?.room?.id || '', people: topic.audience?.people || [],
});
export const audiencePayload = (draft: AudienceDraft) => ({ visibility: draft.visibility,
  ...(draft.visibility === 'GROUP' ? { audience_room_id: draft.room_id } : {}),
  ...(draft.visibility === 'PRIVATE' ? { audience_user_ids: draft.people.map(person => person.id) } : {}) });
export function audienceProblem(draft: AudienceDraft) {
  if (draft.visibility === 'GROUP' && !draft.room_id) return 'Choose a group.';
  if (draft.visibility === 'PRIVATE' && !draft.people.length) return 'Choose at least one person.';
  return '';
}

const OPTIONS: [Visibility, string, typeof Globe2][] = [['PUBLIC', 'Everyone', Globe2], ['GROUP', 'A group', Users], ['PRIVATE', 'Chosen people', Lock]];

export function AudienceFields({ value, onChange, disabled, userId }: { value: AudienceDraft; onChange: (draft: AudienceDraft) => void; disabled?: boolean; userId: string }) {
  const [rooms, setRooms] = useState<{ id: string; name: string }[] | null>(null);
  useEffect(() => {
    if (value.visibility !== 'GROUP' || rooms) return;
    let live = true;
    api.get<{ rooms: { id: string; name: string }[] }>('/forum/chat/rooms?page=1').then(data => { if (live) setRooms(data.rooms); }).catch(() => { if (live) setRooms([]); });
    return () => { live = false; };
  }, [value.visibility, rooms]);
  return <fieldset className="talk-audience" disabled={disabled}>
    <legend>Who can see this post?</legend>
    <div className="talk-audience-options" role="radiogroup" aria-label="Who can see this post">
      {OPTIONS.map(([key, label, Icon]) => <button type="button" role="radio" key={key} aria-checked={value.visibility === key} className={value.visibility === key ? 'is-on' : ''}
        onClick={() => onChange({ ...value, visibility: key })}><Icon size={15}/>{label}</button>)}
    </div>
    {value.visibility === 'GROUP' && (rooms === null ? <p className="talk-hint" role="status">Loading your groups…</p>
      : !rooms.length ? <p className="talk-hint">You are not in any groups yet. Create one under Groups first.</p>
      : <label className="talk-audience-field">Group<select value={value.room_id} onChange={e => onChange({ ...value, room_id: e.target.value })}>
        <option value="">Choose a group…</option>{rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>)}
    {value.visibility === 'PRIVATE' && <>
      {!!value.people.length && <ul className="talk-audience-people">{value.people.map(person => <li key={person.id}>{person.name}
        <button type="button" aria-label={`Remove ${person.name}`} onClick={() => onChange({ ...value, people: value.people.filter(other => other.id !== person.id) })}><X size={12}/></button></li>)}</ul>}
      {value.people.length < 50 && <PeoplePicker disabled={!!disabled} excluded={[userId, ...value.people.map(person => person.id)]} onAdd={person => onChange({ ...value, people: [...value.people, { id: person.id, name: person.name }] })}/>}
    </>}
    <small className="talk-hint">{value.visibility === 'PUBLIC' ? 'Everyone in the portal can see, like and comment.' : value.visibility === 'GROUP' ? 'Only the members of this group (and you) can see it. It cannot be reposted.' : 'Only you and the people you choose can see it. It cannot be reposted.'}</small>
  </fieldset>;
}

/** The small "Group · name" / "Private · 3 people" tag on a post. Public posts show nothing. */
export function AudienceBadge({ visibility, audience }: { visibility?: string; audience?: TopicAudience | null }) {
  if (!visibility || visibility === 'PUBLIC') return null;
  if (visibility === 'GROUP') return <span className="talk-flair is-audience" title="Only members of this group can see this post"><Users size={11}/>{audience?.room?.name || 'Group'}</span>;
  const people = audience?.people || [];
  return <span className="talk-flair is-audience" title={people.length ? `Shared with ${people.map(person => person.name).join(', ')}` : 'Private post'}><Lock size={11}/>Private{people.length ? ` · ${people.length} ${people.length === 1 ? 'person' : 'people'}` : ''}</span>;
}
