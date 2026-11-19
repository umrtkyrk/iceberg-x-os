import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { Heart } from 'lucide-react';
import { api } from '../../utils/api';
import { AuthorIdentity, type Author } from './ForumPortal';

export interface LikersHandle { open: () => void }
export const ForumLikers = forwardRef<LikersHandle, { topicId: string; replyId?: string; count: number; showTrigger?: boolean }>(function ForumLikers({ topicId, replyId, count, showTrigger = true }, ref) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const heading = useId();
  const [open, setOpen] = useState(false), [page, setPage] = useState(1);
  const [data, setData] = useState<{ people: Author[]; total: number; pageSize: number } | null>(null);
  const [error, setError] = useState('');
  const show = () => { setPage(1); setOpen(true); if (!dialog.current?.open) dialog.current?.showModal(); };
  useImperativeHandle(ref, () => ({ open: show }));
  useEffect(() => {
    if (!open) return;
    let current = true;
    setData(null); setError('');
    api.get(`/forum/topics/${encodeURIComponent(topicId)}${replyId ? `/replies/${encodeURIComponent(replyId)}` : ''}/likes?page=${page}`)
      .then(next => { if (current) setData(next); }).catch(err => { if (current) setError(err.message); });
    return () => { current = false; };
  }, [open, page, topicId, replyId]);
  return <>
    {showTrigger && <button ref={trigger} type="button" className="talk-pill talk-like-count" aria-label={`See who liked this · ${count} likes`}
      onClick={show}>{count} {count === 1 ? 'like' : 'likes'}</button>}
    <dialog ref={dialog} className="talk-likers" aria-labelledby={heading} onClose={() => { setOpen(false); trigger.current?.focus(); }}>
      <div className="talk-form-actions"><h2 id={heading}>Liked by</h2><button type="button" className="talk-btn is-ghost" onClick={() => dialog.current?.close()}>Close</button></div>
      {error ? <p role="alert">{error}</p> : !data ? <p role="status">Loading people…</p> : <>
        <p>{data.total} {data.total === 1 ? 'person' : 'people'}</p>
        <ul>{data.people.map(person => <li key={person.id}><AuthorIdentity author={person} compact/></li>)}</ul>
        {!data.total && <p>No likes yet.</p>}
        <div className="talk-form-actions"><button type="button" className="talk-btn is-ghost" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page}</span><button type="button" className="talk-btn is-ghost" disabled={page * data.pageSize >= data.total} onClick={() => setPage(page + 1)}>Next</button></div>
      </>}
    </dialog>
  </>;
});

/**
 * A normal click likes or unlikes; right-click opens the list of people who liked it.
 */
export function ForumLikeButton({ topicId, replyId, liked, count, canLike, label, onToggle }: { topicId: string; replyId?: string; liked: boolean; count: number; canLike: boolean; label: string; onToggle: () => void }) {
  const likers = useRef<LikersHandle>(null);
  return <span className="talk-like-group">
    <button type="button" className={`talk-pill talk-like ${liked ? 'is-liked' : ''}`} aria-disabled={!canLike} aria-pressed={liked}
      aria-label={`${liked ? 'Unlike' : 'Like'} ${label} · ${count} ${count === 1 ? 'like' : 'likes'}. Right-click to see who liked it.`}
      title={canLike ? `${liked ? 'Unlike' : 'Like'} · right-click to see who liked` : 'Your account has read-only forum access. Right-click to see who liked.'}
      onContextMenu={event => { event.preventDefault(); if (event.button === 2 && (event.nativeEvent as PointerEvent).pointerType !== 'touch') likers.current?.open(); }}
      onClick={() => { if (canLike) onToggle(); }}>
      <Heart size={16} fill={liked ? 'currentColor' : 'none'}/>{count > 0 && <span className="talk-like-number">{count}</span>}</button>
    <ForumLikers ref={likers} topicId={topicId} replyId={replyId} count={count} showTrigger={false}/>
  </span>;
}
