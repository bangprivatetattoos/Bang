import { useEffect, useRef, type RefObject } from 'react';

/** How a transition was requested, so analytics can tell them apart. */
export type NavigationMethod = 'swipe' | 'wheel' | 'keyboard';

interface Options {
  /** Navigation pauses while a sheet, sidebar or dropdown is open. */
  enabled: boolean;
  onForward: (method: NavigationMethod) => void;
  onBackward: (method: NavigationMethod) => void;
}

/** Ignore further input for this long after a transition commits. */
const COOLDOWN_MS = 620;
/** Wheel/trackpad travel required to commit one transition. */
const WHEEL_THRESHOLD = 90;
/** A pause this long ends the current wheel gesture. */
const WHEEL_GESTURE_GAP_MS = 220;
/** Vertical travel required to commit a touch swipe. */
const SWIPE_THRESHOLD = 55;
const SWIPE_MAX_MS = 900;

const KEYS_FORWARD = new Set(['ArrowDown', 'PageDown']);
const KEYS_BACKWARD = new Set(['ArrowUp', 'PageUp']);

/**
 * Vertical feed navigation for touch, wheel/trackpad and keyboard.
 *
 * One physical gesture produces at most one transition: a cooldown blocks the
 * tail of an inertial trackpad flick, and wheel travel has to accumulate past
 * a threshold before it counts. Listeners live on the feed element rather than
 * the document, so sheets, the sidebar and the artist dropdown scroll normally
 * underneath an open overlay.
 */
export function useFeedNavigation(target: RefObject<HTMLElement | null>, { enabled, onForward, onBackward }: Options) {
  const handlers = useRef({ onForward, onBackward });
  handlers.current = { onForward, onBackward };

  const lockedUntil = useRef(0);
  const wheelTravel = useRef(0);
  const wheelLastAt = useRef(0);
  const touchStart = useRef<{ y: number; at: number } | null>(null);

  useEffect(() => {
    const element = target.current;
    if (!element || !enabled) return;

    const commit = (direction: 'forward' | 'backward', method: NavigationMethod) => {
      const now = Date.now();
      if (now < lockedUntil.current) return;
      lockedUntil.current = now + COOLDOWN_MS;
      wheelTravel.current = 0;
      if (direction === 'forward') handlers.current.onForward(method);
      else handlers.current.onBackward(method);
    };

    const onWheel = (event: WheelEvent) => {
      // The feed is a fixed surface; letting the wheel reach the page would
      // rubber-band the document behind it.
      event.preventDefault();
      const now = Date.now();
      if (now < lockedUntil.current) return;

      // A gap, or a reversal, starts a fresh gesture.
      if (now - wheelLastAt.current > WHEEL_GESTURE_GAP_MS) wheelTravel.current = 0;
      if (Math.sign(event.deltaY) !== Math.sign(wheelTravel.current)) wheelTravel.current = 0;
      wheelLastAt.current = now;
      wheelTravel.current += event.deltaY;

      if (wheelTravel.current >= WHEEL_THRESHOLD) commit('forward', 'wheel');
      else if (wheelTravel.current <= -WHEEL_THRESHOLD) commit('backward', 'wheel');
    };

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      touchStart.current = touch ? { y: touch.clientY, at: Date.now() } : null;
    };

    const onTouchMove = (event: TouchEvent) => {
      // Suppress the browser's own overscroll while a feed swipe is in flight.
      if (touchStart.current && event.cancelable) event.preventDefault();
    };

    const onTouchEnd = (event: TouchEvent) => {
      const start = touchStart.current;
      touchStart.current = null;
      const touch = event.changedTouches[0];
      if (!start || !touch) return;
      const travel = start.y - touch.clientY;
      if (Math.abs(travel) < SWIPE_THRESHOLD || Date.now() - start.at > SWIPE_MAX_MS) return;
      commit(travel > 0 ? 'forward' : 'backward', 'swipe');
    };

    const onKeyDown = (event: KeyboardEvent) => {
      // Never hijack keys aimed at a control the visitor is actually using.
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) return;
      if (KEYS_FORWARD.has(event.key)) { event.preventDefault(); commit('forward', 'keyboard'); }
      else if (KEYS_BACKWARD.has(event.key)) { event.preventDefault(); commit('backward', 'keyboard'); }
    };

    element.addEventListener('wheel', onWheel, { passive: false });
    element.addEventListener('touchstart', onTouchStart, { passive: true });
    element.addEventListener('touchmove', onTouchMove, { passive: false });
    element.addEventListener('touchend', onTouchEnd, { passive: true });
    element.addEventListener('touchcancel', onTouchEnd, { passive: true });
    window.addEventListener('keydown', onKeyDown);

    return () => {
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchmove', onTouchMove);
      element.removeEventListener('touchend', onTouchEnd);
      element.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled, target]);
}
