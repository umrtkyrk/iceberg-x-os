import { useEffect, useId, useRef, useState } from 'react';
import { api } from '../../utils/api';
import { AuthorIdentity, type Author } from './ForumPortal';

export function ForumLikers({ topicId, replyId, count }: { topicId: string; replyId?: string; count: number }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const heading = useId();
  const [open, setOpen] = useState(false), [page, setPage] = useState(1);
  const [data, setData] = useState<{ people: Author[]; total: number; pageSize: number } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    let current = true;
    setData(null); setError('');
    api.get(`/forum/topics/${encodeURIComponent(topicId)}${replyId ? `/replies/${encodeURIComponent(replyId)}` : ''}/likes?page=${page}`)
      .then(next => { if (current) setData(next); }).catch(err => { if (current) setError(err.message); });
    return () => { current = false; };
  }, [open, page, topicId, replyId]);
  return <>
    <button ref={trigger} type="button" className="talk-pill talk-like-count" aria-label={`See who liked this · ${count} likes`}
      onClick={() => { setPage(1); setOpen(true); dialog.current?.showModal(); }}>{count} {count === 1 ? 'like' : 'likes'}</button>
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
}
