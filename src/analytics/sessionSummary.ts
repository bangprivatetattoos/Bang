import { getAnalyticsAttribution, getAnalyticsSessionId, getAnalyticsVisitorId } from './client';
import { SessionAccumulator } from './sessionMetrics';

/**
 * Delivery for the aggregated feed metrics.
 *
 * The accumulator counts; this decides when to send. Never after an
 * interaction — that is the behaviour being replaced — but on a slow cadence
 * while the visitor is active, and at the moments a session realistically
 * ends: the tab being hidden, and the page going away.
 *
 * Totals are absolute and the server takes the larger of the two values, so a
 * failed flush costs nothing: the next one carries everything, and a duplicate
 * changes nothing.
 */

const ENDPOINT = '/.netlify/functions/analytics-summary';

/** Slow on purpose. This is a summary, not a heartbeat. */
const FLUSH_INTERVAL_MS = 60_000;

/** Bounded: analytics must never become a retry storm against our own API. */
const MAX_CONSECUTIVE_FAILURES = 5;

/** The session's counters. Components report into this directly. */
export const feedMetrics = new SessionAccumulator();

let timer: number | null = null;
let started = false;
let inFlight = false;
let failures = 0;

function payload() {
  const { session, content } = feedMetrics.snapshot(Date.now());
  return {
    sessionId: getAnalyticsSessionId(),
    // Sent so a summary arriving before the first page_view can create the
    // session row itself, with its attribution intact, rather than being
    // refused and risking loss if the visitor leaves. Device and geography
    // are deliberately not sent: the server reads those from the request.
    visitorId: getAnalyticsVisitorId(),
    landingPath: typeof window === 'undefined' ? '/' : window.location.pathname,
    referrer: typeof document === 'undefined' ? null : (document.referrer || null),
    attribution: getAnalyticsAttribution(),
    summary: session,
    // Only clips with something to report. A clip that was merely prepared
    // has no metrics and no row.
    content: Object.entries(content)
      .filter(([, metrics]) => Object.values(metrics).some(value => value > 0))
      .map(([contentId, metrics]) => ({ contentId, ...metrics })),
  };
}

/**
 * Sends the current totals.
 *
 * `keepalive` so a flush started as the page goes away still completes, which
 * is what makes the pagehide flush worth attempting at all. Every failure path
 * is swallowed: an analytics fault must never reach the visitor, block a
 * swipe, or stop a video.
 */
async function flush(reason: 'interval' | 'hidden' | 'pagehide'): Promise<void> {
  if (inFlight) return;
  if (!feedMetrics.hasPendingChanges()) return;
  if (failures >= MAX_CONSECUTIVE_FAILURES) return;

  inFlight = true;
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      keepalive: true,
      body: JSON.stringify(payload()),
    });
    if (response.ok) {
      feedMetrics.markFlushed();
      failures = 0;
    } else if (response.status === 409) {
      // The session row does not exist yet. Nothing is wrong and nothing is
      // lost; the totals stay pending and the next flush lands them.
      failures = 0;
    } else {
      failures += 1;
    }
  } catch {
    // Offline, blocked, or the page went away mid-request. The counters are
    // still held, so the next flush carries them.
    failures += 1;
  } finally {
    inFlight = false;
    if (import.meta.env.DEV) {
      console.info(`[analytics] summary flush (${reason}), failures: ${failures}`);
    }
  }
}

/**
 * Starts the reporting lifecycle. Safe to call more than once.
 *
 * Returns a teardown so a remount does not leave a second timer running.
 */
export function startSummaryReporting(): () => void {
  if (started) return () => {};
  started = true;

  const onInterval = () => { void flush('interval'); };
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      // The clock stops with the tab: time spent on another app is not watch
      // time, and counting it would flatter every metric built on it.
      feedMetrics.stopWatching(Date.now());
      void flush('hidden');
    }
  };
  const onPageHide = () => {
    feedMetrics.stopWatching(Date.now());
    void flush('pagehide');
  };

  timer = window.setInterval(onInterval, FLUSH_INTERVAL_MS);
  document.addEventListener('visibilitychange', onVisibility);
  // `pagehide` rather than `beforeunload`, which mobile Safari frequently
  // never fires. Both are attempted, and a duplicate flush is harmless
  // because the server resolves totals by taking the maximum.
  window.addEventListener('pagehide', onPageHide);

  return () => {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    started = false;
  };
}

/** Exposed for tests and for a deliberate flush at a conversion boundary. */
export const flushSessionSummary = flush;
