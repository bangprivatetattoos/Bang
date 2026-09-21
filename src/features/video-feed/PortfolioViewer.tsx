import { useCallback, useEffect, useRef } from 'react';
import type { CarouselCard } from './data/carouselAssets';
import { ArrowRightIcon, CalendarIcon, XIcon } from './ui/icons';

interface Props {
  cards: CarouselCard[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  onBook: () => void;
}

const SWIPE_THRESHOLD = 55;
const FOCUSABLE = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Full-screen view of one portfolio piece.
 *
 * Mirrors the artist-gallery viewer's interaction model — arrows and swipe to
 * move through the set, Escape or the close button to leave, a counter, and a
 * booking CTA — rendered in the feed's own design language rather than the
 * legacy site's, since it opens on top of the feed.
 */
export default function PortfolioViewer({ cards, index, onClose, onIndexChange, onBook }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ x: number; y: number } | null>(null);
  const card = cards[index];

  const step = useCallback((delta: number) => {
    if (cards.length === 0) return;
    onIndexChange((index + delta + cards.length) % cards.length);
  }, [cards.length, index, onIndexChange]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); return; }
      if (event.key === 'ArrowLeft') { event.preventDefault(); event.stopPropagation(); step(-1); return; }
      if (event.key === 'ArrowRight') { event.preventDefault(); event.stopPropagation(); step(1); return; }
      // Keep the feed's own up/down handlers from running underneath.
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); event.stopPropagation(); return; }

      if (event.key !== 'Tab' || !panel) return;
      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(element => element.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, [onClose, step]);

  if (!card) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Portfolio piece ${index + 1} of ${cards.length}`}
      tabIndex={-1}
      className="absolute inset-0 z-[60] flex flex-col outline-none"
      style={{
        background: 'rgba(8,8,8,0.97)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        paddingTop: 'max(12px, env(safe-area-inset-top))',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      }}
      // The viewer owns its gestures; the feed must not navigate underneath it.
      onTouchStart={event => {
        event.stopPropagation();
        const touch = event.touches[0];
        gesture.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
      }}
      onTouchMove={event => event.stopPropagation()}
      onTouchEnd={event => {
        event.stopPropagation();
        const start = gesture.current;
        gesture.current = null;
        const touch = event.changedTouches[0];
        if (!start || !touch) return;
        const dx = start.x - touch.clientX;
        const dy = start.y - touch.clientY;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD) step(dx > 0 ? 1 : -1);
        else if (dy < -SWIPE_THRESHOLD) onClose();
      }}
      onWheel={event => event.stopPropagation()}
    >
      <div className="flex items-center justify-between px-4 md:px-6 pb-3 flex-shrink-0">
        <div className="min-w-0">
          <p className="display-font text-[9px] tracking-[0.3em] text-[#626262] uppercase">Portfolio</p>
          <p className="display-font text-[13px] font-bold tracking-[0.2em] text-[#f4f3ef] uppercase truncate">
            {card.category ?? 'BANG PRIVATE TATTOOS'}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-[#858585] text-[11px] tracking-widest tabular-nums">{index + 1} / {cards.length}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="feed-focusable w-11 h-11 grid place-items-center rounded-xl text-[#f4f3ef]"
            style={{ border: '1px solid #383838' }}
          >
            <XIcon />
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-3 md:px-6 min-h-0 relative">
        {cards.length > 1 && (
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous piece"
            className="feed-focusable absolute left-2 md:left-6 z-10 w-11 h-11 grid place-items-center rounded-xl text-[#f4f3ef] bg-black/50"
            style={{ border: '1px solid #383838' }}
          >
            <span className="rotate-180"><ArrowRightIcon /></span>
          </button>
        )}

        <img
          key={card.id}
          src={card.url}
          alt={card.alt}
          className="max-h-full max-w-full object-contain animate-feed-fade-in-up rounded-lg"
        />

        {cards.length > 1 && (
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next piece"
            className="feed-focusable absolute right-2 md:right-6 z-10 w-11 h-11 grid place-items-center rounded-xl text-[#f4f3ef] bg-black/50"
            style={{ border: '1px solid #383838' }}
          >
            <ArrowRightIcon />
          </button>
        )}
      </div>

      <div
        className="flex items-center justify-between gap-4 px-4 md:px-6 pt-3 flex-shrink-0"
        style={{ borderTop: '1px solid #1c1c1c' }}
      >
        <p className="text-[#626262] text-[11px] leading-snug min-w-0 hidden sm:block">
          Every piece is made to order. Start a consultation to discuss your own.
        </p>
        <button
          type="button"
          onClick={onBook}
          className="feed-focusable flex items-center justify-center gap-2 py-3.5 px-6 min-h-11 rounded-xl bg-[#f4f3ef] text-[#101010] text-[12px] font-bold uppercase tracking-wider w-full sm:w-auto"
        >
          <CalendarIcon size={15} /> Book Appointment
        </button>
      </div>
    </div>
  );
}
