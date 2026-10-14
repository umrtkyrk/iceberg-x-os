import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, CheckCheck, History, X } from 'lucide-react';
import { useNotifications } from '../utils/useNotifications';

export function NotificationBell() {
  const { notifications, unreadCount, loading, busy, error, markRead } =
    useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const outside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      )
        setIsOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [isOpen]);
  const shown = (
    unreadOnly ? notifications.filter((item) => !item.read_at) : notifications
  ).slice(0, 30);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-50 hover:text-magenta"
        title="Notifications"
        aria-label={
          'Notifications' + (unreadCount ? ', ' + unreadCount + ' unread' : '')
        }
        aria-expanded={isOpen}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-magenta px-1.5 py-0.5 text-[9px] font-extrabold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {isOpen && (
        <section
          aria-label="Notifications"
          className="fixed inset-x-3 top-24 z-50 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-3 sm:w-[400px]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-extrabold text-gray-900">
              Notifications{' '}
              <span className="ml-1 text-xs font-medium text-gray-400">
                {unreadCount} unread
              </span>
            </h2>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              title="Close notifications"
              aria-label="Close notifications"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-2.5">
            <div
              role="group"
              aria-label="Notification filter"
              className="flex gap-1 rounded-lg bg-gray-100 p-1"
            >
              {[
                { label: 'All', unread: false },
                { label: 'Unread', unread: true },
              ].map((tab) => (
                <button
                  type="button"
                  key={tab.label}
                  aria-pressed={unreadOnly === tab.unread}
                  onClick={() => setUnreadOnly(tab.unread)}
                  className={
                    'rounded-md px-3 py-1 text-xs font-bold ' +
                    (unreadOnly === tab.unread
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500')
                  }
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={!unreadCount || busy}
              onClick={() => void markRead()}
              className="flex items-center gap-1.5 text-[11px] font-bold text-magenta disabled:opacity-40"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          </div>
          {error && (
            <p
              role="alert"
              className="bg-red-50 px-4 py-2 text-xs text-red-700"
            >
              {error}
            </p>
          )}
          <div className="max-h-[min(60vh,480px)] overflow-y-auto overscroll-contain">
            {loading ? (
              <p role="status" className="p-6 text-sm text-gray-400">
                Loading notifications...
              </p>
            ) : !shown.length ? (
              <p className="p-6 text-center text-sm text-gray-500">
                {unreadOnly
                  ? 'You have no unread notifications.'
                  : 'No notifications yet.'}
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {shown.map((item) => (
                  <li
                    key={item.id}
                    className={
                      'flex items-start gap-3 p-4 ' +
                      (!item.read_at ? 'bg-cyan-50/40' : 'bg-white')
                    }
                  >
                    <span
                      className={
                        'mt-1.5 h-2 w-2 shrink-0 rounded-full ' +
                        (!item.read_at ? 'bg-magenta' : 'bg-gray-200')
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-wrap break-words text-sm font-medium leading-relaxed text-gray-700">
                        {item.message}
                      </p>
                      <time
                        dateTime={item.created_at}
                        className="mt-2 block text-[11px] text-gray-400"
                      >
                        {new Date(item.created_at).toLocaleString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>
                    {!item.read_at && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void markRead([item.id])}
                        title="Mark as read"
                        aria-label="Mark notification as read"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-white hover:text-emerald-600 disabled:opacity-40"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link
            to="/notification-history"
            onClick={() => setIsOpen(false)}
            className="flex items-center justify-center gap-2 border-t border-gray-100 bg-gray-50 p-3 text-xs font-bold text-gray-700 hover:text-magenta"
          >
            <History className="h-4 w-4" /> View notification history
          </Link>
        </section>
      )}
    </div>
  );
}
