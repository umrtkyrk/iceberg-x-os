import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { useAuth } from '../context/AuthContext';

export interface NotificationItem {
  id: string;
  message: string;
  link?: string | null;
  created_at: string;
  read_at?: string | null;
}
const NOTIFICATIONS_CHANGED = 'iceberg:notifications-changed';

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    const sequence = ++requestSequence.current;
    try {
      const result = await api.get<NotificationItem[]>('/notifications');
      if (sequence === requestSequence.current) {
        setNotifications(result);
        setError('');
      }
    } catch {
      if (sequence === requestSequence.current)
        setError('Could not load notifications. Please try again.');
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    setNotifications([]);
    setLoading(Boolean(user?.id));
    if (!user?.id) return;
    void refresh();
    const interval = setInterval(() => void refresh(), 30000);
    const changed = () => void refresh();
    window.addEventListener(NOTIFICATIONS_CHANGED, changed);
    return () => {
      ++requestSequence.current;
      clearInterval(interval);
      window.removeEventListener(NOTIFICATIONS_CHANGED, changed);
    };
  }, [refresh, user?.id]);

  const markRead = async (ids?: string[]) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await api.post<{ read_at: string }>(
        '/notifications/read',
        ids ? { ids } : {}
      );
      ++requestSequence.current;
      setNotifications((previous) =>
        previous.map((item) =>
          !item.read_at && (!ids || ids.includes(item.id))
            ? { ...item, read_at: result.read_at }
            : item
        )
      );
      setError('');
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
    } catch {
      setError('Could not mark notifications as read. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return {
    notifications,
    unreadCount: notifications.filter((item) => !item.read_at).length,
    loading,
    busy,
    error,
    refresh,
    markRead,
  };
}
