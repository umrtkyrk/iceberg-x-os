import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCircle2, MessageCircleQuestion, MessagesSquare, PenLine, Shield } from 'lucide-react';
import { api } from '../../utils/api';
import { FORUM_ENABLED } from '../../config/features';
import { UserAvatar } from '../UserAvatar';

interface PulseAuthor { id: string; name: string; avatar_url?: string | null }
interface PulseTopic {
  id: string;
  title: string;
  author: PulseAuthor | null;
  category: { id: string; name: string } | null;
}
interface RecentTopic extends PulseTopic {
  last_activity_at: string;
  accepted_reply_id: string | null;
  read_at: string | null;
  _count?: { replies: number };
}
interface UnansweredTopic extends PulseTopic { created_at: string }
interface ForumDashboardData {
  recent: RecentTopic[];
  unanswered: UnansweredTopic[];
  my_posts: number;
  week_posts: number;
  followed_unread: number;
  open_reports: number | null;
}

const topicLink = (id: string) => `/forum?topic=${encodeURIComponent(id)}`;

function ago(value: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days}d ago` : new Date(value).toLocaleDateString();
}

/**
 * Forum activity on the dashboard: the latest discussions, questions still
 * waiting for a first reply, and the viewer's own pulse. Hidden entirely when
 * the forum is off or its API is unavailable, so it never breaks a dashboard.
 */
export const ForumPulse: React.FC = () => {
  const [data, setData] = useState<ForumDashboardData | null>(null);

  useEffect(() => {
    if (!FORUM_ENABLED) return;
    let current = true;
    api.get<ForumDashboardData>('/forum/dashboard')
      .then(result => { if (current) setData(result); })
      .catch(() => { if (current) setData(null); });
    return () => { current = false; };
  }, []);

  if (!FORUM_ENABLED || !data) return null;

  const staff = data.open_reports !== null;
  const recent = data.recent || [];
  const unanswered = data.unanswered || [];

  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-gray-100 bg-white p-6 shadow-subtle" aria-labelledby="forum-pulse-title">
      <div className="flex items-center justify-between">
        <h3 id="forum-pulse-title" className="flex items-center gap-2 text-base font-extrabold text-gray-900">
          <MessagesSquare className="h-5 w-5 text-magenta" /> Forum
        </h3>
        <Link to="/forum" className="text-[11px] font-extrabold text-magenta hover:underline">
          Open forum
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <PulseStat label="Your posts" value={data.my_posts} />
        <PulseStat label="This week" value={data.week_posts} />
        {staff ? (
          <PulseStat label="Open reports" value={data.open_reports ?? 0} to="/forum?view=reports" icon={Shield} hot={(data.open_reports ?? 0) > 0} />
        ) : (
          <PulseStat label="Followed · new" value={data.followed_unread} to="/forum?view=following" icon={Bell} hot={data.followed_unread > 0} />
        )}
      </div>

      {!staff && data.my_posts === 0 && (
        <Link
          to="/forum?category=introductions"
          className="flex items-start gap-3 rounded-2xl bg-gradient-to-br from-magenta/10 to-amber-50 p-3.5 ring-1 ring-magenta/15 transition hover:ring-magenta/40"
        >
          <PenLine className="mt-0.5 h-4 w-4 shrink-0 text-magenta" />
          <span className="text-xs font-semibold leading-relaxed text-gray-700">
            <strong className="font-extrabold text-gray-900">Write your first post.</strong> Say hello in Introductions;
            your first post can earn you a quest badge.
          </span>
        </Link>
      )}

      {recent.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-gray-400">Latest discussions</p>
          <ul className="flex flex-col">
            {recent.map(topic => {
              const unread = !topic.read_at || new Date(topic.last_activity_at) > new Date(topic.read_at);
              const replies = topic._count?.replies ?? 0;
              return (
                <li key={topic.id}>
                  <Link to={topicLink(topic.id)} className="group flex items-start gap-3 rounded-xl p-2 -mx-2 transition hover:bg-gray-50">
                    <UserAvatar name={topic.author?.name || 'Cube'} avatarUrl={topic.author?.avatar_url} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        {unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-magenta" aria-label="Unread" />}
                        <span className={`truncate text-xs group-hover:text-magenta ${unread ? 'font-extrabold text-gray-900' : 'font-semibold text-gray-600'}`}>
                          {topic.title}
                        </span>
                        {topic.accepted_reply_id && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-label="Solved" />}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] font-bold text-gray-400">
                        {topic.category?.name || 'Forum'} · {replies} {replies === 1 ? 'reply' : 'replies'} · {ago(topic.last_activity_at)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="py-2 text-center text-xs font-semibold text-gray-400">
          The forum is quiet. <Link to="/forum" className="font-extrabold text-magenta hover:underline">Start the first discussion</Link>.
        </p>
      )}

      {unanswered.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-gray-50 pt-4">
          <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-amber-600">
            <MessageCircleQuestion className="h-3.5 w-3.5" /> Waiting for a first reply
          </p>
          <ul className="flex flex-col gap-1.5">
            {unanswered.map(topic => (
              <li key={topic.id}>
                <Link
                  to={topicLink(topic.id)}
                  className="flex items-center justify-between gap-3 rounded-xl bg-amber-50/60 px-3 py-2 ring-1 ring-amber-100 transition hover:ring-amber-300"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold text-gray-800">{topic.title}</span>
                    <span className="block truncate text-[10px] font-semibold text-gray-500">
                      {topic.author?.name || 'Unknown Cube'} · {ago(topic.created_at)}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] font-extrabold text-amber-700">Reply →</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

const PulseStat: React.FC<{
  label: string;
  value: number;
  to?: string;
  icon?: React.ComponentType<{ className?: string }>;
  hot?: boolean;
}> = ({ label, value, to, icon: Icon, hot }) => {
  const body = (
    <>
      <span className={`flex items-center justify-center gap-1 text-lg font-black leading-none tabular-nums ${hot ? 'text-magenta' : 'text-gray-900'}`}>
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {value}
      </span>
      <span className="mt-1 text-[9px] font-extrabold uppercase tracking-wide text-gray-400">{label}</span>
    </>
  );
  const className = `flex flex-col rounded-2xl bg-gray-50 px-2 py-2.5 text-center ring-1 ${hot ? 'ring-magenta/30' : 'ring-gray-100'}`;
  return to ? (
    <Link to={to} className={`${className} transition hover:ring-magenta/40`}>{body}</Link>
  ) : (
    <div className={className}>{body}</div>
  );
};
