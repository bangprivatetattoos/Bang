import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Nav from './components/Nav';
import FloatingWA from './components/FloatingWA';
import BackToTop from './components/BackToTop';
import Home from './pages/Home';
import Artists from './pages/Artists';
import ArtistDetail from './pages/ArtistDetail';
import Booking from './pages/Booking';
import LegalPage from './pages/LegalPage';
import { ARTISTS } from './data/artists';
import { trackAnalytics } from './analytics/client';

const Insights = lazy(() => import('./pages/Insights'));

type Page = 'home' | 'artists' | 'artist-detail' | 'booking';

function BookingRoute() {
  const [params] = useSearchParams();
  const artistId = params.get('artist');
  const service = params.get('service');
  const artist = artistId ? ARTISTS.find(item => item.id === artistId) : null;

  return <Booking preselectedArtistId={artist?.id ?? null} preselectedServiceType={service === 'home-call' ? 'home-call' : undefined} />;
}

function ArtistRoute() {
  const { artistSlug } = useParams();
  const navigate = useNavigate();
  const artist = ARTISTS.find(item => item.id === artistSlug);

  if (!artist) return <Navigate to="/artists" replace />;
  return <ArtistDetail artistId={artist.id} onNavigate={(target, id) => {
    if (target === 'booking') navigate(`/book?artist=${encodeURIComponent(id ?? artist.id)}`);
    else if (target === 'artist-detail' && id) navigate(`/artists/${encodeURIComponent(id)}`);
    else navigate(target === 'artists' ? '/artists' : '/');
  }} />;
}

function normalizePath(pathname: string) {
  return pathname.replace(/\/+$/, '') || '/';
}

function AppRoutes() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = normalizePath(location.pathname);
  const page: Page = pathname === '/artists' ? 'artists' : pathname.startsWith('/artists/') ? 'artist-detail' : pathname === '/book' ? 'booking' : 'home';
  const isInsights = pathname === '/bank-insights';

  useEffect(() => {
    if (!location.hash) window.scrollTo({ top: 0, behavior: 'auto' });
    if (!isInsights) {
      trackAnalytics('page_view');
      const artist = ARTISTS.find(item => pathname === `/artists/${item.id}`);
      if (artist) trackAnalytics('artist_view', { entityType: 'artist', entityId: artist.id, metadata: { artist_name: artist.name } });
    }
  }, [location.pathname]);

  const go = (target: string, id?: string) => {
    if (target === 'artist-detail' && id) navigate(`/artists/${encodeURIComponent(id)}`);
    else if (target === 'booking') {
      if (id === '__home-call__') trackAnalytics('home_call_click', { entityType: 'service', entityId: 'home-call' });
      else if (id) {
        const artist = ARTISTS.find(item => item.id === id);
        trackAnalytics('book_artist_click', { entityType: 'artist', entityId: id, metadata: artist ? { artist_name: artist.name } : undefined });
      }
      navigate(id === '__home-call__' ? '/book?service=home-call' : id ? `/book?artist=${encodeURIComponent(id)}` : '/book');
    }
    else navigate(target === 'artists' ? '/artists' : '/');
  };

  return (
    <div className="bg-[#111111] min-h-screen">
      {!isInsights && <Nav onNavigate={go} currentPage={page} />}

      <Routes>
        <Route path="/" element={<Home onNavigate={go} onOpenInsights={() => navigate('/bank-insights')} />} />
        <Route path="/artists" element={<Artists onNavigate={go} />} />
          <Route path="/artists/:artistSlug" element={<ArtistRoute />} />
          <Route path="/book" element={<BookingRoute />} />
          <Route path="/accessibility" element={<LegalPage type="accessibility" />} />
          <Route path="/privacy" element={<LegalPage type="privacy" />} />
          <Route path="/terms" element={<LegalPage type="terms" />} />
          <Route path="/bank-insights" element={<Suspense fallback={<div className="min-h-screen bg-[#0e0e0e]" />}><Insights /></Suspense>} />
          <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {!isInsights && <><FloatingWA hidden={page === 'booking'} /><BackToTop /></>}
    </div>
  );
}

export default function App() {
  return <BrowserRouter><AppRoutes /></BrowserRouter>;
}
