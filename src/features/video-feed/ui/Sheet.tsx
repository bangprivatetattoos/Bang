import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useKeyboardInset } from '../../../hooks/useKeyboardViewport';
import { XIcon } from './icons';

interface SheetProps {
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /** Accessible name when no visible title is rendered. */
  label?: string;
  /** `wide` gives the booking journey room for its grids on large screens. */
  size?: 'default' | 'wide';
  children: ReactNode;
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Sheets open over the feed, which already locks the document, and over the
 * conventional pages, which do not. Counting open sheets means the lock is
 * released exactly once, however they are nested or dismissed.
 */
let openSheets = 0;

/**
 * The feed's bottom sheet.
 *
 * Mobile keeps the approved bottom-sheet treatment; from tablet width up it
 * becomes a centred panel so a 1440px browser is not asked to read a phone
 * layout. Either way it is a modal dialog: focus is trapped inside it, Escape
 * and the backdrop dismiss it, and it sizes against the dynamic viewport so an
 * open iOS keyboard cannot push its actions off screen.
 */
export default function Sheet({ onClose, title, subtitle, label, size = 'default', children }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  /**
   * Mobile Safari does not shrink the layout viewport for the keyboard — it
   * slides the page — so a panel sized against dvh has its actions pushed off
   * screen. The visual viewport reports what is really visible.
   */
  const keyboardInset = useKeyboardInset(true);

  useEffect(() => {
    openSheets += 1;
    document.body.classList.add('sheet-open');
    return () => {
      openSheets = Math.max(0, openSheets - 1);
      if (openSheets === 0) document.body.classList.remove('sheet-open');
    };
  }, []);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;

      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(element => element.offsetParent !== null);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end md:items-center md:justify-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-[3px] cursor-default"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : label}
        tabIndex={-1}
        className={`relative animate-feed-slide-bottom flex flex-col rounded-t-[28px] overflow-hidden w-full md:rounded-[28px] md:animate-feed-fade-in-up outline-none ${size === 'wide' ? 'md:w-[min(780px,94vw)]' : 'md:w-[min(600px,92vw)]'}`}
        style={{
          // A cinematic panel rather than a browser form: it belongs to the
          // video experience it opens over.
          background: 'linear-gradient(180deg, #1a1a1a 0%, #151515 100%)',
          border: '1px solid rgba(244,243,239,0.10)',
          boxShadow: '0 -18px 60px rgba(0,0,0,0.55)',
          // The panel shell stays put; only its ceiling moves, so the content
          // inside scrolls rather than the sheet jumping as the keyboard
          // animates.
          maxHeight: keyboardInset > 0
            ? `min(91dvh, 900px, calc(100dvh - ${keyboardInset}px - 12px))`
            : 'min(91dvh, 900px)',
        }}
      >
        {/* Drag affordance — decorative; the sheet is dismissed by the close
            button, the backdrop or Escape, all of which are reachable. */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0 md:hidden" aria-hidden="true">
          <div className="w-10 h-[3px] rounded-full bg-[#4a4a4a]" />
        </div>

        {title ? (
          <div className="px-5 pb-4 pt-3 flex items-start justify-between flex-shrink-0" style={{ borderBottom: '1px solid #252525' }}>
            <div className="min-w-0">
              <h2 id={titleId} className="display-font text-[24px] font-bold text-[#f4f3ef] uppercase tracking-wide leading-tight">{title}</h2>
              {subtitle && <p className="text-[#858585] text-[12px] mt-0.5">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="feed-focusable text-[#858585] hover:text-[#f4f3ef] transition-colors grid place-items-center w-11 h-11 -mr-2 -mt-1 flex-shrink-0"
            >
              <XIcon />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="feed-focusable absolute right-2 top-2 z-10 text-[#858585] hover:text-[#f4f3ef] transition-colors grid place-items-center w-11 h-11"
          >
            <XIcon />
          </button>
        )}

        {children}
      </div>
    </div>
  );
}
