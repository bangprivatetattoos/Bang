import { useEffect, useRef, useState } from 'react';

/**
 * How much of the viewport the software keyboard is covering.
 *
 * Mobile Safari does not resize the layout viewport when the keyboard opens —
 * it leaves the page the same height and slides it — so a bottom sheet sized
 * against `dvh` has its actions pushed off screen with no event to react to.
 * The visual viewport is the only thing that reports the truth.
 *
 * Progressive enhancement: where `visualViewport` is missing the inset is
 * simply always zero, the sheet keeps its existing `dvh` sizing, and nothing
 * regresses.
 */

/**
 * Below this, a viewport change is a URL bar collapsing or the page settling,
 * not a keyboard. Reacting to those would move the sheet while the visitor is
 * reading it.
 */
const KEYBOARD_THRESHOLD_PX = 120;

export function useKeyboardInset(enabled: boolean): number {
  const [inset, setInset] = useState(0);
  /** Coalesces the burst of events Safari fires through its open animation. */
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) { setInset(0); return; }
    const viewport = typeof window !== 'undefined' ? window.visualViewport : undefined;
    if (!viewport) return;

    const measure = () => {
      frame.current = null;
      // What the layout viewport has that the visual one does not: the
      // keyboard, plus anything else overlaying the bottom.
      const hidden = window.innerHeight - viewport.height - viewport.offsetTop;
      const next = hidden > KEYBOARD_THRESHOLD_PX ? Math.round(hidden) : 0;
      setInset(current => (current === next ? current : next));
    };

    const schedule = () => {
      // One measurement per frame. Safari fires resize continuously while the
      // keyboard animates, and reading layout on each one thrashes.
      if (frame.current !== null) return;
      frame.current = window.requestAnimationFrame(measure);
    };

    measure();
    viewport.addEventListener('resize', schedule);
    viewport.addEventListener('scroll', schedule);
    return () => {
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
      frame.current = null;
      viewport.removeEventListener('resize', schedule);
      viewport.removeEventListener('scroll', schedule);
    };
  }, [enabled]);

  return inset;
}

/**
 * Brings the focused control into view inside one scroll container.
 *
 * Moves that element and nothing else — never the document, never
 * `scrollIntoView`, which walks up the ancestors and takes the feed with it.
 *
 * It acts only when the field is actually obscured, and only on focus, so
 * typing never drags the view around and two competing corrections can never
 * oscillate.
 */
export function useFocusVisibility(
  container: React.RefObject<HTMLElement | null>,
  keyboardInset: number,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;
    const element = container.current;
    if (!element) return;

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || !('tagName' in target)) return;
      if (!/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      // One frame later: on iOS the keyboard has not finished reporting its
      // size at focus time, so measuring now would use a stale viewport.
      window.requestAnimationFrame(() => {
        const box = target.getBoundingClientRect();
        const visibleBottom = window.innerHeight - keyboardInset;
        // A margin so the field does not sit flush against the keyboard.
        const overlap = box.bottom + 16 - visibleBottom;
        if (overlap <= 0) return;
        element.scrollTop += overlap;
      });
    };

    element.addEventListener('focusin', onFocusIn);
    return () => element.removeEventListener('focusin', onFocusIn);
  }, [container, keyboardInset, enabled]);
}

/**
 * Whether a scroll container has meaningful content below the fold.
 *
 * Driven by real scroll and resize state rather than polling, and it reports
 * false the moment the visitor has read far enough — so the affordance appears
 * only where something is genuinely hidden, and leaves as soon as it is not.
 */
export function useHasOverflowBelow(
  container: React.RefObject<HTMLElement | null>,
  /** Re-measures when this changes, e.g. on a step change. */
  key: unknown,
): boolean {
  const [below, setBelow] = useState(false);

  useEffect(() => {
    const element = container.current;
    if (!element) return;

    const measure = () => {
      const remaining = element.scrollHeight - element.clientHeight - element.scrollTop;
      // Under a third of a screen left is not worth pointing at.
      setBelow(remaining > Math.max(48, element.clientHeight * 0.33));
    };

    measure();
    element.addEventListener('scroll', measure, { passive: true });

    // Content grows as steps change and images load, so the answer is
    // re-derived from the element rather than assumed to be stable.
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(element);
    for (const child of Array.from(element.children)) observer?.observe(child);

    return () => {
      element.removeEventListener('scroll', measure);
      observer?.disconnect();
    };
  }, [container, key]);

  return below;
}
