import { useCallback, useEffect, useRef, useState } from 'react';
import { CAROUSEL_BATCH_SIZE, getCarouselBatch, type CarouselBatch } from './data/carouselAssets';
import { ArrowUpIcon } from './ui/icons';

interface Props {
  /** Which interlude this is, session-wide. Chooses the batch. */
  interludeIndex: number;
  onForward: () => void;
  onBackward: () => void;
  /** Receives the card's index within the whole collection. */
  onOpenCard: (collectionIndex: number) => void;
  /** Reports carousel analytics without this component knowing the schema. */
  onEvent?: (event: CarouselEvent, detail?: Record<string, string>) => void;
}

export type CarouselEvent =
  | 'carousel_shown'
  | 'carousel_image_impression'
  | 'carousel_manual_swipe'
  | 'carousel_auto_advance'
  | 'carousel_completed'
  | 'carousel_image_clicked';

/** How long each image is held before the carousel moves on. */
const HOLD_MS = 2600;
/** Manual interaction suspends the timer for this long. */
const RESUME_AFTER_MS = 4000;
/** Travel needed to commit a swipe, in either axis. */
const SWIPE_THRESHOLD = 48;
/** A gesture is treated as horizontal only when it clearly dominates. */
const AXIS_RATIO = 1.25;

/**
 * The portfolio interlude.
 *
 * Images run in manifest order — only the videos are shuffled — and each
 * interlude takes the next batch, so a visitor is not shown the same ten
 * pieces every time. The batch advances itself at a calm reading pace and,
 * once the last image has been seen, continues to the next video on its own.
 * The visitor can leave earlier, or take the strip over by hand at any point.
 */
