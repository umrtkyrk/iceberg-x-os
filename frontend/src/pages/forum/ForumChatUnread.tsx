import { useEffect, useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { api } from '../../utils/api';

interface Unread { total: number; rooms: { id: string; count: number }[] }
export function useChatUnread(userId: string) {
  const [data, setData] = useState<Unread>({ total: 0, rooms: [] });
  useEffect(() => {
    let current = true, running = false, again = false;
    setData({ total: 0, rooms: [] });
    const load = async () => {
      if (!userId) return;
      if (running) { again = true; return; }
      running = true;
      try { const next = await api.get<Unread>('/forum/chat/unread'); if (current) setData(next); }
      catch { if (current) setData({ total: 0, rooms: [] }); }
      finally { running = false; if (again && current) { again = false; void load(); } }
    };
    void load();
    const timer = window.setInterval(load, 3000);
    window.addEventListener('forum-chat-read', load);
    window.addEventListener('focus', load);
    return () => { current = false; window.clearInterval(timer); window.removeEventListener('forum-chat-read', load); window.removeEventListener('focus', load); };
  }, [userId]);
  return data;
}
export function ChatUnreadBadge({ count }: { count: number }) {
  return count > 0 ? <span className="talk-chat-unread" aria-label={`${count} unread ${count === 1 ? 'message' : 'messages'}`}>{count}</span> : null;
}
export function PrivateRoomsButton({ userId, onClick }: { userId: string; onClick: () => void }) {
  const unread = useChatUnread(userId);
  return <button type="button" className="talk-btn is-ghost" onClick={onClick}><LockKeyhole size={16}/>Private rooms <ChatUnreadBadge count={unread.total}/></button>;
}
