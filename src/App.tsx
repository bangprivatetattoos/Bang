import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Nav from './components/Nav';
import FloatingWA from './components/FloatingWA';
import Home from './pages/Home';
import Artists from './pages/Artists';
import ArtistDetail from './pages/ArtistDetail';
import Booking from './pages/Booking';
import { ARTISTS } from './data/artists';

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

function AppRoutes() {
  const location = useLocation();
  const navigate = useNavigate();
  const page: Page = location.pathname === '/artists' ? 'artists' : location.pathname.startsWith('/artists/') ? 'artist-detail' : location.pathname === '/book' ? 'booking' : 'home';

  useEffect(() => {
    if (!location.hash) window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  const go = (target: string, id?: string) => {
    if (target === 'artist-detail' && id) navigate(`/artists/${encodeURIComponent(id)}`);
    else if (target === 'booking') navigate(id === '__home-call__' ? '/book?service=home-call' : id ? `/book?artist=${encodeURIComponent(id)}` : '/book');
    else navigate(target === 'artists' ? '/artists' : '/');
  };

  return (
    <div className="bg-[#111111] min-h-screen">
      <Nav onNavigate={go} currentPage={page} />

      <Routes>
        <Route path="/" element={<Home onNavigate={go} />} />
        <Route path="/artists" element={<Artists onNavigate={go} />} />
        <Route path="/artists/:artistSlug" element={<ArtistRoute />} />
        <Route path="/book" element={<BookingRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <FloatingWA hidden={page === 'booking'} />
    </div>
  );
}

export default function App() {
  return <BrowserRouter><AppRoutes /></BrowserRouter>;
}
