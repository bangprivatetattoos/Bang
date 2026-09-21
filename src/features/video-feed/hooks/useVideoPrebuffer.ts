import { useEffect, useRef, useState } from 'react';
import { bufferedAhead, preloadBudget, readinessLabel, type PreloadBudget } from './videoReadiness';

/**
 * Warms the clips just beyond the mounted window.
 *
 * The feed mounts three elements — previous, current, next — and the next one
 * already carries `preload="auto"`. This prepares what comes AFTER that, so a
 * visitor swiping steadily always arrives at a clip whose opening bytes are
 * already in the HTTP cache.
 *
 * It deliberately starts one clip past `next` rather than including it: two
 * elements pointing at one URL is a race for the same bytes, and the mounted
 * element is the one that actually has to play them.
 *
 * Warming elements are detached from the document, muted and never played, so
 * they cannot emit sound, cannot steal the autoplay grant, and cannot affect
 * the feed's sound state.
 */

interface Options {
  /**
   * How many upcoming clips to hold. Raised once the current clip is playing,
   * so warming never competes with the video the visitor is actually watching.
   */
  depth: number;
  enabled?: boolean;
}

/** Progressive enhancement; absent in Safari and older browsers. */
function connectionInfo(): { saveData?: boolean; effectiveType?: string } | null {
  if (typeof navigator === 'undefined') return null;
  const value = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return value ?? null;
}

export function useVideoPrebuffer(urls: string[], { depth, enabled = true }: Options) {
  const pool = useRef(new Map<string, HTMLVideoElement>());
  const [budget] = useState<PreloadBudget>(() => preloadBudget(connectionInfo()));

  // A stable key so the effect reruns only when the actual list changes,
  // rather than on every render that produces an equal array.
  const key = urls.join('|');

  useEffect(() => {
    if (!enabled) return;

    const limit = Math.max(0, Math.min(depth, budget.warm));
    const wanted = urls.slice(0, limit);
    const pooled = pool.current;

    // Release anything that has left the window. Detaching the source is what
    // actually frees the connection and the decoder; dropping the reference
    // alone would leave the download running.
    for (const [url, element] of [...pooled]) {
      if (wanted.includes(url)) continue;
      element.removeAttribute('src');
      element.load();
      pooled.delete(url);
    }

    for (const url of wanted) {
      if (pooled.has(url)) continue;
      const element = document.createElement('video');
      element.muted = true;
      element.setAttribute('muted', '');
      element.playsInline = true;
      element.preload = 'auto';
      // Never appended to the document: this is a fetch with a decoder
      // attached, not a player.
      element.src = url;
      element.load();
      pooled.set(url, element);
    }
  }, [key, depth, enabled, budget.warm, urls]);

  // Releasing on unmount matters: without it, leaving the feed would leave
  // several video downloads running against a page nobody is looking at.
  useEffect(() => {
    const pooled = pool.current;
    return () => {
      for (const element of pooled.values()) {
        element.removeAttribute('src');
        element.load();
      }
      pooled.clear();
    };
  }, []);

  return {
    budget,
    /** Development diagnostics only; never called in a production path. */
    describe: () => [...pool.current.entries()].map(([url, element]) => ({
      url: url.slice(url.lastIndexOf('/') + 1),
      buffered: bufferedAhead(element),
      state: readinessLabel(element),
    })),
  };
}
