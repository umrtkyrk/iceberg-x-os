import { useState } from 'react';
import { BarChart3, Check, X } from 'lucide-react';

/** WhatsApp-style polls, shared by forum posts and group chat. */
export const POLL_MAX_OPTIONS = 12;
export interface PollVoter { id: string; name: string; avatar_url?: string | null }
export interface Poll { id: string; question: string; allow_multiple: boolean; hide_voters?: boolean; total_voters: number;
  options: { id: string; text: string; votes: number; voted: boolean; voters: PollVoter[] }[] }
export interface PollDraft { question: string; options: string[]; allow_multiple: boolean; hide_voters: boolean }

export const emptyPoll = (): PollDraft => ({ question: '', options: ['', ''], allow_multiple: false, hide_voters: false });
export const pollPayload = (draft: PollDraft) => ({ question: draft.question.trim(), allow_multiple: draft.allow_multiple, hide_voters: draft.hide_voters, options: draft.options.map(option => option.trim()).filter(Boolean) });
export function pollProblem(draft: PollDraft) {
  const { question, options } = pollPayload(draft);
  if (!question) return 'Write a question.';
  if (options.length < 2) return 'Add at least two options.';
  if (new Set(options.map(option => option.toLocaleLowerCase('tr'))).size !== options.length) return 'Options must be different.';
  return '';
}

/** Question, options (a new empty row appears as the last one is filled) and the multiple-answers switch. */
export function PollEditor({ value, onChange, onRemove, disabled, idPrefix }: { value: PollDraft; onChange: (draft: PollDraft) => void; onRemove?: () => void; disabled?: boolean; idPrefix: string }) {
  const setOption = (index: number, text: string) => {
    const options = value.options.map((option, i) => i === index ? text : option);
    if (index === options.length - 1 && text.trim() && options.length < POLL_MAX_OPTIONS) options.push('');
    onChange({ ...value, options });
  };
  const removeOption = (index: number) => {
    const options = value.options.filter((_, i) => i !== index);
    while (options.length < 2) options.push('');
    onChange({ ...value, options });
  };
  return <fieldset className="talk-poll-editor" disabled={disabled}>
    <legend><BarChart3 size={15} aria-hidden="true"/>Poll{onRemove && <button type="button" className="talk-poll-icon" aria-label="Remove poll" onClick={onRemove}><X size={15}/></button>}</legend>
    <label htmlFor={`${idPrefix}-question`} className="sr-only">Poll question</label>
    <input id={`${idPrefix}-question`} className="talk-poll-question" required maxLength={200} value={value.question} placeholder="Ask a question" onChange={e => onChange({ ...value, question: e.target.value })}/>
    <ol className="talk-poll-option-inputs">
      {value.options.map((option, index) => <li key={index}>
        <label htmlFor={`${idPrefix}-option-${index}`} className="sr-only">Option {index + 1}</label>
        <input id={`${idPrefix}-option-${index}`} maxLength={100} value={option} placeholder={`Option ${index + 1}`} onChange={e => setOption(index, e.target.value)}/>
        {value.options.length > 2 && <button type="button" className="talk-poll-icon" aria-label={`Remove option ${index + 1}`} onClick={() => removeOption(index)}><X size={14}/></button>}
      </li>)}
    </ol>
    <label className="talk-poll-switch"><input type="checkbox" checked={value.allow_multiple} onChange={e => onChange({ ...value, allow_multiple: e.target.checked })}/>Allow multiple answers</label>
    <label className="talk-poll-switch"><input type="checkbox" checked={value.hide_voters} onChange={e => onChange({ ...value, hide_voters: e.target.checked })}/>Hide who voted <small>(only totals are shown)</small></label>
  </fieldset>;
}

/** A posted poll. Tapping an option votes at once; tapping your own answer again withdraws it. */
export function PollCard({ poll, canVote, busy, onVote }: { poll: Poll; canVote: boolean; busy?: boolean; onVote: (optionIds: string[]) => void }) {
  const [showVotes, setShowVotes] = useState(false);
  const mine = poll.options.filter(option => option.voted).map(option => option.id);
  const top = Math.max(1, ...poll.options.map(option => option.votes));
  const choose = (id: string) => {
    if (!canVote || busy) return;
    if (poll.allow_multiple) onVote(mine.includes(id) ? mine.filter(other => other !== id) : [...mine, id]);
    else onVote(mine.includes(id) ? [] : [id]);
  };
  return <div className="talk-poll" role="group" aria-label={`Poll: ${poll.question}`}>
    <p className="talk-poll-title"><BarChart3 size={15} aria-hidden="true"/><strong>{poll.question}</strong></p>
    <p className="talk-poll-mode">{poll.allow_multiple ? 'Select one or more' : 'Select one'}{poll.hide_voters ? ' · Anonymous' : ''}</p>
    <ul>
      {poll.options.map(option => <li key={option.id}>
        <button type="button" className={`talk-poll-option ${option.voted ? 'is-voted' : ''}`} disabled={!canVote || busy} aria-pressed={option.voted} onClick={() => choose(option.id)}>
          <span className={`talk-poll-mark ${poll.allow_multiple ? 'is-box' : ''}`} aria-hidden="true">{option.voted && <Check size={12}/>}</span>
          <span className="talk-poll-body">
            <span className="talk-poll-row"><span className="talk-poll-text">{option.text}</span>
              <span className="talk-poll-voters" aria-hidden="true">{option.voters.slice(0, 3).map(voter => <span key={voter.id} className="talk-poll-dot" title={voter.name}>{voter.avatar_url ? <img src={voter.avatar_url} alt=""/> : (voter.name || '?').charAt(0).toUpperCase()}</span>)}</span>
              <span className="talk-poll-count">{option.votes}</span></span>
            <span className="talk-poll-bar" aria-hidden="true"><span style={{ width: `${(option.votes / top) * 100}%` }}/></span>
          </span>
        </button>
      </li>)}
    </ul>
    {poll.hide_voters ? <p className="talk-poll-view is-static">{poll.total_voters ? `${poll.total_voters} ${poll.total_voters === 1 ? 'person' : 'people'} voted · voters are hidden` : 'No votes yet'}</p> : <>
    <button type="button" className="talk-poll-view" aria-expanded={showVotes} disabled={!poll.total_voters} onClick={() => setShowVotes(!showVotes)}>
      {poll.total_voters ? (showVotes ? 'Hide votes' : 'View votes') : 'No votes yet'}{poll.total_voters ? ` · ${poll.total_voters} ${poll.total_voters === 1 ? 'person' : 'people'}` : ''}
    </button>
    {showVotes && <dl className="talk-poll-votes">{poll.options.filter(option => option.votes).map(option => <div key={option.id}><dt>{option.text} <small>{option.votes} {option.votes === 1 ? 'vote' : 'votes'}</small></dt>{option.voters.map(voter => <dd key={voter.id}>{voter.name}</dd>)}</div>)}</dl>}</>}
  </div>;
}
