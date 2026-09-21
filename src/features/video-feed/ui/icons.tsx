/** Line icons for the feed, matching the approved design's 1.5px stroke set. */

type Sized = { size?: number };

export const MenuIcon = () => (
  <svg width="18" height="13" viewBox="0 0 18 13" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
    <line x1="0" y1="1" x2="18" y2="1" /><line x1="0" y1="6.5" x2="18" y2="6.5" /><line x1="0" y1="12" x2="18" y2="12" />
  </svg>
);

export const XIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
    <line x1="1" y1="1" x2="14" y2="14" /><line x1="14" y1="1" x2="1" y2="14" />
  </svg>
);

export const CalendarIcon = ({ size = 22 }: Sized) => (
  <svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="1" y="3" width="20" height="18" rx="2" /><path d="M1 8h20M7 1v4M15 1v4" />
  </svg>
);

export const HeartIcon = ({ filled, size = 24 }: Sized & { filled?: boolean }) => (
  <svg width={size} height={size * (22 / 24)} viewBox="0 0 24 22" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 21S1 13.5 1 7a5 5 0 0 1 10-1h2a5 5 0 0 1 10 1c0 6.5-11 14-11 14z" />
  </svg>
);

export const ThumbUpIcon = ({ filled, size = 22 }: Sized & { filled?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9.5 10.2 1.6a2 2 0 0 1 2.9 2.5L11.8 8.5h5.4a2 2 0 0 1 1.95 2.45l-1.5 6.5A2 2 0 0 1 15.7 19H6" />
    <rect x="1.5" y="9" width="4.5" height="11" rx="1.2" />
  </svg>
);

export const CommentIcon = ({ size = 22 }: Sized) => (
  <svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 10c0 4.97-4.48 9-10 9a10.9 10.9 0 0 1-4.7-1.06L1 20l1.63-4.53A8.64 8.64 0 0 1 1 10c0-4.97 4.48-9 10-9s10 4.03 10 9z" />
  </svg>
);

export const ChevronRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="5,2 10,7 5,12" />
  </svg>
);

export const ArrowUpIcon = ({ size = 20 }: Sized) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="10" y1="17" x2="10" y2="3" /><polyline points="5,8 10,3 15,8" />
  </svg>
);

export const ArrowRightIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="2" y1="7.5" x2="13" y2="7.5" /><polyline points="9,3.5 13,7.5 9,11.5" />
  </svg>
);

export const HomeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 8L9 1l8 7v9a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V8z" /><polyline points="6,18 6,11 12,11 12,18" />
  </svg>
);

export const UsersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="7" cy="5" r="3.5" /><path d="M1 17v-1.5A3.5 3.5 0 0 1 4.5 12h5A3.5 3.5 0 0 1 13 15.5V17" />
    <path d="M14.5 2.1a3.5 3.5 0 0 1 0 6.8" /><path d="M17 17v-1.4a3.5 3.5 0 0 0-2.5-3.3" />
  </svg>
);

export const GalleryIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="1" y="1" width="7" height="7" rx="1" /><rect x="10" y="1" width="7" height="7" rx="1" />
    <rect x="1" y="10" width="7" height="7" rx="1" /><rect x="10" y="10" width="7" height="7" rx="1" />
  </svg>
);

export const FAQIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="9" cy="9" r="8" /><path d="M6.5 6.5a2.5 2.5 0 0 1 5 .8c0 2-2.5 2.5-2.5 4" />
    <circle cx="9" cy="14" r=".6" fill="currentColor" stroke="none" />
  </svg>
);

export const PhoneIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M16 12.5c-1 0-2-.2-3-.5a1 1 0 0 0-1 .2l-1.8 1.8a12 12 0 0 1-5.2-5.2L6.8 7a1 1 0 0 0 .2-1A9.9 9.9 0 0 1 6.5 3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1 14 14 0 0 0 14 14 1 1 0 0 0 1-1v-2.5a1 1 0 0 0-1-1z" />
  </svg>
);

export const MailIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="1" y="3" width="16" height="12" rx="2" /><polyline points="1,3 9,10 17,3" />
  </svg>
);

export const WhatsAppIcon = ({ size = 18 }: Sized) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M10 1C5.03 1 1 5.03 1 10c0 1.68.46 3.25 1.26 4.6L1 19l4.54-1.19A9 9 0 1 0 10 1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M7 8s.4-1 1.5-1c.8 0 1.5.5 1.5 1.5S9 10 9 11h2s1-.5 1-2c0-2-1.8-3-3-3-2 0-3 2-3 3.5 0 3.5 4 6.5 4 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

export const InstagramIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="1" y="1" width="16" height="16" rx="4" /><circle cx="9" cy="9" r="3.5" />
    <circle cx="13.5" cy="4.5" r=".7" fill="currentColor" stroke="none" />
  </svg>
);

export const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="6" width="10" height="8" rx="2" /><path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6" />
  </svg>
);

export const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
    <circle cx="6.5" cy="6.5" r="5" /><line x1="10.5" y1="10.5" x2="14" y2="14" />
  </svg>
);

export const SoundOnIcon = ({ size = 18 }: Sized) => (
  <svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 8h3.5L10 3.5v15L5.5 14H2z" /><path d="M14 7.5a4.5 4.5 0 0 1 0 7" /><path d="M17 4.5a9 9 0 0 1 0 13" />
  </svg>
);

export const SoundOffIcon = ({ size = 18 }: Sized) => (
  <svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 8h3.5L10 3.5v15L5.5 14H2z" /><line x1="14" y1="8" x2="19.5" y2="13.5" /><line x1="19.5" y1="8" x2="14" y2="13.5" />
  </svg>
);

export const LocationIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7.5 1a4.5 4.5 0 0 1 4.5 4.5C12 9.5 7.5 14 7.5 14S3 9.5 3 5.5A4.5 4.5 0 0 1 7.5 1z" /><circle cx="7.5" cy="5.5" r="1.5" />
  </svg>
);

export const CheckIcon = () => (
  <svg width="13" height="10" viewBox="0 0 13 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="1,5 5,9 12,1" />
  </svg>
);
