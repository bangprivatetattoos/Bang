import { useState } from 'react';
import { ARTISTS } from '../data/artists';
import { useInView } from '../hooks/useInView';
import ImageViewer from '../components/ImageViewer';
import { trackAnalytics } from '../analytics/client';

interface Props {
  artistId: string;
  onNavigate: (page: string, id?: string) => void;
}

export default function ArtistDetail({ artistId, onNavigate }: Props) {
  const artist = ARTISTS.find(a => a.id === artistId) ?? ARTISTS[0];
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const { ref: heroRef, inView: heroVisible } = useInView(0.05);
  const { ref: galleryRef, inView: galleryVisible } = useInView(0.05);

  const artistIndex = ARTISTS.findIndex(a => a.id === artistId);
  const prev = ARTISTS[artistIndex - 1];
  const next = ARTISTS[artistIndex + 1];

  return (
    <div className="min-h-screen bg-[#111111]">
      {/* Hero */}
      <section className="relative min-h-screen flex flex-col" style={{ paddingTop: 'max(72px, env(safe-area-inset-top))' }}>
        {/* Background portrait — desktop */}
        <div className="absolute inset-0 hidden lg:block">
          <img
            src={artist.portrait.replace('w=800', 'w=1400')}
            alt={artist.name}
            className="w-full h-full object-cover object-center"
            style={{ filter: 'brightness(0.25)' }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#111111] via-[#111111]/60 to-transparent" />
        </div>

        <div
          ref={heroRef}
          className="relative max-w-[1400px] mx-auto px-5 md:px-8 lg:px-12 pt-16 pb-12 lg:pb-24 flex flex-col lg:flex-row lg:items-end gap-12 lg:gap-0"
        >
          {/* Portrait — mobile/tablet */}
          <div className={`lg:hidden w-full h-[60vw] max-h-96 bg-[#1c1c1c] overflow-hidden ${heroVisible ? 'animate-fade-in' : 'opacity-0'}`}>
            <img src={artist.portrait} alt={artist.name} className="w-full h-full object-cover object-top" />
          </div>

          {/* Info */}
          <div className="lg:w-1/2">
            <p className={`text-[10px] tracking-[0.35em] uppercase text-[#858582] font-body mb-4 ${heroVisible ? 'animate-fade-up' : 'opacity-0'}`}>
              {artist.role}
            </p>
            <h1 className={`font-display font-900 text-[16vw] md:text-[12vw] lg:text-[9vw] uppercase leading-none tracking-tight text-[#f5f5f2] mb-6 ${heroVisible ? 'animate-fade-up delay-100' : 'opacity-0'}`}>
              {artist.name.split(' ').map((w, i) => <span key={i} className="block">{w}</span>)}
            </h1>
            <div className={`flex flex-wrap gap-2 mb-8 ${heroVisible ? 'animate-fade-up delay-200' : 'opacity-0'}`}>
              {artist.specialties.map(s => (
                <span key={s} className="text-[10px] tracking-[0.2em] uppercase font-body text-[#b7b7b2] border border-white/12 px-3 py-1.5">
                  {s}
                </span>
              ))}
            </div>
            <p className={`font-body text-[#b7b7b2] text-sm leading-relaxed max-w-md mb-10 ${heroVisible ? 'animate-fade-up delay-300' : 'opacity-0'}`}>
              {artist.bio}
            </p>
            <div className={`flex flex-col sm:flex-row gap-3 ${heroVisible ? 'animate-fade-up delay-400' : 'opacity-0'}`}>
              <button
                onClick={() => { onNavigate('booking', artist.id); window.scrollTo({ top: 0 }); }}
                className="bg-[#f5f5f2] text-[#111111] font-body font-600 text-[11px] tracking-[0.2em] uppercase px-8 py-3.5 hover:bg-white transition-colors"
              >
                Book {artist.name.split(' ')[0]}
              </button>
              {artist.instagram && (
                <a
                  href={`https://instagram.com/${artist.instagram.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] tracking-[0.2em] uppercase font-body text-[#858582] border border-white/12 hover:border-white/30 hover:text-[#f5f5f2] transition-all px-6 py-3.5 text-center"
                >
                  {artist.instagram} ↗
                </a>
              )}
            </div>
          </div>

          {/* Portrait — desktop right side */}
          <div className="hidden lg:block lg:absolute lg:right-0 lg:bottom-0 lg:w-[42%] h-[85vh]">
            <img
              src={artist.portrait.replace('w=800', 'w=900')}
              alt={artist.name}
              className={`w-full h-full object-cover object-top ${heroVisible ? 'animate-fade-in delay-200' : 'opacity-0'}`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-transparent to-transparent" />
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="bg-[#111111] py-16 md:py-24">
        <div className="max-w-[1400px] mx-auto px-5 md:px-8 lg:px-12">
          <div
            ref={galleryRef}
            className={`mb-12 ${galleryVisible ? 'animate-fade-up' : 'opacity-0'}`}
          >
            <p className="text-[10px] tracking-[0.35em] uppercase text-[#858582] font-body mb-2">Portfolio</p>
            <h2 className="font-display font-900 text-[12vw] md:text-[8vw] lg:text-[5vw] uppercase leading-none text-[#f5f5f2]">
              SELECTED WORK
            </h2>
          </div>

          {/* Masonry-style grid */}
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-3 space-y-3">
            {artist.gallery.map((img, i) => (
              <div
                key={i}
                className="break-inside-avoid relative group cursor-pointer overflow-hidden bg-[#1c1c1c]"
                onClick={() => { trackAnalytics('artist_gallery_open', { entityType: 'artist', entityId: artist.id, metadata: { artist_name: artist.name } }); setViewerIndex(i); }}
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <img
                  src={img.url}
                  alt={img.alt}
                  loading="lazy"
                  className="w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  style={{ aspectRatio: img.orientation === 'portrait' ? '3/4' : '4/3' }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-end p-4 opacity-0 group-hover:opacity-100">
                  <span className="text-[10px] tracking-[0.2em] uppercase font-body text-[#f5f5f2]">View →</span>
                </div>
              </div>
            ))}
          </div>

          {/* Book CTA after gallery */}
          <div className="mt-16 pt-12 border-t border-white/06 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <h3 className="font-display font-800 text-4xl md:text-5xl uppercase text-[#f5f5f2] leading-none mb-1">Interested in working with {artist.name.split(' ')[0]}?</h3>
            </div>
            <button
              onClick={() => { onNavigate('booking', artist.id); window.scrollTo({ top: 0 }); }}
              className="shrink-0 bg-[#f5f5f2] text-[#111111] font-body font-600 text-[11px] tracking-[0.2em] uppercase px-8 py-3.5 hover:bg-white transition-colors"
            >
              Book This Artist →
            </button>
          </div>
        </div>
      </section>

      {/* Prev/Next artists */}
      <div className="border-t border-white/06 grid grid-cols-2 divide-x divide-white/06">
        {prev ? (
          <button
            onClick={() => { onNavigate('artist-detail', prev.id); window.scrollTo({ top: 0 }); }}
            className="flex flex-col items-start p-6 md:p-8 hover:bg-[#171717] transition-colors group text-left"
          >
            <p className="text-[9px] tracking-[0.25em] uppercase text-[#858582] font-body mb-2">← Previous</p>
            <p className="font-display font-700 text-2xl md:text-3xl uppercase text-[#f5f5f2] group-hover:text-white transition-colors leading-none">{prev.name}</p>
            <p className="text-[10px] text-[#858582] font-body mt-1">{prev.specialties[0]}</p>
          </button>
        ) : <div />}
        {next ? (
          <button
            onClick={() => { onNavigate('artist-detail', next.id); window.scrollTo({ top: 0 }); }}
            className="flex flex-col items-end p-6 md:p-8 hover:bg-[#171717] transition-colors group text-right"
          >
            <p className="text-[9px] tracking-[0.25em] uppercase text-[#858582] font-body mb-2">Next →</p>
            <p className="font-display font-700 text-2xl md:text-3xl uppercase text-[#f5f5f2] group-hover:text-white transition-colors leading-none">{next.name}</p>
            <p className="text-[10px] text-[#858582] font-body mt-1">{next.specialties[0]}</p>
          </button>
        ) : <div />}
      </div>

      {/* Image viewer */}
      {viewerIndex !== null && (
        <ImageViewer
          images={artist.gallery}
          index={viewerIndex}
          artistName={artist.name}
          onClose={() => setViewerIndex(null)}
          onPrev={() => setViewerIndex(i => Math.max(0, (i ?? 0) - 1))}
          onNext={() => setViewerIndex(i => Math.min(artist.gallery.length - 1, (i ?? 0) + 1))}
          onBook={() => { setViewerIndex(null); onNavigate('booking', artist.id); window.scrollTo({ top: 0 }); }}
        />
      )}
    </div>
  );
}
