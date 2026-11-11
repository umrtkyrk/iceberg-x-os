import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Check, CheckCheck, RefreshCw, Search } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useNotifications } from '../utils/useNotifications';

export function NotificationHistory() {
  const {
    notifications,
    unreadCount,
    loading,
    busy,
    error,
    refresh,
    markRead,
  } = useNotifications();
  const [search, setSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [limit, setLimit] = useState(20);
  const filtered = notifications.filter(
    (item) =>
      (!unreadOnly || !item.read_at) &&
      item.message.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Your inbox"
        title="Notification History"
        description={
          unreadCount + ' unread · ' + notifications.length + ' notifications'
        }
      >
        <button
          type="button"
          title="Refresh notifications"
          aria-label="Refresh notifications"
          onClick={() => void refresh()}
          className="workspace-icon-button"
        >
          <RefreshCw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} />
        </button>
        <button
          type="button"
          disabled={busy || !unreadCount}
          onClick={() => void markRead()}
          className="workspace-primary-action"
        >
          <CheckCheck className="h-4 w-4" /> Mark all read
        </button>
      </PageHeader>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <span className="sr-only">Search notifications</span>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setLimit(20);
            }}
            placeholder="Search notification history..."
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(event) => {
              setUnreadOnly(event.target.checked);
              setLimit(20);
            }}
          />{' '}
          Unread only
        </label>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {loading ? (
        <p role="status" className="py-10 text-center text-gray-400">
          Loading history...
        </p>
      ) : filtered.length ? (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {filtered.slice(0, limit).map((item) => (
            <li
              key={item.id}
              className={
                'flex items-start gap-4 p-5 sm:p-6 ' +
                (!item.read_at ? 'bg-cyan-50/30' : '')
              }
            >
              <span
                className={
                  'mt-1.5 h-2 w-2 shrink-0 rounded-full ' +
                  (!item.read_at ? 'bg-magenta' : 'bg-gray-200')
                }
              />
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700">
                  {item.link?.startsWith('/forum?') ? <Link to={item.link} onClick={() => { void markRead([item.id]);  }} className="underline decoration-magenta/30 underline-offset-4 hover:text-magenta">{item.message}</Link> : item.message}
                </p>
                <time
                  dateTime={item.created_at}
                  className="mt-3 block text-xs text-gray-400"
                >
                  {new Date(item.created_at).toLocaleString('en-GB', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}{' '}
                  · {item.read_at ? 'Read' : 'Unread'}
                </time>
              </div>
              {!item.read_at && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void markRead([item.id])}
                  title="Mark as read"
                  aria-label="Mark notification as read"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-100 text-gray-400 hover:text-emerald-600 disabled:opacity-40"
                >
                  <Check className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-500">
          {notifications.length
            ? 'No notifications match your filters.'
            : 'No notifications yet.'}
        </p>
      )}
      {filtered.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((value) => value + 20)}
          className="self-center rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-xs font-bold text-gray-600"
        >
          Show more ({filtered.length - limit} remaining)
        </button>
      )}
    </div>
  );
}
