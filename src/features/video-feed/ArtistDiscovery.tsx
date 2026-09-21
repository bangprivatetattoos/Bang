import { useEffect, useMemo, useRef, useState } from 'react';
import { ARTISTS } from '../../data/artists';
import { ChevronRightIcon, XIcon } from './ui/icons';

interface Props {
  onClose: () => void;
  /** Opens that artist's existing gallery route. */
  onOpenArtist: (artistId: string) => void;
}

/**
 * Real style categories, derived from the specialties the artists actually
 * list. Nothing here is invented: selecting one filters to the artists whose
 * own profile claims that style.
 */
function useCategories() {
  return useMemo(() => {
    const counts = new Map<string, number>();
    for (const artist of ARTISTS) {
      for (const specialty of artist.specialties) {
        counts.set(specialty, (counts.get(specialty) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([specialty]) => specialty);
  }, []);
}

export default function ArtistDiscovery({ onClose, onOpenArtist }: Props) {
  const categories = useCategories();
  const [category, setCategory] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const artists = category ? ARTISTS.filter(artist => artist.specialties.includes(category)) : ARTISTS;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKeyDown, true);
    // Deferred so the click that opened the control does not immediately close it.
    const timer = window.setTimeout(() => document.addEventListener('pointerdown', onPointerDown), 0);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      window.clearTimeout(timer);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [onClose]);

  return (
    <div
      className="absolute left-3 right-3 z-30 animate-feed-drop-in md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[min(720px,92vw)]"
      style={{ top: 'calc(max(14px, env(safe-area-inset-top)) + 54px)' }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Browse artists"
        className="rounded-xl overflow-hidden flex flex-col"
        style={{
          background: 'rgba(16,16,16,0.97)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid #383838',
          boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
          maxHeight: 'calc(100dvh - 180px)',
        }}
      >
        <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid #252525' }}>
          <p className="display-font text-[13px] font-bold tracking-[0.22em] text-[#f4f3ef] uppercase">Browse Artists</p>
          <p className="text-[#626262] text-[11px] mt-0.5">
            {artists.length} {artists.length === 1 ? 'artist' : 'artists'} — tap to view their work
          </p>
        </div>

        {categories.length > 0 && (
          <div className="px-4 pt-3 pb-2 flex-shrink-0" style={{ borderBottom: '1px solid #1c1c1c' }}>
            <p className="display-font text-[10px] font-bold tracking-[0.2em] text-[#626262] uppercase mb-2">Explore Galleries</p>
            <div className="feed-scroll flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setCategory(null)}
                aria-pressed={category === null}
                className={`feed-focusable flex-shrink-0 px-3 py-2 rounded-lg text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap transition-colors ${category === null ? 'bg-[#f4f3ef] text-[#101010]' : 'text-[#b5b5b2] hover:bg-[#1a1a1a]'}`}
                style={{ border: `1px solid ${category === null ? 'transparent' : '#383838'}` }}
              >
                All
              </button>
              {categories.map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(current => (current === item ? null : item))}
                  aria-pressed={category === item}
                  className={`feed-focusable flex-shrink-0 px-3 py-2 rounded-lg text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap transition-colors ${category === item ? 'bg-[#f4f3ef] text-[#101010]' : 'text-[#b5b5b2] hover:bg-[#1a1a1a]'}`}
                  style={{ border: `1px solid ${category === item ? 'transparent' : '#383838'}` }}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="feed-scroll overflow-y-auto md:grid md:grid-cols-2">
          {artists.map(artist => (
            <button
              key={artist.id}
              type="button"
              onClick={() => onOpenArtist(artist.id)}
              className="feed-focusable w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1a1a1a] transition-colors text-left min-h-11"
              style={{ borderBottom: '1px solid #1c1c1c' }}
            >
              <img
                src={artist.portrait}
                alt=""
                loading="lazy"
                className="w-10 h-10 rounded-full object-cover object-top bg-[#383838] flex-shrink-0"
              />
              <span className="flex-1 min-w-0">
                <span className="block text-[#f4f3ef] text-[13px] font-medium truncate">{artist.name}</span>
                <span className="block text-[#858585] text-[11px] truncate">{artist.specialties.join(' • ')}</span>
              </span>
              <span
                className="hidden sm:inline text-[10px] text-[#b5b5b2] px-2 py-0.5 rounded uppercase tracking-wide font-medium flex-shrink-0"
                style={{ border: '1px solid #383838' }}
              >
                View Gallery
              </span>
              <span className="text-[#626262] flex-shrink-0"><ChevronRightIcon /></span>
            </button>
          ))}
        </div>

        <div className="flex justify-end px-4 py-2 flex-shrink-0" style={{ borderTop: '1px solid #252525' }}>
          <button
            type="button"
            onClick={onClose}
            className="feed-focusable flex items-center gap-1.5 text-[#626262] text-[11px] hover:text-[#858585] transition-colors px-2 py-2"
          >
            <XIcon /> Close
          </button>
        </div>
      </div>
    </div>
  );
}
