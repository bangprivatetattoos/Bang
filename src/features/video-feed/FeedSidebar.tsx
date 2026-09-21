import { useEffect, useRef, type ComponentType } from 'react';
import { siteContact, whatsappUrl } from '../../data/siteContact';
import { useHiddenAdminEntrance } from '../../hooks/useHiddenAdminEntrance';
import { trackAnalytics } from '../../analytics/client';
import {
  CalendarIcon, FAQIcon, GalleryIcon, HomeIcon, InstagramIcon,
  MailIcon, PhoneIcon, UsersIcon, WhatsAppIcon, XIcon,
} from './ui/icons';

interface Props {
  onClose: () => void;
  onBook: () => void;
  /** Routes to an existing production page or section. */
  onNavigate: (to: string) => void;
  /** Hidden entrance to the protected analytics dashboard. */
  onOpenInsights?: () => void;
}

/**
 * Every destination is an existing production route. The classic long-form
 * site now lives at /studio, so its sections stay reachable by anchor rather
 * than being duplicated here.
 */
const NAV: Array<{ Icon: ComponentType; label: string; to: string }> = [
  { Icon: HomeIcon, label: 'Home', to: '/' },
  { Icon: UsersIcon, label: 'Explore Artists', to: '/artists' },
  { Icon: GalleryIcon, label: 'Portfolio', to: '/studio#work' },
  { Icon: FAQIcon, label: 'FAQ', to: '/studio#faq' },
  { Icon: PhoneIcon, label: 'Home Call', to: '/studio#home-call' },
  { Icon: MailIcon, label: 'Contact', to: '/studio#contact' },
];

const LEGAL: Array<{ label: string; to: string }> = [
  { label: 'Privacy Policy', to: '/privacy' },
  { label: 'Accessibility Statement', to: '/accessibility' },
  { label: 'Terms of Service', to: '/terms' },
];

const FOCUSABLE = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';

export default function FeedSidebar({ onClose, onBook, onNavigate, onOpenInsights }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const handleCopyrightClick = useHiddenAdminEntrance(onOpenInsights);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); return; }
      if (event.key !== 'Tab' || !panel) return;
      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(element => element.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  const social: Array<{ name: string; Icon: ComponentType; href: string; onSelect?: () => void }> = [
    { name: 'Instagram', Icon: InstagramIcon, href: siteContact.instagramUrl },
    {
      name: 'WhatsApp',
      Icon: WhatsAppIcon,
      href: whatsappUrl('Hi, I have a question about BANG PRIVATE TATTOOS.'),
      onSelect: () => trackAnalytics('whatsapp_click', { entityType: 'whatsapp', metadata: { surface: 'feed_sidebar' } }),
    },
    { name: 'Email', Icon: MailIcon, href: `mailto:${siteContact.email}` },
  ];

  return (
    <div className="absolute inset-0 z-50 flex">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        tabIndex={-1}
        className="feed-scroll w-[85%] max-w-[340px] md:max-w-[380px] h-full flex flex-col animate-feed-slide-left overflow-y-auto outline-none"
        style={{ background: '#0e0e0e', borderRight: '1px solid #222' }}
      >
        <div
          className="flex items-start justify-between px-5 pb-5 flex-shrink-0"
          style={{ borderBottom: '1px solid #1c1c1c', paddingTop: 'max(48px, calc(env(safe-area-inset-top) + 20px))' }}
        >
          <div>
            <p className="display-font text-[9px] tracking-[0.3em] text-[#626262] uppercase mb-1">Private Tattoo Experience</p>
            <p className="display-font text-[22px] font-black text-[#f4f3ef] uppercase tracking-wide leading-tight">
              BANG PRIVATE<br />TATTOOS
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="feed-focusable text-[#858585] hover:text-[#f4f3ef] transition-colors grid place-items-center w-11 h-11 -mr-2"
          >
            <XIcon />
          </button>
        </div>

        <nav className="flex-1 px-2 pt-3" aria-label="Site">
          {NAV.map(({ Icon, label, to }) => (
            <button
              key={label}
              type="button"
              onClick={() => onNavigate(to)}
              className="feed-focusable w-full flex items-center gap-4 px-4 py-3.5 min-h-11 rounded-xl text-left hover:bg-[#161616] transition-colors group"
            >
              <span className="text-[#626262] group-hover:text-[#b5b5b2] transition-colors"><Icon /></span>
              <span className="text-[#b5b5b2] group-hover:text-[#f4f3ef] text-[15px] transition-colors">{label}</span>
            </button>
          ))}
        </nav>

        <div className="px-4 pb-3 pt-3 space-y-2 flex-shrink-0" style={{ borderTop: '1px solid #1c1c1c' }}>
          <button
            type="button"
            onClick={() => { onClose(); onBook(); }}
            className="feed-focusable w-full flex items-center justify-center gap-2 py-3.5 min-h-11 rounded-xl bg-[#f4f3ef] text-[#101010] text-[13px] font-semibold uppercase tracking-wider"
          >
            <CalendarIcon size={16} /> Book Appointment
          </button>
        </div>

        <div className="px-4 pb-4 flex-shrink-0">
          <p className="display-font text-[9px] tracking-[0.3em] text-[#626262] uppercase mb-2 px-1">Get in touch</p>
          <div className="flex gap-2">
            {social.map(({ name, Icon, href, onSelect }) => (
              <a
                key={name}
                href={href}
                target={href.startsWith('mailto:') ? undefined : '_blank'}
                rel="noopener noreferrer"
                onClick={onSelect}
                className="feed-focusable flex-1 flex flex-col items-center justify-center gap-1.5 py-2.5 min-h-11 rounded-xl text-[#626262] hover:text-[#b5b5b2] transition-colors"
                style={{ border: '1px solid #222' }}
              >
                <Icon />
                <span className="text-[9px] tracking-wider uppercase">{name === 'Email' ? 'Contact Us' : name}</span>
              </a>
            ))}
          </div>
        </div>

        <div className="px-5 pb-4 flex flex-wrap gap-x-4 gap-y-1.5 flex-shrink-0">
          {LEGAL.map(({ label, to }) => (
            <button
              key={label}
              type="button"
              onClick={() => onNavigate(to)}
              className="feed-focusable text-[#3a3a3a] text-[10px] tracking-wide hover:text-[#626262] transition-colors py-1"
            >
              {label}
            </button>
          ))}
        </div>

        {/*
          The feed has no conventional footer, so the copyright line — and with
          it the established five-click entrance to the protected analytics
          dashboard — lives here. The dashboard route is never linked.
        */}
        <div
          className="px-5 flex-shrink-0"
          style={{ paddingBottom: 'max(28px, calc(env(safe-area-inset-bottom) + 16px))' }}
        >
          <p
            onClick={handleCopyrightClick}
            className="text-[#2e2e2e] text-[9px] tracking-[0.12em] uppercase select-none touch-manipulation"
          >
            © 2026 BANG PRIVATE TATTOOS. All rights reserved.
          </p>
        </div>
      </div>

      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="flex-1 bg-black/55 cursor-default"
      />
    </div>
  );
}
