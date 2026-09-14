import { useState, useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ARTISTS, WORK_IMAGES } from '../data/artists';
import { siteContact, whatsappUrl } from '../data/siteContact';
import { useInView } from '../hooks/useInView';
import ImageViewer from '../components/ImageViewer';
import { trackAnalytics } from '../analytics/client';

type Page = 'home' | 'artists' | 'artist-detail' | 'booking';

interface Props {
  onNavigate: (page: Page, id?: string) => void;
  onOpenInsights?: () => void;
}

/* ── Hero ── */
const HERO_VIDEO = new URL('../../hero video.mp4', import.meta.url).href;

function Hero({ onNavigate }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Browsers only autoplay silent video; set muted on the element itself and start playback explicitly.
  // Visitors who prefer reduced motion get the still first frame instead.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.setAttribute('muted', ''); // React sets only the property; some iOS versions check the attribute before autoplaying.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      video.pause();
      return;
    }
    video.play().catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 80);
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { clearTimeout(t); window.removeEventListener('scroll', onScroll); };
  }, []);

  return (
    <section className="relative min-h-screen flex flex-col justify-end overflow-hidden bg-[#0d0d0d]">
      {/* Background video with parallax — decorative, muted, dimmed so the copy stays legible */}
      <div className="absolute inset-0" style={{ transform: `translateY(${scrollY * 0.25}px)` }}>
        <video
          ref={videoRef}
          src={HERO_VIDEO}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
          disablePictureInPicture
          disableRemotePlayback
          className="w-full h-full object-cover object-center pointer-events-none"
          style={{ filter: 'brightness(0.24)', transform: 'scale(1.08)' }}
        />
      </div>
      {/* Gradient overlays — darker where the copy sits (top label, left column, lower block) so moving footage never competes with text */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-[#111111]/55 to-[#111111]/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#111111]/75 via-[#111111]/35 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-[#111111]/85 via-[#111111]/50 to-transparent" />

      {/* Content */}
      <div className="relative max-w-[1400px] mx-auto px-5 md:px-8 lg:px-12 pb-16 md:pb-20 lg:pb-24 w-full" style={{ paddingTop: 'max(120px, calc(env(safe-area-inset-top) + 100px))' }}>
        {/* Studio label */}
        <p className={`text-[9px] md:text-[10px] tracking-[0.45em] uppercase text-[#858582] font-body mb-6 md:mb-8 ${loaded ? 'animate-fade-up' : 'opacity-0'}`}>
          Celebrity-Trusted Ink · New York, NY
        </p>

        {/* Main wordmark */}
        <div className="overflow-hidden mb-2">
          <h1 className={`font-display font-900 leading-none tracking-tight text-[#f5f5f2] ${loaded ? 'animate-fade-up delay-100' : 'opacity-0'}`}
            style={{ fontSize: 'clamp(88px, 22vw, 280px)', lineHeight: 0.9 }}>
            BANG
          </h1>
        </div>
        <div className="overflow-hidden mb-8 md:mb-12">
          <h2 className={`font-display font-700 leading-none tracking-tight text-[#858582] ${loaded ? 'animate-fade-up delay-200' : 'opacity-0'}`}
            style={{ fontSize: 'clamp(32px, 8vw, 100px)' }}>
            PRIVATE TATTOOS
          </h2>
        </div>

        {/* Headline, credibility, CTAs */}
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 pt-8 md:pt-10 border-t border-white/[0.12]">
          <div className={`lg:col-span-7 ${loaded ? 'animate-fade-up delay-300' : 'opacity-0'}`}>
            <p className="font-display font-700 uppercase leading-[0.95] tracking-tight text-[#f5f5f2] mb-5" style={{ fontSize: 'clamp(34px, 5vw, 68px)' }}>
              Worn by icons.<br />Made for you.
            </p>
            <p className="font-body text-[#b7b7b2] text-[15px] md:text-base leading-relaxed max-w-xl">
              Our artists have tattooed{' '}
              <span className="text-[#f5f5f2]">Rihanna, LeBron James, Justin Bieber, Katy Perry, Rita Ora</span> and{' '}
              <span className="text-[#f5f5f2]">Cara Delevingne</span>, and bring that same standard to every client we tattoo.
            </p>
          </div>

          <div className={`lg:col-span-5 lg:self-end ${loaded ? 'animate-fade-up delay-600' : 'opacity-0'}`}>
          <p className="inline-block border border-white/25 px-3 py-1.5 mb-4 text-[10px] tracking-[0.25em] uppercase font-body font-500 text-[#f5f5f2]">
            Free Home Call Service · Nationwide
          </p>
          <p className="font-body text-[#858582] text-sm leading-relaxed max-w-md mb-6">
            Custom tattoos designed around you, from an artist-led consultation to the final session. Visit our New York studio, or book a private <span className="text-[#f5f5f2]">Home Call at no extra charge</span> anywhere in the U.S.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => { onNavigate('booking'); window.scrollTo({ top: 0 }); }}
              className="bg-[#f5f5f2] text-[#111111] font-body font-600 text-[11px] tracking-[0.2em] uppercase px-7 py-3.5 hover:bg-white transition-colors"
            >
              Book Appointment
            </button>
            <button
              onClick={() => document.getElementById('artists-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-[11px] tracking-[0.2em] uppercase font-body text-[#b7b7b2] hover:text-[#f5f5f2] transition-colors py-3.5 flex items-center gap-2"
            >
              Explore Artists ↓
            </button>
          </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className={`absolute bottom-8 right-6 md:right-12 ${loaded ? 'animate-fade-in delay-800' : 'opacity-0'}`}>
        <div className="flex flex-col items-center gap-2 opacity-40">
          <div className="w-px h-12 bg-[#f5f5f2] origin-top animate-[scaleY_2s_ease-in-out_infinite]" />
        </div>
      </div>
    </section>
  );
}

/* ── Artist row component ── */
function ArtistEntry({ artist, index, layout, onNavigate }: {
  artist: typeof ARTISTS[0];
  index: number;
  layout: 'left' | 'right' | 'full' | 'overlay';
  onNavigate: Props['onNavigate'];
}) {
  const { ref, inView } = useInView(0.06);

  if (layout === 'full') {
    return (
      <div ref={ref} className="border-b border-white/05">
        <div className="relative h-[60vw] md:h-[45vw] max-h-[580px] overflow-hidden bg-[#0d0d0d]">
          <img
            src={artist.portrait.replace('w=800', 'w=1600')}
            alt={artist.name}
            loading="lazy"
            className={`w-full h-full object-cover object-center transition-all duration-1000 ${inView ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}
            style={{ filter: 'brightness(0.32)' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-[#111111]/20 to-transparent" />
          <div className={`absolute inset-0 flex flex-col justify-end p-6 md:p-10 lg:p-16 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <div className="max-w-[1400px] mx-auto w-full flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div>
                <p className="text-[9px] tracking-[0.35em] uppercase text-[#858582] font-body mb-2">0{index + 1} · {artist.role}</p>
                <h2 className="font-display font-900 leading-none uppercase text-[#f5f5f2] mb-4" style={{ fontSize: 'clamp(48px, 12vw, 140px)' }}>
                  {artist.name}
                </h2>
                <div className="flex flex-wrap gap-3">
                  {artist.specialties.map(s => (
                    <span key={s} className="text-[10px] tracking-[0.2em] uppercase font-body text-[#b7b7b2]">{s}</span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 md:items-end">
                <button
                  onClick={() => { onNavigate('artist-detail', artist.id); window.scrollTo({ top: 0 }); }}
                  className="text-[11px] tracking-[0.2em] uppercase font-body font-500 border border-white/25 text-[#f5f5f2] hover:bg-white/10 transition-all px-6 py-2.5"
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
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isRight = layout === 'right';

  return (
    <div ref={ref} className="border-b border-white/05">
      <div className={`max-w-[1400px] mx-auto flex flex-col ${isRight ? 'md:flex-row-reverse' : 'md:flex-row'}`}>
        {/* Portrait */}
        <div className="md:w-[42%] overflow-hidden bg-[#0d0d0d]">
          <div
            className="h-[80vw] md:h-full min-h-[340px] lg:min-h-[460px] group cursor-pointer relative"
            onClick={() => { onNavigate('artist-detail', artist.id); window.scrollTo({ top: 0 }); }}
          >
            <img
              src={artist.portrait}
              alt={artist.name}
              loading="lazy"
              className={`w-full h-full object-cover object-top transition-all duration-1000 group-hover:scale-105 ${inView ? 'opacity-100' : 'opacity-0'}`}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-all duration-400" />
          </div>
        </div>

        {/* Info */}
        <div className={`md:w-[58%] flex flex-col justify-center p-6 md:p-10 lg:p-14 xl:p-16 ${isRight ? 'md:pr-10 lg:pr-14 xl:pr-16' : 'md:pl-10 lg:pl-14 xl:pl-16'}`}>
          <p className={`text-[9px] tracking-[0.35em] uppercase text-[#858582] font-body mb-3 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            0{index + 1} · {artist.role}
          </p>
          <h2
            className={`font-display font-900 uppercase leading-none text-[#f5f5f2] mb-4 transition-all duration-700 delay-100 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            style={{ fontSize: 'clamp(52px, 10vw, 120px)' }}
          >
            {artist.name}
          </h2>
          <div className={`flex flex-wrap gap-2 mb-6 transition-all duration-700 delay-150 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            {artist.specialties.map(s => (
              <span key={s} className="text-[10px] tracking-[0.18em] uppercase font-body text-[#b7b7b2] border border-white/10 px-2.5 py-1">
                {s}
              </span>
            ))}
          </div>
          <p className={`font-body text-[#b7b7b2] text-sm leading-relaxed max-w-sm mb-8 transition-all duration-700 delay-200 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            {artist.bio}
          </p>
          <div className={`flex flex-col sm:flex-row gap-3 transition-all duration-700 delay-300 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <button
              onClick={() => { onNavigate('artist-detail', artist.id); window.scrollTo({ top: 0 }); }}
              className="text-[11px] tracking-[0.2em] uppercase font-body font-500 border border-white/15 text-[#f5f5f2] hover:border-white/40 hover:bg-white/05 transition-all px-5 py-2.5"
            >
              View Gallery →
            </button>
            <button
              onClick={() => { onNavigate('booking', artist.id); window.scrollTo({ top: 0 }); }}
              className="text-[11px] tracking-[0.2em] uppercase font-body font-500 bg-[#f5f5f2] text-[#111111] hover:bg-white transition-colors px-5 py-2.5"
            >
              Book This Artist
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Artists section ── */
const LAYOUTS: Array<'left' | 'right' | 'full'> = [
  'left', 'right', 'left', 'left', 'right', 'left', 'right', 'right', 'left', 'right'
];

function ArtistsSection({ onNavigate }: Props) {
  const { ref, inView } = useInView(0.05);
  return (
    <section id="artists-section" className="bg-[#111111]">
      <div ref={ref} className="max-w-[1400px] mx-auto px-5 md:px-8 lg:px-12 pt-24 pb-12 border-b border-white/05">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <p className={`text-[10px] tracking-[0.4em] uppercase text-[#858582] font-body mb-3 ${inView ? 'animate-fade-up' : 'opacity-0'}`}>The Roster</p>
            <h2 className={`font-display font-900 leading-none uppercase tracking-tight text-[#f5f5f2] ${inView ? 'animate-fade-up delay-100' : 'opacity-0'}`}
              style={{ fontSize: 'clamp(72px, 18vw, 200px)' }}>
              ARTISTS
            </h2>
          </div>
          <button
            onClick={() => { onNavigate('artists'); window.scrollTo({ top: 0 }); }}
            className={`text-[11px] tracking-[0.2em] uppercase font-body text-[#858582] hover:text-[#f5f5f2] transition-colors mb-2 ${inView ? 'animate-fade-up delay-200' : 'opacity-0'}`}
          >
            View All Artists →
          </button>
        </div>
      </div>

      {ARTISTS.map((artist, i) => (
        <ArtistEntry key={artist.id} artist={artist} index={i} layout={LAYOUTS[i]} onNavigate={onNavigate} />
      ))}

      {/* Not sure CTA */}
      <div className="max-w-[1400px] mx-auto px-5 md:px-8 lg:px-12 py-16 border-b border-white/05">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 py-10 border-t border-white/06 border-b border-white/06">
          <div>
            <p className="text-[10px] tracking-[0.2em] uppercase text-[#858582] font-body mb-2">Not Sure Which Artist?</p>
            <p className="font-body text-[#b7b7b2] text-sm">Tell us what you have in mind and our team can help.</p>
          </div>
          <button
            onClick={() => { onNavigate('booking'); window.scrollTo({ top: 0 }); }}
            className="shrink-0 text-[11px] tracking-[0.2em] uppercase font-body font-500 border border-white/20 text-[#f5f5f2] hover:border-white/40 hover:bg-white/05 transition-all px-6 py-3"
          >
            Book Appointment →
          </button>
        </div>
      </div>
    </section>
  );
}

/* ── Pricing guide (informational only — not linked to booking options) ── */
const PRICING: Array<{ title: string; items: Array<[label: string, price: string]> }> = [
  {
    title: 'Small & Simple',
    items: [
      ['Small / simple tattoo', '$150'],
      ['Small lettering', '$180'],
      ['Fine-line tattoo', '$200'],
      ['Small detailed tattoo', '$250'],
    ],
  },
  {
    title: 'Medium Tattoos',
    items: [
      ['Medium custom design', '$600'],
      ['Medium realism', '$700'],
      ['Medium portrait', '$800'],
      ['Detailed custom piece', '$900'],
    ],
  },
  {
    title: 'Large Tattoos',
    items: [
      ['Large custom piece', '$900'],
      ['Large realism', '$1,200'],
      ['Detailed back / chest piece', '$1,500'],
      ['Large custom artwork', '$1,800'],
      // TODO: confirm the Japanese-style starting price before final publication.
      ['Japanese-style large piece', '$2,900'],
    ],
  },
  {
    title: 'Sleeves & Large-Scale Work',
    items: [
      ['Half sleeve', '$1,500'],
      ['Full sleeve', '$2,500'],
      ['Large back piece', '$3,000'],
      ['Large chest piece', '$3,000'],
      ['Full back / large-scale project', '$4,000'],
      ['Full bodysuit project', 'Custom Quote'],
    ],
  },
];

function PricingSection({ onNavigate }: Props) {
  const { ref, inView } = useInView(0.05);
  return (
    <section id="pricing" className="bg-[#0d0d0d] border-t border-white/[0.05]">
      <div ref={ref} className="max-w-[1400px] mx-auto px-5 md:px-8 lg:px-12 pt-24 pb-20 md:pb-28">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-16 md:mb-20">
          <div>
            <p className={`text-[10px] tracking-[0.4em] uppercase text-[#858582] font-body mb-3 ${inView ? 'animate-fade-up' : 'opacity-0'}`}>Pricing Guide</p>
            <h2 className={`font-display font-900 leading-[0.9] uppercase tracking-tight text-[#f5f5f2] ${inView ? 'animate-fade-up delay-100' : 'opacity-0'}`}
              style={{ fontSize: 'clamp(56px, 13vw, 160px)' }}>
              TATTOO<br />PRICING
            </h2>
          </div>
          <p className={`font-body text-[#b7b7b2] text-sm leading-relaxed max-w-sm lg:mb-3 ${inView ? 'animate-fade-up delay-200' : 'opacity-0'}`}>
            All prices are starting estimates. Your final quote depends on size, design, placement, complexity, the artist, and the time your piece requires.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-x-12 lg:gap-x-24 gap-y-16 md:gap-y-20 items-start">
          {PRICING.map((category, i) => (
            <div
              key={category.title}
              className={`transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
              style={{ transitionDelay: `${150 + i * 80}ms` }}
            >
              <div className="flex items-baseline gap-4 pb-5 border-b border-white/15">
                <span className="font-body text-[10px] tracking-[0.3em] text-[#858582]">0{i + 1}</span>
                <h3 className="font-display font-700 uppercase text-[#f5f5f2] leading-tight text-2xl md:text-[26px] lg:text-3xl">{category.title}</h3>
              </div>
              <dl>
                {category.items.map(([label, price]) => (
                  <div key={label} className="flex items-baseline justify-between gap-6 py-4 border-b border-white/[0.08]">
                    <dt className="font-body text-[#b7b7b2] text-sm leading-snug">{label}</dt>
                    <dd className="shrink-0 text-right">
                      {price === 'Custom Quote' ? (
                        <span className="font-body text-[10px] tracking-[0.2em] uppercase text-[#f5f5f2]">Custom Quote</span>
                      ) : (
                        <>
                          <span className="font-body text-[9px] tracking-[0.2em] uppercase text-[#858582] mr-2">From</span>
                          <span className="font-display font-700 text-lg text-[#f5f5f2] tabular-nums">{price}</span>
                        </>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-x-12 lg:gap-x-24 gap-y-12 mt-20 md:mt-24 pt-12 border-t border-white/[0.08]">
          <div>
            <p className="text-[10px] tracking-[0.3em] uppercase text-[#858582] font-body mb-4">A Note on Pricing</p>
            <p className="font-body text-[#b7b7b2] text-sm leading-relaxed max-w-lg">
              These are starting estimates, not fixed prices. Every tattoo is quoted individually, and pricing can be discussed during your consultation based on the design, size, placement, complexity and scope of the project.
            </p>
            <p className="font-body text-[#b7b7b2] text-sm leading-relaxed max-w-lg mt-4">
              Have a budget in mind? Let us know during your consultation and we'll discuss what is realistically achievable within your preferred range.
            </p>
          </div>
          <div className="flex flex-col justify-end md:items-start">
            <p className="font-display font-700 uppercase text-[#f5f5f2] leading-tight text-2xl lg:text-3xl mb-3">Your idea doesn't fit a category?</p>
            <p className="font-body text-[#858582] text-sm leading-relaxed mb-6 max-w-md">
              Tell us what you're thinking and we'll provide guidance during your consultation.
            </p>
            <button
              onClick={() => { onNavigate('booking'); window.scrollTo({ top: 0 }); }}
              className="self-start text-[11px] tracking-[0.2em] uppercase font-body font-500 border border-white/20 text-[#f5f5f2] hover:border-white/40 hover:bg-white/[0.05] transition-all px-6 py-3"
            >
              Book a Consultation →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Work section ── */
function WorkSection({ onNavigate }: Props) {
  const { ref: hRef, inView: hVisible } = useInView(0.05);
  const [viewerData, setViewerData] = useState<{ index: number; artistId: string } | null>(null);

  const viewerImages = viewerData ? ARTISTS.find(a => a.id === viewerData.artistId)?.gallery ?? [] : [];
  const viewerArtist = viewerData ? ARTISTS.find(a => a.id === viewerData.artistId) : null;

  return (
    <section id="work" className="bg-[#0d0d0d] py-0">
      <div ref={hRef} className="max-w-[1400px] mx-auto px-5 md:px-8 lg:px-12 pt-24 pb-12">
        <p className={`text-[10px] tracking-[0.4em] uppercase text-[#858582] font-body mb-3 ${hVisible ? 'animate-fade-up' : 'opacity-0'}`}>The Portfolio</p>
        <h2 className={`font-display font-900 leading-none uppercase tracking-tight text-[#f5f5f2] ${hVisible ? 'animate-fade-up delay-100' : 'opacity-0'}`}
          style={{ fontSize: 'clamp(72px, 18vw, 200px)' }}>
          WORK
        </h2>
      </div>

      {/* Editorial mosaic: each row track is a quarter of a column wide (via container width), so spans follow
          each photo's aspect ratio; dense flow back-fills holes. Gutters are tile padding so spans stay proportional. */}
      <div className="@container max-w-[1400px] mx-auto px-5 md:px-8 lg:px-12 pb-24">
        <div className="grid grid-flow-row-dense grid-cols-2 md:grid-cols-3 lg:grid-cols-4 -m-1 md:-m-1.5 auto-rows-[calc((100cqw_+_8px)/8)] md:auto-rows-[calc((100cqw_+_12px)/12)] lg:auto-rows-[calc((100cqw_+_12px)/16)]">
          {WORK_IMAGES.map(item => {
            const artist = ARTISTS.find(a => a.id === item.artistId);
            const { base, md, lg } = item.layout;
            const spans = {
              '--c': base[0], '--r': base[1],
              '--c-md': md[0], '--r-md': md[1],
              '--c-lg': lg[0], '--r-lg': lg[1],
            } as CSSProperties;
            return (
              <div
                key={item.url}
                style={spans}
                className="p-1 md:p-1.5 [grid-column:span_var(--c)] [grid-row:span_var(--r)] md:[grid-column:span_var(--c-md)] md:[grid-row:span_var(--r-md)] lg:[grid-column:span_var(--c-lg)] lg:[grid-row:span_var(--r-lg)]"
              >
              <div
                className="relative h-full overflow-hidden bg-[#1c1c1c] group cursor-pointer"
                onClick={() => { trackAnalytics('portfolio_image_open', { entityType: 'portfolio', entityId: item.url, metadata: artist ? { artist_name: artist.name } : undefined }); setViewerData({ index: Math.max(0, artist?.gallery.findIndex(image => image.url.split('?')[0] === item.url.split('?')[0]) ?? 0), artistId: item.artistId }); }}
              >
                <img
                  src={item.url}
                  alt={item.alt}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-300 flex flex-col justify-end p-4 opacity-0 group-hover:opacity-100">
                  {artist && (
                    <>
                      <p className="text-[9px] tracking-[0.2em] uppercase text-[#b7b7b2] font-body">Artist</p>
                      <p className="font-display font-700 text-base uppercase text-[#f5f5f2] mb-2">{artist.name}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={e => { e.stopPropagation(); onNavigate('artist-detail', artist.id); window.scrollTo({ top: 0 }); }}
                          className="text-[9px] tracking-[0.15em] uppercase font-body border border-white/30 text-[#f5f5f2] px-3 py-1.5 hover:bg-white/10 transition-all"
                        >
                          View Artist
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); onNavigate('booking', artist.id); window.scrollTo({ top: 0 }); }}
                          className="text-[9px] tracking-[0.15em] uppercase font-body bg-[#f5f5f2] text-[#111111] px-3 py-1.5 hover:bg-white transition-colors"
                        >
                          Book Artist
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
              </div>
            );
          })}
        </div>
      </div>

      {viewerData && viewerArtist && (
        <ImageViewer
          images={viewerArtist.gallery}
          index={viewerData.index}
          artistName={viewerArtist.name}
          onClose={() => setViewerData(null)}
          onPrev={() => setViewerData(data => data ? { ...data, index: Math.max(0, data.index - 1) } : null)}
          onNext={() => setViewerData(data => data ? { ...data, index: Math.min(viewerImages.length - 1, data.index + 1) } : null)}
          onBook={() => { setViewerData(null); onNavigate('booking', viewerData.artistId); window.scrollTo({ top: 0 }); }}
        />
      )}
    </section>
  );
}

/* ── FAQ ── */
function FaqSection({ onNavigate }: Props) {
  const { ref, inView } = useInView(0.05);
  const [open, setOpen] = useState<Set<number>>(() => new Set([0]));

  const toggle = (i: number) => setOpen(prev => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });

  const inlineLink = 'text-[#f5f5f2] underline underline-offset-4 decoration-white/30 hover:decoration-white transition-colors';
  const book = () => { onNavigate('booking'); window.scrollTo({ top: 0 }); };

  const faqs: Array<{ q: string; a: ReactNode }> = [
    {
      q: 'Does getting a tattoo hurt?',
      a: 'Some discomfort is part of the process, but how much you feel depends on the placement, the size of the piece, and your own tolerance. Most clients find it very manageable, and our artists pace every session to keep you as comfortable as possible.',
    },
    {
      q: 'How old do I have to be to get a tattoo?',
      a: 'You must be at least 18 years old to be tattooed. A valid government-issued photo ID is required at your appointment, and we are unable to begin a session without one.',
    },
    {
      q: 'How long does it take for a tattoo to heal?',
      a: 'The surface of most tattoos heals in about two to three weeks, while the deeper layers of skin continue to recover for some time after that. Following your aftercare instructions closely is the best way to keep lines crisp and color even.',
    },
    {
      q: 'How do I care for my new tattoo?',
      a: "You'll receive detailed aftercare instructions at the end of your appointment. In general, keep the tattoo clean, moisturize as directed, avoid picking or scratching, and limit sun exposure, swimming, and friction while it heals.",
    },
    {
      q: 'What forms of payment are accepted?',
      a: 'We accept all payment methods. Simply choose whichever option suits you best or the one you feel most comfortable using.',
    },
    {
      q: 'How much does a tattoo cost?',
      a: (
        <>
          Every tattoo is quoted individually. Cost depends on the artist, the size and placement, the complexity of the design, and how many sessions it requires. See our{' '}
          <button type="button" className={inlineLink} onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>pricing guide</button>{' '}
          for starting estimates, or{' '}
          <button type="button" className={inlineLink} onClick={book}>book a consultation</button>{' '}
          for a personalized quote.
        </>
      ),
    },
    {
      q: 'How can I get a price quote?',
      a: (
        <>
          Submit a consultation request through our{' '}
          <button type="button" className={inlineLink} onClick={book}>booking form</button>, then continue the conversation with our booking team on WhatsApp. Share your idea, preferred placement, approximate size, and any reference images, and we'll guide you on estimated pricing.
        </>
      ),
    },
    {
      q: 'How can I schedule an appointment?',
      a: (
        <>
          Complete the{' '}
          <button type="button" className={inlineLink} onClick={book}>booking form</button>{' '}
          here on the site. Once your request is received, you'll continue directly with our booking team on WhatsApp to confirm your artist, references, scheduling, and next steps.
        </>
      ),
    },
    {
      q: 'Do you offer private off-site, travel, or Home Call appointments?',
      a: 'Yes. Our Home Call service lets eligible clients arrange their session at a private location of their choice, and we accommodate requests across the United States, subject to artist availability, scheduling, and location suitability. Request a Home Call through the booking form or message us on WhatsApp to discuss the details.',
    },
  ];

  return (
    <section id="faq" className="bg-[#111111] border-t border-white/[0.05]">
      <div ref={ref} className="max-w-[1400px] mx-auto px-5 md:px-8 lg:px-12 py-24 md:py-28 grid lg:grid-cols-12 gap-12 lg:gap-16">
        <div className="lg:col-span-5 lg:sticky lg:top-28 self-start">
          <p className={`text-[10px] tracking-[0.4em] uppercase text-[#858582] font-body mb-3 ${inView ? 'animate-fade-up' : 'opacity-0'}`}>Frequently Asked Questions</p>
          <h2 className={`font-display font-900 leading-[0.9] uppercase tracking-tight text-[#f5f5f2] mb-8 ${inView ? 'animate-fade-up delay-100' : 'opacity-0'}`}
            style={{ fontSize: 'clamp(56px, 10vw, 120px)' }}>
            BEFORE<br />YOU BOOK
          </h2>
          <p className={`font-body text-[#b7b7b2] text-sm leading-relaxed max-w-sm mb-8 ${inView ? 'animate-fade-up delay-200' : 'opacity-0'}`}>
            Straight answers on comfort, healing, pricing, and booking. If your question isn't covered here, our team is one message away.
          </p>
          <a
            href={whatsappUrl('Hi, I have a question before booking a tattoo.')}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-block text-[11px] tracking-[0.2em] uppercase font-body font-500 border border-white/20 text-[#f5f5f2] hover:border-white/40 hover:bg-white/[0.05] transition-all px-6 py-3 ${inView ? 'animate-fade-up delay-300' : 'opacity-0'}`}
          >
            Ask Us on WhatsApp →
          </a>
        </div>

        <div className={`lg:col-span-7 border-t border-white/15 ${inView ? 'animate-fade-up delay-200' : 'opacity-0'}`}>
          {faqs.map((faq, i) => {
            const isOpen = open.has(i);
            return (
              <div key={faq.q} className="border-b border-white/[0.08]">
                <h3>
                  <button
                    type="button"
                    id={`faq-q-${i}`}
                    aria-expanded={isOpen}
                    aria-controls={`faq-a-${i}`}
                    onClick={() => toggle(i)}
                    className="group w-full flex items-start justify-between gap-6 py-6 md:py-7 text-left"
                  >
                    <span className="flex gap-4 md:gap-6">
                      <span className="w-6 shrink-0 pt-2 font-body text-[10px] tracking-[0.3em] text-[#858582]">{String(i + 1).padStart(2, '0')}</span>
                      <span className={`font-display font-700 uppercase leading-tight text-xl md:text-2xl transition-colors ${isOpen ? 'text-[#f5f5f2]' : 'text-[#b7b7b2] group-hover:text-[#f5f5f2]'}`}>{faq.q}</span>
                    </span>
                    <span aria-hidden="true" className="relative w-4 h-4 mt-2 shrink-0">
                      <span className="absolute left-0 top-1/2 w-4 h-px bg-[#b7b7b2]" />
                      <span className={`absolute left-1/2 top-0 w-px h-4 bg-[#b7b7b2] transition-transform duration-300 ${isOpen ? 'scale-y-0' : 'scale-y-100'}`} />
                    </span>
                  </button>
                </h3>
                <div
                  id={`faq-a-${i}`}
                  role="region"
                  aria-labelledby={`faq-q-${i}`}
                  inert={!isOpen}
                  className={`grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                >
                  <div className="overflow-hidden">
                    <p className={`font-body text-[#b7b7b2] text-sm md:text-[15px] leading-relaxed max-w-2xl pl-10 md:pl-12 pr-10 pb-7 transition-opacity duration-500 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
                      {faq.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── Home Call ── */
function HomeCallSection({ onNavigate }: Props) {
  const { ref, inView } = useInView(0.08);
  useEffect(() => {
    if (inView) trackAnalytics('home_call_view', { entityType: 'service', entityId: 'home-call' });
  }, [inView]);
  return (
    <section className="bg-[#111111] border-t border-white/05">
      <div ref={ref} className="max-w-[1400px] mx-auto px-5 md:px-8 lg:px-12 py-24 md:py-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Text */}
          <div>
            <p className={`text-[10px] tracking-[0.4em] uppercase text-[#858582] font-body mb-4 ${inView ? 'animate-fade-up' : 'opacity-0'}`}>Home Call Service</p>
            <h2 className={`font-display font-900 leading-none uppercase tracking-tight text-[#f5f5f2] mb-6 ${inView ? 'animate-fade-up delay-100' : 'opacity-0'}`}
              style={{ fontSize: 'clamp(52px, 11vw, 130px)' }}>
              THE STUDIO<br />CAN COME<br />TO YOU.
            </h2>
            <p className={`font-body text-[#b7b7b2] text-sm leading-relaxed max-w-md mb-4 ${inView ? 'animate-fade-up delay-200' : 'opacity-0'}`}>
              Prefer your session at your location? Our Home Call service allows eligible clients to arrange tattoo services at their preferred location. We accommodate requests across the United States.
            </p>
            <p className={`font-body text-[#858582] text-xs leading-relaxed max-w-md mb-10 ${inView ? 'animate-fade-up delay-250' : 'opacity-0'}`}>
              Home Call service is offered at no additional service charge, subject to scheduling, artist availability, location suitability, and studio confirmation.
            </p>
            <div className={`flex flex-col sm:flex-row gap-3 ${inView ? 'animate-fade-up delay-300' : 'opacity-0'}`}>
              <button
                onClick={() => { onNavigate('booking', '__home-call__'); window.scrollTo({ top: 0 }); }}
                className="bg-[#f5f5f2] text-[#111111] font-body font-600 text-[11px] tracking-[0.2em] uppercase px-7 py-3.5 hover:bg-white transition-colors"
              >
                Book a Home Call →
              </button>
              <a
                href={whatsappUrl("Hi, I'd like to ask about the Home Call service.")}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackAnalytics('whatsapp_click', { entityType: 'service', entityId: 'home-call' })}
                className="text-[11px] tracking-[0.2em] uppercase font-body text-[#858582] border border-white/12 hover:border-white/30 hover:text-[#f5f5f2] transition-all px-6 py-3.5 text-center"
              >
                Ask Us on WhatsApp →
              </a>
            </div>
          </div>

          {/* Image */}
          <div className={`relative overflow-hidden bg-[#1c1c1c] h-[70vw] md:h-[50vw] lg:h-full min-h-[380px] ${inView ? 'animate-fade-in delay-200' : 'opacity-0'}`}>
            <img
              src="https://images.unsplash.com/photo-1568515045052-f9a854d70bfd?w=900&h=1100&fit=crop&auto=format"
              alt="Home Call — professional tattoo service at your location"
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#111111]/40 to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Studio section ── */
function StudioSection({ onNavigate }: Props) {
  const { ref, inView } = useInView(0.06);
  return (
    <section id="studio" className="bg-[#0d0d0d] border-t border-white/05">
      <div className="max-w-[1400px] mx-auto px-5 md:px-8 lg:px-12 pt-24 pb-0">
        <div ref={ref}>
          <p className={`text-[10px] tracking-[0.4em] uppercase text-[#858582] font-body mb-3 ${inView ? 'animate-fade-up' : 'opacity-0'}`}>Location</p>
          <h2 className={`font-display font-900 leading-none uppercase tracking-tight text-[#f5f5f2] mb-0 ${inView ? 'animate-fade-up delay-100' : 'opacity-0'}`}
            style={{ fontSize: 'clamp(60px, 14vw, 160px)' }}>
            THE STUDIO
          </h2>
        </div>
      </div>

      {/* Full-width studio image */}
      <div className="relative h-[55vw] max-h-[600px] overflow-hidden bg-[#1c1c1c] mt-12">
        <img
          src="https://images.unsplash.com/photo-1616879564267-a336232e3a95?w=1600&h=900&fit=crop&auto=format"
          alt="BANG PRIVATE TATTOOS interior"
          loading="lazy"
          className="w-full h-full object-cover"
          style={{ filter: 'brightness(0.5)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0d0d0d]" />
      </div>

      {/* Studio info + visit/home call choice */}
      <div className="max-w-[1400px] mx-auto px-5 md:px-8 lg:px-12 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12 lg:gap-16">
          {/* Info */}
          <div id="contact">
            <p className="text-[10px] tracking-[0.25em] uppercase text-[#858582] font-body mb-5">Contact & Hours</p>
            <address className="not-italic font-body text-sm text-[#b7b7b2] space-y-2 leading-relaxed mb-6">
              <p className="text-[#f5f5f2] font-500">BANG PRIVATE TATTOOS</p>
              <p>1847 West 18th Street</p>
              <p>New York, NY 10011</p>
              <p className="pt-2">Mon–Sat · 10:00 AM – 8:00 PM</p>
              <p>Sun · 12:00 PM – 6:00 PM</p>
            </address>
            <div className="space-y-2 text-sm font-body">
              <a href={`tel:+${siteContact.whatsappNumber}`} className="flex items-center gap-2 text-[#b7b7b2] hover:text-[#f5f5f2] transition-colors">
                <span className="text-[9px] tracking-[0.2em] uppercase text-[#858582] w-16 shrink-0">Phone</span>
                {siteContact.whatsappDisplay}
              </a>
              <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#b7b7b2] hover:text-[#f5f5f2] transition-colors">
                <span className="text-[9px] tracking-[0.2em] uppercase text-[#858582] w-16 shrink-0">WhatsApp</span>
                {siteContact.whatsappDisplay}
              </a>
              <a href={`mailto:${siteContact.email}`} className="flex items-center gap-2 text-[#b7b7b2] hover:text-[#f5f5f2] transition-colors">
                <span className="text-[9px] tracking-[0.2em] uppercase text-[#858582] w-16 shrink-0">Email</span>
                {siteContact.email}
              </a>
              <a href="https://instagram.com/noir.studio" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#b7b7b2] hover:text-[#f5f5f2] transition-colors">
                <span className="text-[9px] tracking-[0.2em] uppercase text-[#858582] w-16 shrink-0">Instagram</span>
                Follow BANG PRIVATE TATTOOS
              </a>
            </div>
          </div>

          {/* Visit choice */}
          <div className="lg:col-span-2">
            <p className="text-[10px] tracking-[0.25em] uppercase text-[#858582] font-body mb-8">Visit or Home Call</p>
            <div className="grid sm:grid-cols-2 gap-0 border border-white/08">
              {/* Visit studio */}
              <div className="p-8 border-r border-white/08">
                <p className="font-display font-800 text-3xl md:text-4xl uppercase text-[#f5f5f2] mb-3">VISIT US</p>
                <p className="font-body text-[#858582] text-xs leading-relaxed mb-6">
                  1847 West 18th St<br />New York, NY 10011
                </p>
                <a
                  href="https://maps.google.com/?q=1847+West+18th+Street+New+York+NY"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-[11px] tracking-[0.2em] uppercase font-body text-[#f5f5f2] border border-white/15 hover:border-white/35 hover:bg-white/05 transition-all px-5 py-2.5"
                >
                  Get Directions ↗
                </a>
              </div>

              {/* Or divider + home call */}
              <div className="p-8 relative">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 bg-[#0d0d0d] border border-white/08 w-8 h-8 flex items-center justify-center hidden sm:flex">
                  <span className="text-[9px] tracking-wider uppercase text-[#858582] font-body">or</span>
                </div>
                <p className="font-display font-800 text-3xl md:text-4xl uppercase text-[#f5f5f2] mb-3">WE COME TO YOU.</p>
                <p className="font-body text-[#858582] text-xs leading-relaxed mb-6">
                  Home Call requests available<br />across the United States.
                </p>
                <button
                  onClick={() => { onNavigate('booking', '__home-call__'); window.scrollTo({ top: 0 }); }}
                  className="text-[11px] tracking-[0.2em] uppercase font-body text-[#f5f5f2] border border-white/15 hover:border-white/35 hover:bg-white/05 transition-all px-5 py-2.5"
                >
                  Request Home Call →
                </button>
              </div>
            </div>

            <div className="mt-6 flex gap-4">
              <button
                onClick={() => { onNavigate('booking'); window.scrollTo({ top: 0 }); }}
                className="bg-[#f5f5f2] text-[#111111] font-body font-600 text-[11px] tracking-[0.2em] uppercase px-7 py-3.5 hover:bg-white transition-colors"
              >
                Book Appointment
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── How It Works ── */
function HowItWorks() {
  const { ref, inView } = useInView(0.1);
  const steps = [
    { n: '01', label: 'Tell Us Your Idea', desc: 'Share your concept, references, style preferences, and placement through the booking form.' },
    { n: '02', label: 'Choose an Artist', desc: "Select from our Top 10 roster or let our team recommend the right artist for your vision." },
    { n: '03', label: 'Studio or Home Call', desc: "Visit our New York studio or arrange a Home Call at your preferred location, nationwide." },
    { n: '04', label: 'Continue on WhatsApp', desc: "Our booking team picks up the conversation directly, confirming details, scheduling, and pricing." },
  ];
  return (
    <section className="border-t border-white/05 bg-[#111111]">
      <div className="max-w-[1400px] mx-auto px-5 md:px-8 lg:px-12 py-24" ref={ref}>
        <p className={`text-[10px] tracking-[0.4em] uppercase text-[#858582] font-body mb-3 ${inView ? 'animate-fade-up' : 'opacity-0'}`}>Process</p>
        <h2 className={`font-display font-900 leading-none uppercase text-[#f5f5f2] mb-16 ${inView ? 'animate-fade-up delay-100' : 'opacity-0'}`}
          style={{ fontSize: 'clamp(48px, 10vw, 110px)' }}>
          HOW IT WORKS
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-0 border-t border-white/06">
          {steps.map((s, i) => (
            <div
              key={i}
              className={`border-r last:border-r-0 border-white/06 p-6 lg:p-8 transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <p className="font-display font-900 text-5xl text-[#1c1c1c] mb-4 leading-none">{s.n}</p>
              <p className="font-display font-700 text-xl uppercase text-[#f5f5f2] mb-3 leading-tight">{s.label}</p>
              <p className="font-body text-[#858582] text-[13px] leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Final CTA ── */
function FinalCTA({ onNavigate }: Props) {
  const { ref, inView } = useInView(0.1);
  return (
    <section className="relative overflow-hidden bg-[#0d0d0d] border-t border-white/05">
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1607943917700-18ec6ff5a4c2?w=1400&h=800&fit=crop&auto=format"
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="w-full h-full object-cover"
          style={{ filter: 'brightness(0.15)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d0d0d]/50 to-[#111111]" />
      </div>
      <div ref={ref} className="relative max-w-[1400px] mx-auto px-5 md:px-8 lg:px-12 py-28 md:py-40 text-center">
        <p className={`text-[10px] tracking-[0.4em] uppercase text-[#858582] font-body mb-6 ${inView ? 'animate-fade-up' : 'opacity-0'}`}>Ready?</p>
        <h2 className={`font-display font-900 leading-none uppercase tracking-tight text-[#f5f5f2] mb-10 ${inView ? 'animate-fade-up delay-100' : 'opacity-0'}`}
          style={{ fontSize: 'clamp(60px, 15vw, 180px)' }}>
          YOUR NEXT<br />PIECE<br />STARTS HERE.
        </h2>
        <div className={`flex flex-col sm:flex-row items-center justify-center gap-4 ${inView ? 'animate-fade-up delay-300' : 'opacity-0'}`}>
          <button
            onClick={() => { onNavigate('booking'); window.scrollTo({ top: 0 }); }}
            className="bg-[#f5f5f2] text-[#111111] font-body font-600 text-[11px] tracking-[0.2em] uppercase px-10 py-4 hover:bg-white transition-colors"
          >
            Book Appointment →
          </button>
          <a
            href={whatsappUrl("Hi, I'd like to learn more about BANG PRIVATE TATTOOS.")}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] tracking-[0.2em] uppercase font-body text-[#b7b7b2] border border-white/15 hover:border-white/35 hover:text-[#f5f5f2] transition-all px-8 py-4"
          >
            Chat on WhatsApp →
          </a>
        </div>
      </div>
    </section>
  );
}

/* ── Footer ── */
function Footer({ onNavigate, onOpenInsights }: Props) {
  const insightClicks = useRef(0);
  const insightWindowStarted = useRef<number | null>(null);

  const handleCopyrightClick = () => {
    const now = Date.now();
    if (insightWindowStarted.current === null || now - insightWindowStarted.current > 5000) {
      insightWindowStarted.current = now;
      insightClicks.current = 0;
    }
    insightClicks.current += 1;
    if (insightClicks.current === 5) {
      insightClicks.current = 0;
      insightWindowStarted.current = null;
      onOpenInsights?.();
    }
  };

  return (
    <footer className="bg-[#111111] border-t border-white/06" style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom))' }}>
      <div className="max-w-[1400px] mx-auto px-5 md:px-8 lg:px-12 pt-16 pb-8">
        {/* Wordmark */}
        <div className="mb-12 pb-8 border-b border-white/05">
          <p className="font-display font-900 leading-none uppercase tracking-tight text-[#1c1c1c]" style={{ fontSize: 'clamp(60px, 15vw, 180px)' }}>
            BANG
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
          {/* Studio */}
          <div>
            <p className="text-[9px] tracking-[0.3em] uppercase text-[#858582] font-body mb-3">Studio</p>
            <address className="not-italic font-body text-sm text-[#b7b7b2] space-y-1 leading-relaxed">
              <p>1847 West 18th Street</p>
              <p>New York, NY 10011</p>
              <p className="pt-2">BANG PRIVATE TATTOOS</p>
              <p>{siteContact.whatsappDisplay}</p>
            </address>
          </div>

          {/* Navigate */}
          <div>
            <p className="text-[9px] tracking-[0.3em] uppercase text-[#858582] font-body mb-3">Navigate</p>
            <div className="flex flex-col gap-2">
              {['artists', 'booking'].map(p => (
                <button key={p} onClick={() => { onNavigate(p as Page); window.scrollTo({ top: 0 }); }}
                  className="text-sm font-body text-[#b7b7b2] hover:text-[#f5f5f2] transition-colors text-left capitalize">
                  {p === 'booking' ? 'Book Appointment' : p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
              <a href="#work" onClick={() => document.getElementById('work')?.scrollIntoView({ behavior: 'smooth' })} className="text-sm font-body text-[#b7b7b2] hover:text-[#f5f5f2] transition-colors cursor-pointer">Work</a>
              <a href="#studio" onClick={() => document.getElementById('studio')?.scrollIntoView({ behavior: 'smooth' })} className="text-sm font-body text-[#b7b7b2] hover:text-[#f5f5f2] transition-colors cursor-pointer">Studio</a>
            </div>
          </div>

          {/* Services */}
          <div>
            <p className="text-[9px] tracking-[0.3em] uppercase text-[#858582] font-body mb-3">Services</p>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-body text-[#b7b7b2]">Studio Appointments</span>
              <span className="text-sm font-body text-[#b7b7b2]">Home Call</span>
              <span className="text-sm font-body text-[#b7b7b2]">Artist Consultation</span>
            </div>
          </div>

          {/* Social */}
          <div>
            <p className="text-[9px] tracking-[0.3em] uppercase text-[#858582] font-body mb-3">Follow</p>
            <div className="flex flex-col gap-2">
              <a href="https://instagram.com/noir.studio" target="_blank" rel="noopener noreferrer" className="text-sm font-body text-[#b7b7b2] hover:text-[#f5f5f2] transition-colors">Instagram ↗</a>
              <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer" className="text-sm font-body text-[#b7b7b2] hover:text-[#f5f5f2] transition-colors">WhatsApp ↗</a>
            </div>
          </div>

          {/* Legal */}
          <div>
            <p className="text-[9px] tracking-[0.3em] uppercase text-[#858582] font-body mb-3">Legal</p>
            <div className="flex flex-col gap-2">
              <Link to="/accessibility" className="text-sm font-body text-[#b7b7b2] hover:text-[#f5f5f2] transition-colors">Accessibility Statement</Link>
              <Link to="/privacy" className="text-sm font-body text-[#b7b7b2] hover:text-[#f5f5f2] transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="text-sm font-body text-[#b7b7b2] hover:text-[#f5f5f2] transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-8 border-t border-white/05">
          <p onClick={handleCopyrightClick} className="text-[10px] tracking-[0.1em] text-[#858582] font-body">© 2026 BANG PRIVATE TATTOOS. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

/* ── Home Page ── */
export default function Home({ onNavigate, onOpenInsights }: Props) {
  return (
    <div>
      <Hero onNavigate={onNavigate} />
      <ArtistsSection onNavigate={onNavigate} />
      <PricingSection onNavigate={onNavigate} />
      <WorkSection onNavigate={onNavigate} />
      <FaqSection onNavigate={onNavigate} />
      <HomeCallSection onNavigate={onNavigate} />
      <StudioSection onNavigate={onNavigate} />
      <HowItWorks />
      <FinalCTA onNavigate={onNavigate} />
      <Footer onNavigate={onNavigate} onOpenInsights={onOpenInsights} />
    </div>
  );
}
