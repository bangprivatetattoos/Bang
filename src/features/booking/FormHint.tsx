/**
 * The one-line "what to do next" helper.
 *
 * Deliberately small: a single sentence, in the sheet's own charcoal and
 * off-white, sitting next to the control it refers to. It is not a modal, it
 * cannot be dismissed, and it never repeats an animation on a re-render —
 * only a change of message fades, so a visitor typing or tapping is not
 * followed around by a pulsing box.
 *
 * `aria-live="polite"` because the text changes to describe the next required
 * action; a screen reader should hear that when it changes, and never be
 * interrupted mid-sentence.
 */

interface Props {
  /** One sentence. Null renders nothing at all. */
  children: string | null;
  /** `ready` marks the step's requirements met, rather than still pending. */
  tone?: 'pending' | 'ready';
}

export default function FormHint({ children, tone = 'pending' }: Props) {
  return (
    <p
      aria-live="polite"
      // The element stays mounted even when empty, so the live region is
      // already present when the message it announces arrives.
      className="min-h-[18px] mb-3 flex items-center gap-2 text-[12px] leading-snug transition-opacity duration-300"
      style={{ opacity: children ? 1 : 0 }}
    >
      {children && (
        <>
          <span
            aria-hidden="true"
            className="inline-block w-1 h-1 rounded-full flex-shrink-0"
            style={{ background: tone === 'ready' ? '#f4f3ef' : '#858585' }}
          />
          {/* Contrast, not colour alone: the sentence itself says what is
              needed, so the tone only reinforces it. */}
          <span style={{ color: tone === 'ready' ? '#f4f3ef' : '#b5b5b2' }}>{children}</span>
        </>
      )}
    </p>
  );
}
