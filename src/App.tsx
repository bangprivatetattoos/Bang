import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Nav from './components/Nav';
import FloatingWA from './components/FloatingWA';
import BackToTop from './components/BackToTop';
import Home from './pages/Home';
import Artists from './pages/Artists';
import ArtistDetail from './pages/ArtistDetail';
import LegalPage from './pages/LegalPage';
import VideoFeedPage from './features/video-feed/VideoFeedPage';
import { BookingFlowProvider, useBookingFlow } from './features/booking/BookingFlowProvider';
import GalleryHelpSheet from './features/booking/GalleryHelpSheet';
import { ARTISTS } from './data/artists';
import { trackAnalytics } from './analytics/client';
import { trackMetaPageView } from './analytics/metaPixel';

const Insights = lazy(() => import('./pages/Insights'));

type Page = 'home' | 'artists' | 'artist-detail' | 'booking';

/**
 * The old `/book` form route.
 *
 * The public booking journey no longer collects personal details before
 * WhatsApp, so an old advert link or bookmark is sent into the current flow
 * with its artist preselected rather than into a second, contradictory
 * experience. The legacy page component and its backend are untouched on disk
 * for rollback; only this entry point changed.
 */
function LegacyBookingRedirect() {
  const [params] = useSearchParams();
  const { openBooking } = useBookingFlow();
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    const artistId = params.get('artist');
    const artist = artistId ? ARTISTS.find(item => item.id === artistId) : null;
    if (params.get('service') === 'home-call') {
      trackAnalytics('home_call_click', { entityType: 'service', entityId: 'home-call' });
    }
    openBooking({ preselectedArtistId: artist?.id ?? null, source: 'legacy_book_link' });
  }, [params, openBooking]);

  return <Navigate to="/" replace />;
}

function ArtistRoute() {
  const { artistSlug } = useParams();
  const navigate = useNavigate();
  const { openBooking } = useBookingFlow();
  const artist = ARTISTS.find(item => item.id === artistSlug);

  if (!artist) return <Navigate to="/artists" replace />;
  return <ArtistDetail artistId={artist.id} onNavigate={(target, id) => {
    // Booking from inside a gallery keeps that artist; it never falls back to
    // a random one.
    if (target === 'booking') openBooking({ preselectedArtistId: id ?? artist.id, source: 'artist_gallery' });
    else if (target === 'artist-detail' && id) navigate(`/artists/${encodeURIComponent(id)}`);
    else navigate(target === 'artists' ? '/artists' : '/studio');
  }} />;
}

function normalizePath(pathname: string) {
  return pathname.replace(/\/+$/, '') || '/';
}