export default function PortfolioInterlude({
  interludeIndex, onForward, onBackward, onOpenCard, onEvent,
}: Props) {
  const [batch] = useState<CarouselBatch>(() => getCarouselBatch(interludeIndex));
  /**
   * Cards whose image would not load.
   *
   * One bad asset must not take the interlude down with it, and a broken
   * image icon in a portfolio strip reads worse than a quiet placeholder.
   */
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedUntil = useRef(0);
  const gesture = useRef<{ x: number; y: number; axis: 'none' | 'x' | 'y' } | null>(null);
  const seen = useRef(new Set<number>());
  const completed = useRef(false);
  const events = useRef(onEvent);
  events.current = onEvent;

  const total = batch.cards.length;

  useEffect(() => {
    events.current?.('carousel_shown', { carousel_batch_id: batch.id });
  }, [batch.id]);

  /** One impression per image per interlude, never repeated. */
  useEffect(() => {
    if (total === 0 || seen.current.has(active)) return;
    seen.current.add(active);
    const card = batch.cards[active];
    events.current?.('carousel_image_impression', { carousel_batch_id: batch.id, ...(card ? { content_id: card.id } : {}) });
  }, [active, batch, total]);

  /** Keeps the active card centred, whether it was reached by hand or timer. */
  useEffect(() => {
    const track = trackRef.current;
    const card = track?.children[active] as HTMLElement | undefined;
    if (!track || !card) return;
    const target = card.offsetLeft - (track.clientWidth - card.clientWidth) / 2;
    track.scrollTo({
      left: Math.max(0, target),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }, [active]);

  const goTo = useCallback((next: number, manual: boolean) => {
    if (total === 0) return;
    const clamped = Math.max(0, Math.min(total - 1, next));
    if (clamped === active) return;
    if (manual) {
      pausedUntil.current = performance.now() + RESUME_AFTER_MS;
      events.current?.('carousel_manual_swipe', { carousel_batch_id: batch.id });
    }
    setActive(clamped);
  }, [active, batch.id, total]);

  /**
   * Auto movement. Advances one image at a time and, on reaching the last of
   * the batch, hands the feed on so the visitor is not left waiting on a
   * strip that has nothing further to show.
   */
  useEffect(() => {
    if (total === 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const timer = window.setInterval(() => {
      if (performance.now() < pausedUntil.current) return;

      if (active >= total - 1) {
        if (completed.current) return;
        completed.current = true;
        events.current?.('carousel_completed', { carousel_batch_id: batch.id });
        onForward();
        return;
      }
      events.current?.('carousel_auto_advance', { carousel_batch_id: batch.id });
      setActive(current => Math.min(total - 1, current + 1));
    }, HOLD_MS);

    return () => window.clearInterval(timer);
  }, [active, total, batch.id, onForward]);

  /**
   * Gesture handling on the strip.
   *
   * The axis is decided once, from whichever direction clearly dominates, so
   * a visitor scrolling sideways through the work never accidentally exits the
   * feed, and a decisive vertical swipe still leaves.
   */
  const onTouchStart = (event: React.TouchEvent) => {
    event.stopPropagation();
    const touch = event.touches[0];
    gesture.current = touch ? { x: touch.clientX, y: touch.clientY, axis: 'none' } : null;
    pausedUntil.current = performance.now() + RESUME_AFTER_MS;
  };

  const onTouchMove = (event: React.TouchEvent) => {
    event.stopPropagation();
    const start = gesture.current;
    const touch = event.touches[0];
    if (!start || !touch) return;
    if (start.axis === 'none') {
      const dx = Math.abs(touch.clientX - start.x);
      const dy = Math.abs(touch.clientY - start.y);
      if (dx > 10 || dy > 10) start.axis = dx > dy * AXIS_RATIO ? 'x' : 'y';
    }
    pausedUntil.current = performance.now() + RESUME_AFTER_MS;
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    event.stopPropagation();
    const start = gesture.current;
    gesture.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;

    const dx = start.x - touch.clientX;
    const dy = start.y - touch.clientY;

    if (start.axis === 'x') {
      if (Math.abs(dx) >= SWIPE_THRESHOLD) goTo(active + (dx > 0 ? 1 : -1), true);
      return;
    }
    if (start.axis === 'y' && Math.abs(dy) >= SWIPE_THRESHOLD) {
      if (dy > 0) onForward();
      else onBackward();
    }
  };

  const onWheel = (event: React.WheelEvent) => {
    // Sideways travel belongs to the strip; vertical travel bubbles to the feed.
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      event.stopPropagation();
      pausedUntil.current = performance.now() + RESUME_AFTER_MS;
    }
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); event.stopPropagation(); goTo(active + 1, true); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); event.stopPropagation(); goTo(active - 1, true); }
  };

  return (
    <section className="absolute inset-0 z-10 bg-[#080808] flex flex-col select-none" aria-label="Portfolio highlights">
      <div className="px-5 md:px-10 flex-shrink-0" style={{ paddingTop: 'max(56px, calc(env(safe-area-inset-top) + 42px))' }}>
        <p className="display-font text-[10px] tracking-[0.28em] text-[#626262] uppercase mb-3">Portfolio Highlights</p>
        <h2 className="display-font text-[clamp(38px,11vw,66px)] font-black text-[#f4f3ef] uppercase leading-[0.92] tracking-tight">
          REAL ART.<br />REAL PEOPLE.<br />LASTING STORIES.
        </h2>
        <p className="text-[#b5b5b2] text-[13px] mt-3 max-w-md">Explore more work from BANG PRIVATE TATTOOS.</p>
      </div>

      <div
        ref={trackRef}
        role="group"
        aria-label={`Portfolio images, ${active + 1} of ${total}`}
        tabIndex={0}
        className="feed-scroll flex-1 overflow-x-auto overflow-y-hidden relative flex items-center mt-5 md:mt-8 outline-none"
        style={{ overscrollBehaviorX: 'contain', scrollSnapType: 'x mandatory' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        onPointerDown={() => { pausedUntil.current = performance.now() + RESUME_AFTER_MS; }}
      >
        {batch.cards.map((card, index) => (
          <button
            key={card.id}
            type="button"
            onClick={() => {
              // Any card opens full screen. Moving along the strip is the job
              // of a swipe, the arrow keys or the auto-advance, so a tap never
              // costs the visitor a second tap to see the piece.
              events.current?.('carousel_image_clicked', { carousel_batch_id: batch.id, content_id: card.id });
              if (index !== active) setActive(index);
              onOpenCard(batch.index * CAROUSEL_BATCH_SIZE + index);
            }}
            aria-label={`View ${card.alt} full screen`}
            aria-current={index === active}
            className="feed-focusable flex-shrink-0 rounded-xl overflow-hidden relative bg-[#161616] p-0 block group transition-all duration-500"
            style={{
              scrollSnapAlign: 'center',
              width: index === active ? 232 : 185,
              height: index === active ? 330 : 264,
              border: `1px solid ${index === active ? 'rgba(244,243,239,0.35)' : '#2a2a2a'}`,
              opacity: index === active ? 1 : 0.62,
              marginLeft: index === 0 ? 'max(20px, calc(50vw - 116px))' : undefined,
              marginRight: index === batch.cards.length - 1 ? 'max(20px, calc(50vw - 116px))' : undefined,
            }}
          >
            {failed.has(card.id) ? (
              // A brand-dark field rather than a broken-image icon.
              <span
                aria-hidden="true"
                className="absolute inset-0"
                style={{ background: 'radial-gradient(120% 90% at 50% 30%, #1d1d1d 0%, #141414 60%, #0e0e0e 100%)' }}
              />
            ) : (
              <img
                src={card.url}
                alt=""
                // Only the neighbourhood is fetched eagerly, so an interlude
                // never stalls the gap between two videos.
                loading={Math.abs(index - active) <= 2 ? 'eager' : 'lazy'}
                decoding="async"
                onError={() => {
                  console.warn(`[carousel] image failed to load: ${card.id}`);
                  setFailed(current => (current.has(card.id) ? current : new Set(current).add(card.id)));
                }}
                className="w-full h-full object-cover"
              />
            )}
            <span className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 50%)' }} />
            {card.category && (
              <span className="absolute bottom-3 left-3 right-3 text-left">
                <span className="display-font text-[9px] font-bold tracking-[0.22em] text-[#f4f3ef] uppercase line-clamp-1">
                  {card.category}
                </span>
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center py-5 flex-shrink-0 gap-3" style={{ paddingBottom: 'max(22px, env(safe-area-inset-bottom))' }}>
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {batch.cards.map((card, index) => (
            <span
              key={card.id}
              className="rounded-full transition-all duration-300"
              style={{
                width: index === active ? 16 : 5,
                height: 5,
                background: index === active ? '#f4f3ef' : '#3a3a3a',
              }}
            />
          ))}
        </div>
        <p className="text-[#3a3a3a] text-[9px] uppercase tracking-[0.2em]">
          Swipe horizontally to explore • Swipe up to continue
        </p>
        <button
          type="button"
          onClick={onForward}
          className="feed-focusable flex flex-col items-center gap-1.5 px-6 py-1 min-h-11"
          aria-label="Continue watching tattoo work"
        >
          <span className="animate-feed-swipe-hint text-[#626262]"><ArrowUpIcon /></span>
          <span className="text-[#626262] text-[10px] uppercase tracking-[0.25em]">Swipe up to continue videos</span>
        </button>
      </div>
    </section>
  );
}
