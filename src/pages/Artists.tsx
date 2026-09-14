import { ARTISTS } from '../data/artists';
import { useInView } from '../hooks/useInView';

interface Props {
  onNavigate: (page: string, id?: string) => void;
}

function ArtistRow({ artist, index, onNavigate }: { artist: typeof ARTISTS[0]; index: number; onNavigate: (page: string, id?: string) => void }) {
  const { ref, inView } = useInView(0.08);
  const even = index % 2 === 0;
  const isFeature = index === 8;

  if (isFeature) {
    return (
      <div
        ref={ref}
        className={`relative border-b border-white/06 overflow-hidden ${inView ? 'animate-fade-in' : 'opacity-0'}`}
      >
        <div className="relative h-[60vw] md:h-[45vw] max-h-[600px] overflow-hidden bg-[#1c1c1c]">
          <img
            src={artist.portrait.replace('w=800', 'w=1600')}
            alt={artist.name}
            loading="lazy"
            className="w-full h-full object-cover object-center"
            style={{ filter: 'brightness(0.35)' }}
          />
          <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-12 lg:p-16">
            <div className="max-w-[1400px] mx-auto w-full">
              <p className="text-[9px] tracking-[0.3em] uppercase text-[#858582] font-body mb-2">0{index + 1} / {artist.role}</p>
              <h2 className="font-display font-900 text-[16vw] md:text-[12vw] uppercase leading-none text-[#f5f5f2] mb-4">{artist.name}</h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6">
                {artist.specialties.map(s => (
                  <span key={s} className="text-[10px] tracking-[0.2em] uppercase font-body text-[#b7b7b2]">{s}</span>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => { onNavigate('artist-detail', artist.id); window.scrollTo({ top: 0 }); }}
                  className="text-[11px] tracking-[0.2em] uppercase font-body font-500 border border-white/25 text-[#f5f5f2] hover:bg-white/10 transition-all px-6 py-2.5 text-center"
                >
                  View Gallery →
                </button>
                <button
                  onClick={() => { onNavigate('booking', artist.id); window.scrollTo({ top: 0 }); }}
                  className="text-[11px] tracking-[0.2em] uppercase font-body font-500 bg-[#f5f5f2] text-[#111111] hover:bg-white transition-colors px-6 py-2.5"
                >
                  Book {artist.name.split(' ')[0]}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={`border-b border-white/06 ${inView ? 'animate-fade-up' : 'opacity-0'}`}
      style={{ animationDelay: `${(index % 4) * 0.05}s` }}
    >
      <div className={`max-w-[1400px] mx-auto flex flex-col ${even ? 'md:flex-row' : 'md:flex-row-reverse'} gap-0`}>
        {/* Image */}
        <div className="md:w-[45%] lg:w-[40%] overflow-hidden bg-[#1c1c1c]">
          <div className="relative h-[70vw] md:h-full min-h-[380px] group cursor-pointer" onClick={() => { onNavigate('artist-detail', artist.id); window.scrollTo({ top: 0 }); }}>
            <img
              src={artist.portrait}
              alt={artist.name}
              loading="lazy"
              className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300" />
          </div>
        </div>

        {/* Info */}
        <div className={`md:w-[55%] lg:w-[60%] flex flex-col justify-center p-6 md:p-10 lg:p-16 ${even ? 'md:pl-10 lg:pl-16' : 'md:pr-10 lg:pr-16'}`}>
          <p className="text-[9px] tracking-[0.3em] uppercase text-[#858582] font-body mb-3">
            0{index + 1} · {artist.role}
          </p>
          <h2 className="font-display font-900 text-[13vw] md:text-[7vw] lg:text-[5.5vw] uppercase leading-none text-[#f5f5f2] mb-5">
            {artist.name}
          </h2>
          <div className="flex flex-wrap gap-2 mb-6">
            {artist.specialties.map(s => (
              <span key={s} className="text-[10px] tracking-[0.2em] uppercase font-body text-[#b7b7b2] border border-white/10 px-2.5 py-1">
                {s}
              </span>
            ))}
          </div>
          <p className="font-body text-[#b7b7b2] text-sm leading-relaxed mb-8 max-w-md">
            {artist.bio}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => { onNavigate('artist-detail', artist.id); window.scrollTo({ top: 0 }); }}
              className="text-[11px] tracking-[0.2em] uppercase font-body font-500 border border-white/15 text-[#f5f5f2] hover:border-white/40 hover:bg-white/05 transition-all px-6 py-2.5 text-center"
            >
              View Gallery →
            </button>
            <button
              onClick={() => { onNavigate('booking', artist.id); window.scrollTo({ top: 0 }); }}
              className="text-[11px] tracking-[0.2em] uppercase font-body font-500 bg-[#f5f5f2] text-[#111111] hover:bg-white transition-colors px-6 py-2.5"
            >
              Book This Artist
            </button>
          </div>
          {artist.instagram && (
            <a
              href={`https://instagram.com/${artist.instagram.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] tracking-[0.15em] uppercase text-[#858582] hover:text-[#f5f5f2] transition-colors mt-4 font-body inline-block"
            >
              {artist.instagram} ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Artists({ onNavigate }: Props) {
  const { ref: headerRef, inView: headerVisible } = useInView(0.1);

  return (
    <div className="min-h-screen bg-[#111111]" style={{ paddingTop: 'max(72px, env(safe-area-inset-top))' }}>
      {/* Header */}
      <div ref={headerRef} className="max-w-[1400px] mx-auto px-5 md:px-8 lg:px-12 pt-16 pb-12 border-b border-white/06">
        <p className={`text-[10px] tracking-[0.35em] uppercase text-[#858582] font-body mb-4 ${headerVisible ? 'animate-fade-up' : 'opacity-0'}`}>
          The Studio
        </p>
        <h1 className={`font-display font-900 text-[20vw] md:text-[14vw] lg:text-[10vw] uppercase leading-none tracking-tight text-[#f5f5f2] ${headerVisible ? 'animate-fade-up delay-100' : 'opacity-0'}`}>
          ARTISTS
        </h1>
        <p className={`font-body text-[#b7b7b2] text-sm max-w-lg leading-relaxed mt-6 ${headerVisible ? 'animate-fade-up delay-200' : 'opacity-0'}`}>
          Ten of the most sought-after tattoo artists working today — each with a distinct vision, a rigorous practice, and a waitlist that speaks for itself.
        </p>
      </div>

      {/* Artist list */}
      <div>
        {ARTISTS.map((artist, i) => (
          <ArtistRow key={artist.id} artist={artist} index={i} onNavigate={onNavigate} />
        ))}
      </div>

      {/* Bottom CTA */}
      <div className="max-w-[1400px] mx-auto px-5 md:px-8 lg:px-12 py-20 text-center">
        <p className="font-body text-[#858582] text-sm mb-3">Not sure which artist is right for you?</p>
        <h2 className="font-display font-800 text-4xl md:text-5xl uppercase text-[#f5f5f2] leading-none mb-8">
          LET US RECOMMEND ONE.
        </h2>
        <button
          onClick={() => { onNavigate('booking'); window.scrollTo({ top: 0 }); }}
          className="bg-[#f5f5f2] text-[#111111] font-body font-600 text-[11px] tracking-[0.2em] uppercase px-8 py-4 hover:bg-white transition-colors"
        >
          Book Appointment →
        </button>
      </div>
    </div>
  );
}
