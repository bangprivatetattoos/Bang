import { useEffect, useState } from 'react';

type Page = 'home' | 'artists' | 'artist-detail' | 'booking';

interface NavProps {
  onNavigate: (page: Page, id?: string) => void;
  currentPage: Page;
}

const LINKS = [
  { label: 'Artists', page: 'artists' as Page },
  { label: 'Work', href: '#work' },
  { label: 'Studio', href: '#studio' },
  { label: 'Contact', href: '#contact' },
];

export default function Nav({ onNavigate, currentPage }: NavProps) {
  const [scrollY, setScrollY] = useState(0);
  const [lastY, setLastY] = useState(0);
  const [visible, setVisible] = useState(true);
  const [compact, setCompact] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setCompact(y > 80);
      if (y > lastY && y > 200) setVisible(false);
      else setVisible(true);
      setLastY(y);
      setScrollY(y);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [lastY]);

  useEffect(() => {
    if (!menuOpen) {
      document.body.style.overflow = '';
      return;
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  const handleNav = (page: Page) => {
    setMenuOpen(false);
    onNavigate(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAnchor = (href: string) => {
    setMenuOpen(false);
    if (currentPage !== 'home') {
      onNavigate('home');
      setTimeout(() => {
        document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-[100] transition-all duration-400"
        style={{
          transform: visible ? 'translateY(0)' : 'translateY(-100%)',
          background: compact || scrollY > 10 ? 'rgba(17,17,17,0.92)' : 'transparent',
          backdropFilter: compact ? 'blur(12px)' : 'none',
          borderBottom: compact ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
          paddingTop: 'max(0px, env(safe-area-inset-top))',
        }}
      >
        <div className="max-w-[1400px] mx-auto px-5 md:px-8 lg:px-12 flex items-center justify-between" style={{ height: compact ? '56px' : '72px', transition: 'height 0.3s ease' }}>
          {/* Logo */}
          <button
            onClick={() => handleNav('home')}
            className="font-display font-900 text-xl tracking-[0.25em] uppercase text-[#f5f5f2] hover:text-white transition-colors"
          >
            BANG
          </button>

          {/* Desktop links */}
          <nav className="hidden md:flex items-center gap-8">
            {LINKS.map(link => (
              link.page ? (
                <button
                  key={link.label}
                  onClick={() => handleNav(link.page!)}
                  className="text-[11px] tracking-[0.2em] uppercase font-body text-[#b7b7b2] hover:text-[#f5f5f2] transition-colors"
                >
                  {link.label}
                </button>
              ) : (
                <button
                  key={link.label}
                  onClick={() => handleAnchor(link.href!)}
                  className="text-[11px] tracking-[0.2em] uppercase font-body text-[#b7b7b2] hover:text-[#f5f5f2] transition-colors"
                >
                  {link.label}
                </button>
              )
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={() => { onNavigate('booking'); window.scrollTo({ top: 0 }); }}
              className="text-[11px] tracking-[0.2em] uppercase font-body font-500 bg-[#f5f5f2] text-[#111111] hover:bg-white transition-colors px-5 py-2.5"
            >
              Book Appointment
            </button>
          </div>

          {/* Mobile right group */}
          <div className="flex md:hidden items-center gap-3">
            <button
              onClick={() => { onNavigate('booking'); window.scrollTo({ top: 0 }); setMenuOpen(false); }}
              className="text-[10px] tracking-[0.2em] uppercase font-body font-500 border border-white/25 text-[#f5f5f2] px-3 py-2"
            >
              Book
            </button>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="w-9 h-9 flex flex-col items-center justify-center gap-1.5"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            >
              <span className="block w-5 h-px bg-[#f5f5f2] transition-all" style={{ transform: menuOpen ? 'translateY(4px) rotate(45deg)' : 'none' }} />
              <span className="block w-5 h-px bg-[#f5f5f2] transition-all" style={{ opacity: menuOpen ? 0 : 1 }} />
              <span className="block w-5 h-px bg-[#f5f5f2] transition-all" style={{ transform: menuOpen ? 'translateY(-4px) rotate(-45deg)' : 'none' }} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile full-screen menu */}
      <div
        className="fixed inset-0 z-[90] bg-[#111111] flex flex-col transition-all duration-500 md:hidden"
        style={{
          opacity: menuOpen ? 1 : 0,
          pointerEvents: menuOpen ? 'all' : 'none',
          paddingTop: 'max(80px, calc(env(safe-area-inset-top) + 72px))',
          paddingBottom: 'max(32px, env(safe-area-inset-bottom))',
        }}
      >
        <nav className="flex flex-col px-8 gap-1">
          {LINKS.map((link, i) => (
            link.page ? (
              <button
                key={link.label}
                onClick={() => handleNav(link.page!)}
                className="text-left font-display font-800 text-[14vw] uppercase leading-none text-[#f5f5f2] py-1 border-b border-white/05 hover:text-white transition-colors"
                style={{ transitionDelay: menuOpen ? `${i * 60}ms` : '0ms' }}
              >
                {link.label}
              </button>
            ) : (
              <button
                key={link.label}
                onClick={() => handleAnchor(link.href!)}
                className="text-left font-display font-800 text-[14vw] uppercase leading-none text-[#f5f5f2] py-1 border-b border-white/05 hover:text-white transition-colors"
                style={{ transitionDelay: menuOpen ? `${i * 60}ms` : '0ms' }}
              >
                {link.label}
              </button>
            )
          ))}
        </nav>
        <div className="mt-auto px-8">
          <p className="text-[10px] tracking-[0.25em] uppercase text-[#858582] font-body mb-1">New York, NY</p>
          <p className="text-[11px] text-[#b7b7b2] font-body">BANG PRIVATE TATTOOS</p>
        </div>
      </div>
    </>
  );
}
