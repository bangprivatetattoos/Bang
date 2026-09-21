/**
 * What "ready to play" actually means for a feed clip.
 *
 * Not `canplaythrough`: that event asks whether the browser thinks the WHOLE
 * clip can play without stalling, which is a guess about future bandwidth. It
 * fires late, or never, on exactly the connections where it matters most.
 *
 * The feed needs a smaller, answerable question — is there enough buffered
 * from the current position to start now, while the rest streams — so these
 * read the element's real buffered ranges instead.
 */

/** HTMLMediaElement.readyState, named. */
export const HAVE_NOTHING = 0;
export const HAVE_METADATA = 1;
export const HAVE_CURRENT_DATA = 2;
export const HAVE_FUTURE_DATA = 3;
export const HAVE_ENOUGH_DATA = 4;

/** The minimal shape these helpers need, so they can be tested without a DOM. */
export interface ReadableMedia {
  readyState: number;
  currentTime: number;
  buffered: { length: number; start: (index: number) => number; end: (index: number) => number };
}

/**
 * Seconds buffered continuously from `from` (default: the playhead).
 *
 * Only the range containing that point counts. Media buffered further along,
 * past a gap, cannot be played through to, so counting it would overstate how
 * ready the clip is.
 */
export function bufferedAhead(media: ReadableMedia | null | undefined, from?: number): number {
  if (!media) return 0;
  const at = from ?? media.currentTime ?? 0;
  const ranges = media.buffered;
  if (!ranges || ranges.length === 0) return 0;
  for (let i = 0; i < ranges.length; i += 1) {
    const start = ranges.start(i);
    const end = ranges.end(i);
    // A range starting a hair after the playhead still counts: the gap is
    // rounding, not missing media.
    if (start <= at + 0.25 && end > at) return Math.max(0, end - at);
  }
  return 0;
}

/**
 * Whether playback can begin immediately.
 *
 * `HAVE_FUTURE_DATA` alone is accepted because the browser has already decided
 * it can advance the playhead. Otherwise a couple of seconds of buffered media
 * is enough to start, which is the whole point: the rest arrives while the
 * visitor is watching the opening.
 */
export function isVideoPlaybackReady(media: ReadableMedia | null | undefined, minSeconds = 2): boolean {
  if (!media) return false;
  if (media.readyState >= HAVE_FUTURE_DATA) return true;
  if (media.readyState < HAVE_METADATA) return false;
  return bufferedAhead(media) >= minSeconds;
}

/** A short, honest label for development diagnostics. */
export function readinessLabel(media: ReadableMedia | null | undefined): string {
  if (!media) return 'no element';
  const names = ['nothing', 'metadata', 'current', 'future', 'enough'];
  const state = names[media.readyState] ?? String(media.readyState);
  return `${state}, ${bufferedAhead(media).toFixed(1)}s buffered`;
}

/**
 * How aggressively to prepare upcoming clips.
 *
 * Progressive enhancement: the Network Information API is absent in Safari and
 * older browsers, and its absence must never reduce functionality, so an
 * unknown connection is treated as a normal one.
 *
 * `warm` is how many clips beyond the next are prepared at all; `eager` is how
 * many of those get a full `preload="auto"` rather than metadata only.
 */
export interface PreloadBudget {
  eager: number;
  warm: number;
  reason: string;
}

interface ConnectionLike {
  saveData?: boolean;
  effectiveType?: string;
}

export function preloadBudget(connection?: ConnectionLike | null): PreloadBudget {
  // Explicitly asked to use less data. Respect it: prepare the next clip only.
  if (connection?.saveData === true) return { eager: 1, warm: 1, reason: 'save-data' };

  const effective = connection?.effectiveType ?? '';
  if (effective === 'slow-2g' || effective === '2g') {
    return { eager: 1, warm: 1, reason: effective };
  }
  if (effective === '3g') return { eager: 1, warm: 2, reason: '3g' };

  // 4g, unknown, or no API at all.
  return { eager: 2, warm: 4, reason: effective || 'unknown' };
}
