import { useEffect, useRef, useState } from 'react';
import type { ReactionKind, ReactionState } from './types';
import { HeartIcon, ThumbUpIcon } from './ui/icons';
import { MOCK_ENGAGEMENT_ENABLED, mockReactionCount } from './data/mockEngagement';

interface Props {
  state: ReactionState;
  onChange: (reaction: ReactionKind | null) => void;
  /** Content id, used only for the development-only placeholder count. */
  contentId: string;
}

const LONG_PRESS_MS = 420;
/** Matches the pop animation in index.css. */
const POP_MS = 520;

const OPTIONS: Array<{ kind: ReactionKind; label: string }> = [
  { kind: 'like', label: 'Like' },
  { kind: 'love', label: 'Love' },
];

/**
 * Compact reaction control.
 *
 * A tap leaves Love, the common case, and tapping again removes it. Press and
 * hold — or use the picker's own buttons via the keyboard — to choose Like
 * instead. Active reactions take the warm accent and a short pop with an
 * expanding ring; both are suppressed under prefers-reduced-motion.
 *
 * Counts come from the reactions endpoint and are real: one row per content id
 * per anonymous visitor, so repeated tapping cannot inflate a total. When the
 * count is zero or not yet known, no number is rendered, because an invented
 * engagement figure would be a claim about real visitors.
 */
export default function ReactionPicker({ state, onChange, contentId }: Props) {
  const [open, setOpen] = useState(false);
  const [popping, setPopping] = useState(false);
  const longPress = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const realTotal = state.counts ? state.counts.like + state.counts.love : null;
  // Development-only placeholder, never present in a production build.
  const total = realTotal ?? (MOCK_ENGAGEMENT_ENABLED ? mockReactionCount(contentId) : null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); }
    };
    const timer = window.setTimeout(() => document.addEventListener('pointerdown', onPointerDown), 0);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  const clearLongPress = () => {
    if (longPress.current !== null) {
      window.clearTimeout(longPress.current);
      longPress.current = null;
    }
  };

  useEffect(() => clearLongPress, []);

  const apply = (reaction: ReactionKind | null) => {
    setOpen(false);
    if (reaction !== null) {
      setPopping(true);
      window.setTimeout(() => setPopping(false), POP_MS);
    }
    onChange(reaction);
  };

  const startPress = () => {
    clearLongPress();
    longPress.current = window.setTimeout(() => {
      suppressClick.current = true;
      setOpen(true);
    }, LONG_PRESS_MS);
  };

  const endPress = () => clearLongPress();

  const handleClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    apply(state.mine ? null : 'love');
  };

  const active = state.mine !== null;
  const Icon = state.mine === 'like' ? ThumbUpIcon : HeartIcon;
  const reactionLabel = state.mine === 'like' ? 'Like' : 'Love';

  return (
    <div ref={containerRef} className="relative flex flex-col items-center gap-1">
      {open && (
        <div
          role="group"
          aria-label="Choose a reaction"
          className="feed-glass-control absolute right-0 bottom-full mb-2 flex items-center gap-1 px-1.5 py-1.5 rounded-full animate-feed-fade-in-up"
        >
          {OPTIONS.map(option => {
            const OptionIcon = option.kind === 'like' ? ThumbUpIcon : HeartIcon;
            const selected = state.mine === option.kind;
            return (
              <button
                key={option.kind}
                type="button"
                onClick={() => apply(selected ? null : option.kind)}
                aria-pressed={selected}
                aria-label={selected ? `Remove ${option.label}` : option.label}
                className="feed-focusable w-11 h-11 rounded-full grid place-items-center transition-colors hover:bg-white/10"
                style={selected ? { color: 'var(--feed-accent)' } : { color: '#f4f3ef' }}
              >
                <OptionIcon filled={selected} size={20} />
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={handleClick}
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onPointerCancel={endPress}
        onContextMenu={event => event.preventDefault()}
        aria-pressed={active}
        aria-label={active ? `${reactionLabel} — tap to remove, hold to change` : 'React — tap to love, hold to choose'}
        className="feed-focusable flex flex-col items-center gap-1"
      >
        <span className="feed-glass-control relative w-11 h-11 rounded-full grid place-items-center">
          {popping && <span className="feed-heart-ring" aria-hidden="true" />}
          <span
            className={popping ? 'animate-feed-heart-pop' : undefined}
            // Only set when active: an inline colour would outrank the pop
            // animation's own accent, which is the feedback for the tap.
            style={active ? { color: 'var(--feed-accent)' } : undefined}
          >
            <Icon filled={active} size={22} />
          </span>
        </span>
        {total !== null && total > 0 && (
          <span className="feed-control-label display-font text-[10px] tracking-wide text-[#f4f3ef] tabular-nums">
            {total.toLocaleString('en-US')}
          </span>
        )}
      </button>
    </div>
  );
}
