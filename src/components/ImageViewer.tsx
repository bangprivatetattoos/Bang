import { useEffect, useCallback } from 'react';
import type { GalleryImage } from '../data/artists';

interface Props {
  images: GalleryImage[];
  index: number;
  artistName: string;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onBook: () => void;
}

export default function ImageViewer({ images, index, artistName, onClose, onPrev, onNext, onBook }: Props) {
  const img = images[index];

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft') onPrev();
    if (e.key === 'ArrowRight') onNext();
  }, [onClose, onPrev, onNext]);

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [handleKey]);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/95 backdrop-blur-sm" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-4 shrink-0">
        <div>
          <p className="text-[10px] tracking-[0.2em] text-[#858582] uppercase font-body">Artist</p>
          <p className="text-sm font-display font-700 tracking-widest text-[#f5f5f2] uppercase">{artistName}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[#858582] text-xs tracking-widest font-body">{index + 1} / {images.length}</span>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center border border-white/10 hover:border-white/30 transition-colors rounded-sm"
            aria-label="Close viewer"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1L13 13M13 1L1 13" stroke="#f5f5f2" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Image */}
      <div className="flex-1 flex items-center justify-center px-4 min-h-0 relative">
        <button onClick={onPrev} className="absolute left-2 md:left-6 z-10 w-10 h-10 flex items-center justify-center border border-white/10 hover:border-white/30 transition-colors rounded-sm bg-black/40" aria-label="Previous">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="#f5f5f2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <img
          key={index}
          src={img.url.replace('w=800', 'w=1200').replace('w=600', 'w=1200')}
          alt={img.alt}
          className="max-h-full max-w-full object-contain animate-fade-in"
          style={{ maxHeight: 'calc(100vh - 180px)' }}
        />
        <button onClick={onNext} className="absolute right-2 md:right-6 z-10 w-10 h-10 flex items-center justify-center border border-white/10 hover:border-white/30 transition-colors rounded-sm bg-black/40" aria-label="Next">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 3L11 8L6 13" stroke="#f5f5f2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-5 py-4 shrink-0 border-t border-white/5">
        <p className="text-[11px] text-[#858582] font-body">{img.alt}</p>
        <button
          onClick={onBook}
          className="text-[11px] tracking-[0.2em] uppercase font-body font-500 text-[#f5f5f2] border border-white/20 hover:border-white/50 hover:bg-white/5 transition-all px-4 py-2"
        >
          Book {artistName.split(' ')[0]} →
        </button>
      </div>
    </div>
  );
}
