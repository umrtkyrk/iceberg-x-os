import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from './api';

/** Heartbeat cadence: one "active minute" per tick. */
const HEARTBEAT_MS = 60_000;
/** A heartbeat is only sent if the person touched the page within this window. */
const IDLE_MS = 120_000;
/** Reloading or bouncing back to the same page inside this window is one view. */
const VIEW_DEDUPE_MS = 30_000;

function ping(type: 'view' | 'heartbeat', path: string) {
  // Usage tracking must never get in the way of the page, so every failure is swallowed.
  api.post('/activity/ping', { type, path }).catch(() => undefined);
}

/**
 * Tells the server which portal pages a signed-in person opens and when they
 * are actively using the tab. Mount once inside the authenticated layout.
 *
 * - A page view is sent on every route change.
 * - A heartbeat is sent every minute, only while the tab is visible AND the
 *   person moved the mouse, typed, clicked, scrolled or touched in the last
 *   two minutes. A tab left open in the background does not count.
 * - Individual clicks and keystrokes are never recorded or sent, only the
 *   fact that something happened recently.
 */
export function useActivityTracking(enabled: boolean) {
  const { pathname } = useLocation();
  const lastInteraction = useRef(Date.now());
  const lastView = useRef<{ path: string; at: number } | null>(null);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    if (!enabled) return;
    const now = Date.now();
    const previous = lastView.current;
    if (previous && previous.path === pathname && now - previous.at < VIEW_DEDUPE_MS) return;
    lastView.current = { path: pathname, at: now };
    ping('view', pathname);
  }, [enabled, pathname]);

  useEffect(() => {
    if (!enabled) return;

    const markInteraction = () => {
      lastInteraction.current = Date.now();
    };
    const events: Array<keyof WindowEventMap> = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((name) => window.addEventListener(name, markInteraction, { passive: true }));

    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastInteraction.current > IDLE_MS) return;
      ping('heartbeat', pathRef.current);
    }, HEARTBEAT_MS);

    return () => {
      events.forEach((name) => window.removeEventListener(name, markInteraction));
      window.clearInterval(timer);
    };
  }, [enabled]);
}
