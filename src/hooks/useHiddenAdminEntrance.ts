import { useCallback, useRef } from 'react';

/** Clicks required, and the window they must all land in. */
const REQUIRED_CLICKS = 5;
const WINDOW_MS = 5000;

/**
 * The hidden entrance to the protected analytics dashboard.
 *
 * Five clicks on the copyright line within five seconds opens the PIN screen.
 * The behaviour is unchanged from the original footer implementation; it lives
 * here so the legacy site footer and the video feed's sidebar can both carry
 * it without the logic being duplicated or drifting apart.
 */
export function useHiddenAdminEntrance(onTrigger: (() => void) | undefined) {
  const clicks = useRef(0);
  const windowStarted = useRef<number | null>(null);

  return useCallback(() => {
    const now = Date.now();
    if (windowStarted.current === null || now - windowStarted.current > WINDOW_MS) {
      windowStarted.current = now;
      clicks.current = 0;
    }
    clicks.current += 1;
    if (clicks.current === REQUIRED_CLICKS) {
      clicks.current = 0;
      windowStarted.current = null;
      onTrigger?.();
    }
  }, [onTrigger]);
}
