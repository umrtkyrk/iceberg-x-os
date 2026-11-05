/**
 * Automatic webinar reminders, run by an in-process sweep:
 *  - before the question deadline, to invited Cubes who have not asked yet
 *  - shortly before the start, to every invited Cube
 *
 * Each reminder is claimed with a conditional update on its *_sent_at column
 * before anything is sent, so it goes out at most once even if the sweep runs
 * on several instances at the same time.
 */
import { WebinarStatus } from '@prisma/client';
import prisma from './prisma';
import { reminderDue } from './webinar';
import { cubesWithQuestions, notifyUsers, requiredCubes } from './webinarAudience.service';

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

function istanbulTime(date: Date) {
  return date.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul'
  });
}

export async function runWebinarReminderSweep(now: Date = new Date()): Promise<{ deadline: number; start: number }> {
  const sent = { deadline: 0, start: 0 };
  const candidates = await prisma.webinar.findMany({
    where: {
      status: WebinarStatus.Published,
      date: { gt: now },
      OR: [{ deadline_reminder_sent_at: null }, { start_reminder_sent_at: null }]
    }
  });

  for (const webinar of candidates) {
    const due = reminderDue(webinar, now);

    if (due.deadline) {
      const claimed = await prisma.webinar.updateMany({
        where: { id: webinar.id, deadline_reminder_sent_at: null },
        data: { deadline_reminder_sent_at: now }
      });
      if (claimed.count === 1) {
        const [cubes, asked] = await Promise.all([requiredCubes(webinar), cubesWithQuestions(webinar.id)]);
        const missing = cubes.filter(c => !asked.has(c.id));
        await notifyUsers(
          missing.map(c => c.user.id),
          `Reminder: questions for the "${webinar.title}" webinar close on ${istanbulTime(webinar.questions_close_at)} (Istanbul). You have not sent one yet.`
        );
        sent.deadline += missing.length;
      }
    }

    if (due.start) {
      const claimed = await prisma.webinar.updateMany({
        where: { id: webinar.id, start_reminder_sent_at: null },
        data: { start_reminder_sent_at: now }
      });
      if (claimed.count === 1) {
        const cubes = await requiredCubes(webinar);
        await notifyUsers(
          cubes.map(c => c.user.id),
          `The "${webinar.title}" webinar starts at ${istanbulTime(webinar.date)} (Istanbul). The join link is on the Webinars page.`
        );
        sent.start += cubes.length;
      }
    }
  }
  return sent;
}

/** Starts the sweep. Set WEBINAR_REMINDERS_DISABLED=true to turn it off. */
export function startWebinarReminders() {
  if (process.env.WEBINAR_REMINDERS_DISABLED === 'true') return;
  const tick = () =>
    runWebinarReminderSweep().catch(err => console.error('[webinars] Reminder sweep failed:', err));
  setTimeout(tick, 60 * 1000).unref();
  setInterval(tick, SWEEP_INTERVAL_MS).unref();
}
