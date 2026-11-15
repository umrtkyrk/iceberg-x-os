import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Compass,
  FileWarning,
  FileSignature,
  Mail,
  MessageCircleQuestion,
  Mic,
  MoonStar,
  PenLine,
  Rocket,
  type LucideIcon,
} from 'lucide-react';
import { api } from '../../utils/api';
import { FORUM_ENABLED } from '../../config/features';
import { formatEnum, getStatusMeta } from '../../utils/missionMeta';
import {
  STATUS_COPY,
  formatDateTime,
  relativeDay,
  type CubeSignals,
  type SignalItem,
} from '../../utils/cubeSignals';
import { UserAvatar } from '../UserAvatar';

interface FocusPanelProps {
  /** Opens the dashboard's update form for a mission. */
  onPostUpdate: (missionId: string) => void;
  /** Bump to refetch, e.g. after an update was posted. */
  refreshKey?: number;
}

interface Step {
  key: string;
  icon: LucideIcon;
  tone: 'quiet' | 'attention';
  title: string;
  detail: React.ReactNode;
  actions: { label: string; to?: string; href?: string; onClick?: () => void }[];
}

/**
 * "What am I on, what should I do next, how do I look to my mentor" — the
 * Cube's own view of the signals their mentor sees.
 */
export const FocusPanel: React.FC<FocusPanelProps> = ({ onPostUpdate, refreshKey = 0 }) => {
  const [signals, setSignals] = useState<CubeSignals | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/cube/focus')
      .then((data: CubeSignals) => {
        if (!cancelled) {
          setSignals(data);
          setFailed(false);
        }
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // The rest of the dashboard still works; this panel just stays out of the way.
  if (failed || !signals) return null;

  const status = STATUS_COPY[signals.status];
  const firstMission = signals.missions[0];
  const mentor = signals.mentor;
  const steps = buildSteps(signals.items, { onPostUpdate, firstMissionId: firstMission?.id, mentorEmail: mentor?.email });

  return (
    <section aria-labelledby="focus-heading" className="rounded-[1.75rem] border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="focus-heading" className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-gray-900">
            <Compass className="h-5 w-5 text-magenta" /> Your focus
          </h2>
          <p className="mt-1 text-xs font-medium text-gray-500">
            What you are on, what to do next, and the same signals your mentor sees.
          </p>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-extrabold ${status.pill}`}>
          <span className={`h-2 w-2 rounded-full ${status.dot}`} />
          {status.label}
        </span>
      </div>

      {signals.status === 'quiet' && (
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          Your mentor sees you as <strong>quiet</strong> right now. Do one of the steps below and it clears on its own.
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Next steps */}
        <div className="flex flex-col gap-3 lg:col-span-2">
          <h3 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-400">Next steps</h3>
          {steps.length === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-extrabold text-emerald-800">You are all caught up.</p>
                <p className="text-xs font-medium text-emerald-700">Keep posting updates as you go and this stays green.</p>
              </div>
            </div>
          ) : (
            <ol className="flex flex-col gap-2.5">
              {steps.map(step => {
                const Icon = step.icon;
                return (
                  <li
                    key={step.key}
                    className={`flex flex-col gap-3 rounded-2xl border px-4 py-3.5 sm:flex-row sm:items-center ${
                      step.tone === 'quiet' ? 'border-rose-100 bg-rose-50/60' : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        step.tone === 'quiet' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-extrabold text-gray-900">{step.title}</p>
                      <div className="mt-0.5 text-xs font-medium leading-relaxed text-gray-500">{step.detail}</div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {step.actions.map(action => {
                        const className =
                          'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-extrabold transition-colors ' +
                          (action === step.actions[0]
                            ? 'bg-magenta text-white hover:bg-magenta-hover'
                            : 'border border-gray-200 bg-white text-gray-700 hover:border-gray-300');
                        if (action.onClick) {
                          return (
                            <button key={action.label} type="button" onClick={action.onClick} className={className}>
                              {action.label}
                            </button>
                          );
                        }
                        if (action.href) {
                          return (
                            <a key={action.label} href={action.href} className={className}>
                              {action.label}
                            </a>
                          );
                        }
                        return (
                          <Link key={action.label} to={action.to!} className={className}>
                            {action.label} <ArrowRight className="h-3 w-3" />
                          </Link>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* Context: mentor, what I'm on, how I look */}
        <aside className="flex flex-col gap-4">
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-400">Your mentor</h3>
            {mentor ? (
              <div className="mt-2.5 flex items-center gap-3">
                <UserAvatar name={mentor.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-gray-900">{mentor.name}</p>
                  <a href={`mailto:${mentor.email}`} className="flex items-center gap-1 truncate text-xs font-semibold text-magenta hover:underline">
                    <Mail className="h-3 w-3 shrink-0" /> {mentor.email}
                  </a>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs font-medium text-gray-500">No mentor assigned yet. The programme team will pair you with one.</p>
            )}
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-400">Right now</h3>
            <ul className="mt-2.5 flex flex-col gap-2.5">
              {signals.missions.length === 0 && <li className="text-xs font-medium text-gray-500">No active mission.</li>}
              {signals.missions.map(mission => {
                const meta = getStatusMeta(mission.status);
                return (
                  <li key={mission.id}>
                    <Link to={`/missions/${mission.id}`} className="group flex items-start gap-2">
                      <Rocket className="mt-0.5 h-3.5 w-3.5 shrink-0 text-magenta" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-extrabold text-gray-900 group-hover:text-magenta">{mission.title}</span>
                        <span className="text-[11px] font-semibold text-gray-500">
                          {meta.label} · {formatEnum(mission.role)}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
              {signals.next_meeting && (
                <li className="flex items-start gap-2">
                  <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <span className="min-w-0 text-xs font-semibold text-gray-600">
                    <Link to="/meetings" className="font-extrabold text-gray-900 hover:text-magenta">{signals.next_meeting.title}</Link>
                    <br />
                    {formatDateTime(signals.next_meeting.date)}
                  </span>
                </li>
              )}
              {signals.next_webinar && (
                <li className="flex items-start gap-2">
                  <Mic className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <span className="min-w-0 text-xs font-semibold text-gray-600">
                    <Link to={`/webinars/${signals.next_webinar.id}`} className="font-extrabold text-gray-900 hover:text-magenta">
                      {signals.next_webinar.title}
                    </Link>
                    <br />
                    {formatDateTime(signals.next_webinar.date)}
                    {signals.next_webinar.has_question && ' · question sent'}
                  </span>
                </li>
              )}
            </ul>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-400">How your mentor sees you</h3>
            <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2.5 text-xs">
              <Fact label="Active days (7d)" value={`${signals.activity.active_days_7} / 7`} />
              <Fact label="Active days (30d)" value={`${signals.activity.active_days_30} / 30`} />
              <Fact label="Last update" value={relativeDay(signals.last_update?.at)} />
              <Fact label="Last contribution" value={relativeDay(signals.activity.last_contribution_at)} />
            </dl>
            <p className="mt-3 text-[11px] font-medium leading-relaxed text-gray-400">
              Contributions are updates, forum posts, webinar questions and meetings you attended.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
};

const Fact: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <dt className="font-semibold text-gray-400">{label}</dt>
    <dd className="mt-0.5 font-extrabold text-gray-900">{value.charAt(0).toUpperCase() + value.slice(1)}</dd>
  </div>
);

function buildSteps(
  items: SignalItem[],
  ctx: { onPostUpdate: (missionId: string) => void; firstMissionId?: string; mentorEmail?: string }
): Step[] {
  const mentorAction = ctx.mentorEmail ? [{ label: 'Email your mentor', href: `mailto:${ctx.mentorEmail}` }] : [];
  // One visible contribution clears "quiet"; offer the easiest one available.
  const contributeActions = [
    ...(ctx.firstMissionId ? [{ label: 'Post an update', onClick: () => ctx.onPostUpdate(ctx.firstMissionId!) }] : []),
    ...(FORUM_ENABLED ? [{ label: 'Open the forum', to: '/forum' }] : []),
    ...(!ctx.firstMissionId ? [{ label: 'Browse missions', to: '/missions' }] : []),
  ];

  const steps: Step[] = [];
  for (const item of items) {
    switch (item.kind) {
      case 'quiet_no_visits':
        // Both quiet signals ask for the same thing; show one.
        if (items.some(i => i.kind === 'quiet_no_contribution')) break;
        steps.push({
          key: item.kind,
          icon: MoonStar,
          tone: 'quiet',
          title: 'You have been away from the portal',
          detail: item.days === null ? 'No visits recorded yet.' : `Last visit ${relativeDay(item.last_active_at)}.`,
          actions: contributeActions,
        });
        break;
      case 'quiet_no_contribution':
        steps.push({
          key: item.kind,
          icon: MoonStar,
          tone: 'quiet',
          title: item.days === null ? 'No visible contribution yet' : `No visible contribution for ${item.days} days`,
          detail: 'An update, a forum post or a webinar question shows your mentor what you are working on.',
          actions: contributeActions,
        });
        break;
      case 'update_overdue':
        steps.push({
          key: `${item.kind}:${item.mission_id}`,
          icon: PenLine,
          tone: 'attention',
          title: `Post an update on ${item.mission_title}`,
          detail: item.last_update_at
            ? `Your last update was ${relativeDay(item.last_update_at)}. A few lines on progress and blockers is enough.`
            : 'No update since you joined this mission. A few lines on progress and blockers is enough.',
          actions: [{ label: 'Post an update', onClick: () => ctx.onPostUpdate(item.mission_id) }],
        });
        break;
      case 'open_blocker':
        steps.push({
          key: item.kind,
          icon: AlertTriangle,
          tone: 'attention',
          title: `You are blocked on ${item.mission_title}`,
          detail: (
            <>
              <span className="italic">“{item.blockers.length > 140 ? `${item.blockers.slice(0, 140)}…` : item.blockers}”</span>
              <br />
              Reported {relativeDay(item.reported_at)}. Ask for help, then post a new update once it is solved.
            </>
          ),
          actions: [...(FORUM_ENABLED ? [{ label: 'Ask in the forum', to: '/forum' }] : []), ...mentorAction],
        });
        break;
      case 'no_mission':
        steps.push({
          key: item.kind,
          icon: Rocket,
          tone: 'attention',
          title: 'You are not on a mission',
          detail: 'Browse the open missions or ask your mentor about your next assignment.',
          actions: [{ label: 'Browse missions', to: '/missions' }, ...mentorAction],
        });
        break;
      case 'nda_pending':
        steps.push({
          key: item.kind,
          icon: FileSignature,
          tone: 'attention',
          title: 'Sign your NDA',
          detail: 'Your NDA has been sent and is waiting for your signature.',
          actions: [{ label: 'Open the Vault', to: '/vault' }],
        });
        break;
      case 'document_rejected':
        steps.push({
          key: item.kind,
          icon: FileWarning,
          tone: 'attention',
          title: item.count === 1 ? 'A document needs re-uploading' : `${item.count} documents need re-uploading`,
          detail: 'The programme team could not accept it. The review note in the Vault says why.',
          actions: [{ label: 'Open the Vault', to: '/vault' }],
        });
        break;
      case 'webinar_question_due': {
        const closed = new Date(item.closes_at).getTime() < Date.now();
        steps.push({
          key: `${item.kind}:${item.webinar_id}`,
          icon: MessageCircleQuestion,
          tone: 'attention',
          title: `Send your question for ${item.title}`,
          detail: closed
            ? `The deadline has passed; questions sent before the talk starts (${formatDateTime(item.starts_at)}) are marked late.`
            : `Questions close ${relativeDay(item.closes_at)} (${formatDateTime(item.closes_at)}).`,
          actions: [{ label: 'Ask a question', to: `/webinars/${item.webinar_id}` }],
        });
        break;
      }
    }
  }
  // Quiet steps first: they are what the mentor notices.
  return steps.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'quiet' ? -1 : 1));
}
