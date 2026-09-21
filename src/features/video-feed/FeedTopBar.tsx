import { MenuIcon, SearchIcon, SoundOffIcon, SoundOnIcon } from './ui/icons';

interface Props {
  onOpenSidebar: () => void;
  onToggleDiscovery: () => void;
  discoveryOpen: boolean;
  /** Whether the feed is currently audible. */
  soundOn: boolean;
  onToggleSound: () => void;
}

const TICKER = ['Explore our artists', 'View their work', 'Custom tattoos', 'Studio appointments', 'Home Call'];

/**
 * The translucent top bar. The clip stays visible beneath it: the controls are
 * glass panels rather than an opaque header.
 */
export default function FeedTopBar({ onOpenSidebar, onToggleDiscovery, discoveryOpen, soundOn, onToggleSound }: Props) {
  // Duplicated so the marquee can translate by exactly -50% and loop seamlessly.
  const marquee = [...TICKER, ...TICKER].join('  •  ');

  return (
    // --feed-safe-top adds spacing on top of the inset rather than max()-ing
    // against it: the inset only says where the status hardware ends, so
    // sitting exactly on it still reads as touching the notch or Dynamic Island.
    <div
      className="absolute top-0 left-0 right-0 z-20 flex items-center gap-2 px-3 md:px-5"
      style={{ paddingTop: 'var(--feed-safe-top)' }}
    >
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open menu"
          className="feed-focusable feed-glass-control w-11 h-11 rounded-xl flex items-center justify-center text-[#f4f3ef] flex-shrink-0"
        >
          <MenuIcon />
        </button>
        <span
          className="feed-control-label display-font text-[12px] md:text-[14px] font-black tracking-[0.2em] text-[#f4f3ef] uppercase whitespace-nowrap"
        >
          BANG
        </span>
      </div>

      <button
        type="button"
        onClick={onToggleDiscovery}
        aria-expanded={discoveryOpen}
        aria-label="Explore our artists"
        className="feed-focusable feed-glass-control flex-1 flex items-center gap-2 px-3 rounded-xl overflow-hidden min-w-0 h-11 md:max-w-[420px] md:mx-auto"
      >
        <span className="text-[#b5b5b2] flex-shrink-0"><SearchIcon /></span>
        <span className="overflow-hidden flex-1 min-w-0" aria-hidden="true">
          <span className="animate-feed-ticker inline-block whitespace-nowrap text-[11px] text-[#b5b5b2] tracking-wide">
            {marquee}
          </span>
        </span>
      </button>

      {/* The feed plays with sound, so muting it is a first-class control
          rather than something buried in the menu. */}
      <button
        type="button"
        onClick={onToggleSound}
        aria-label={soundOn ? 'Mute videos' : 'Unmute videos'}
        aria-pressed={soundOn}
        className="feed-focusable feed-glass-control w-11 h-11 rounded-xl flex items-center justify-center text-[#f4f3ef] flex-shrink-0"
      >
        {soundOn ? <SoundOnIcon /> : <SoundOffIcon />}
      </button>

      {/* Balances the bar on wide screens so the ticker stays optically centred.
          Narrowed by the width of the sound control now beside it. */}
      <div className="hidden md:block w-[80px] flex-shrink-0" aria-hidden="true" />
    </div>
  );
}