function AppRoutes() {
  const location = useLocation();
  const navigate = useNavigate();
  const { openBooking, openEnquiry } = useBookingFlow();
  const pathname = normalizePath(location.pathname);
  const page: Page = pathname === '/artists' ? 'artists' : pathname.startsWith('/artists/') ? 'artist-detail' : pathname === '/book' ? 'booking' : 'home';
  const isInsights = pathname === '/bank-insights';
  // The immersive feed carries its own top bar, action rail and bottom CTAs,
  // so the conventional navigation and floating controls would collide with it.
  const isFeed = pathname === '/';
  const showSiteChrome = !isInsights && !isFeed;
  const lastMetaLocation = useRef<string | null>(null);

  /** The gallery currently being viewed, if any. */
  const galleryArtist = pathname.startsWith('/artists/')
    ? ARTISTS.find(item => pathname === `/artists/${item.id}`) ?? null
    : null;
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    if (!location.hash) window.scrollTo({ top: 0, behavior: 'auto' });
    if (!isInsights) {
      trackAnalytics('page_view');
      const artist = ARTISTS.find(item => pathname === `/artists/${item.id}`);
      if (artist) trackAnalytics('artist_view', { entityType: 'artist', entityId: artist.id, metadata: { artist_name: artist.name } });
    }
  }, [location.pathname]);

  // Leaving a gallery closes its contact sheet with it.
  useEffect(() => { setHelpOpen(false); }, [location.pathname]);

  // Anchored links into the long-form site (/studio#faq and the like) need the
  // section scrolled to once that route has actually rendered.
  useEffect(() => {
    if (!location.hash) return;
    const target = document.querySelector(location.hash);
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  }, [location.pathname, location.hash]);

  useEffect(() => {
    const metaLocation = `${location.pathname}${location.search}${location.hash}`;
    if (lastMetaLocation.current === metaLocation) return;
    lastMetaLocation.current = metaLocation;
    trackMetaPageView();
  }, [location.pathname, location.search, location.hash]);

  /**
   * The long-form site's navigation callback.
   *
   * Every `Book Appointment` on the legacy pages routes through here, so
   * pointing this one branch at the shared flow converges all of them without
   * touching the pages themselves.
   */
  const go = (target: string, id?: string) => {
    if (target === 'artist-detail' && id) navigate(`/artists/${encodeURIComponent(id)}`);
    else if (target === 'booking') {
      if (id === '__home-call__') {
        trackAnalytics('home_call_click', { entityType: 'service', entityId: 'home-call' });
        openBooking({ source: 'home_call' });
      } else {
        if (id) {
          const artist = ARTISTS.find(item => item.id === id);
          trackAnalytics('book_artist_click', { entityType: 'artist', entityId: id, metadata: artist ? { artist_name: artist.name } : undefined });
        }
        openBooking({ preselectedArtistId: id ?? null, source: id ? 'studio_site_artist' : 'studio_site' });
      }
    }
    else navigate(target === 'artists' ? '/artists' : '/studio');
  };

  return (
    <div className={isFeed ? 'bg-[#080808]' : 'bg-[#111111] min-h-screen'}>
      {showSiteChrome && <Nav onNavigate={go} currentPage={page} />}

      <Routes>
        <Route path="/" element={<VideoFeedPage onOpenInsights={() => navigate('/bank-insights')} />} />
        {/* The long-form studio site. Every section it already had — artists,
            pricing, portfolio, FAQ, Home Call, studio, contact — is intact. */}
        <Route path="/studio" element={<Home onNavigate={go} onOpenInsights={() => navigate('/bank-insights')} />} />
        <Route path="/artists" element={<Artists onNavigate={go} />} />
          <Route path="/artists/:artistSlug" element={<ArtistRoute />} />
          <Route path="/book" element={<LegacyBookingRedirect />} />
          <Route path="/accessibility" element={<LegalPage type="accessibility" />} />
          <Route path="/privacy" element={<LegalPage type="privacy" />} />
          <Route path="/terms" element={<LegalPage type="terms" />} />
          <Route path="/bank-insights" element={<Suspense fallback={<div className="min-h-screen bg-[#0e0e0e]" />}><Insights /></Suspense>} />
          <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {showSiteChrome && (
        <>
          <FloatingWA
            // Inside a gallery the button asks what the visitor needs, so the
            // artist they are looking at carries into whatever they choose.
            onAssist={galleryArtist ? () => setHelpOpen(true) : undefined}
            label={galleryArtist ? 'Get help with booking or an enquiry' : undefined}
          />
          <BackToTop />
        </>
      )}

      {helpOpen && galleryArtist && (
        <div className="feed-root fixed inset-0 z-[250]">
          <GalleryHelpSheet
            artistName={galleryArtist.name}
            onClose={() => setHelpOpen(false)}
            onBook={() => {
              setHelpOpen(false);
              trackAnalytics('artist_gallery_booking_open', { entityType: 'artist', entityId: galleryArtist.id, metadata: { artist_name: galleryArtist.name } });
              openBooking({ preselectedArtistId: galleryArtist.id, source: 'artist_gallery_whatsapp' });
            }}
            onEnquire={() => {
              setHelpOpen(false);
              trackAnalytics('artist_gallery_enquiry_open', { entityType: 'artist', entityId: galleryArtist.id, metadata: { artist_name: galleryArtist.name } });
              openEnquiry({ contentId: `artist-${galleryArtist.id}`, artistId: galleryArtist.id, source: 'artist_gallery_whatsapp' });
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <BookingFlowProvider>
        <AppRoutes />
      </BookingFlowProvider>
    </BrowserRouter>
  );
}
