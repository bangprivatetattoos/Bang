import { useEffect, useState } from 'react';
import { ArrowUpIcon } from './ui/icons';

interface Props {
  /** True only while the visitor is still on the opening clip. */
  onFirstItem: boolean;
  /** True once any feed swipe has succeeded during this arrival. */
  hasSwiped: boolean;
}

const DELAY_MS = 5000;

/**
 * The swipe-up guide.
 *
 * Shown on the opening clip of every arrival, five seconds in, so a visitor
 * landing from an advert is always told how the feed works. The first
 * successful swipe retires it for the rest of that visit — it teaches the
 * gesture once, then gets out of the way.
 */
export default function SwipeGuide({ onFirstItem, hasSwiped }: Props) {
  const [due, setDue] = useState(false);

  useEffect(() => {
    if (!onFirstItem || hasSwiped) { setDue(false); return; }
    const timer = window.setTimeout(() => setDue(true), DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [onFirstItem, hasSwiped]);

  if (!due || hasSwiped || !onFirstItem) return null;

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col items-center justify-end pointer-events-none"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 160px)' }}
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-2">
        <span className="animate-feed-swipe-hint text-[#f4f3ef]"><ArrowUpIcon size={22} /></span>
        <div
          className="px-5 py-3 text-center rounded-xl"
          style={{
            background: 'rgba(8,8,8,0.70)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <p className="display-font text-[13px] font-bold tracking-[0.2em] text-[#f4f3ef] uppercase">Swipe up</p>
          <p className="text-[#858585] text-[11px] mt-0.5">Discover more tattoo work</p>
        </div>
      </div>
    </div>
  );
}
