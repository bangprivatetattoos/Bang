import { useState } from 'react';
import Nav from './components/Nav';
import FloatingWA from './components/FloatingWA';
import Home from './pages/Home';
import Artists from './pages/Artists';
import ArtistDetail from './pages/ArtistDetail';
import Booking from './pages/Booking';

type Page = 'home' | 'artists' | 'artist-detail' | 'booking';

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [artistId, setArtistId] = useState<string | null>(null);
  const [bookingArtistId, setBookingArtistId] = useState<string | null>(null);

  const navigate = (target: string, id?: string) => {
    const p = target as Page;
    setPage(p);
    if (p === 'artist-detail') setArtistId(id ?? null);
    if (p === 'booking') setBookingArtistId(id ?? null);
    if (p !== 'booking') setBookingArtistId(null);
  };

  const isBookingPage = page === 'booking';

  return (
    <div className="bg-[#111111] min-h-screen">
      <Nav onNavigate={navigate} currentPage={page} />

      {page === 'home' && <Home onNavigate={navigate} />}
      {page === 'artists' && <Artists onNavigate={navigate} />}
      {page === 'artist-detail' && artistId && <ArtistDetail artistId={artistId} onNavigate={navigate} />}
      {page === 'booking' && <Booking preselectedArtistId={bookingArtistId} onNavigate={navigate} />}

      <FloatingWA hidden={isBookingPage} />
    </div>
  );
}
