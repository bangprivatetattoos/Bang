/**
 * Line icons for the tattoo-type cards and the consultation rows.
 *
 * One family: 24×24 box, 1.4 stroke, round caps and joins, `currentColor`, no
 * fills. They have to stay readable at 22px inside a dark glass card, so each
 * is drawn as a simple silhouette rather than a detailed illustration. No
 * emoji anywhere.
 */

type IconProps = { size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

/** Fine line — a delicate sprig. */
export const FineLineIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M12 21V6" />
    <path d="M12 12c0-2.2 1.9-4 4.2-4 0 2.2-1.9 4-4.2 4z" />
    <path d="M12 16.5c0-1.9 1.6-3.4 3.6-3.4 0 1.9-1.6 3.4-3.6 3.4z" />
    <path d="M12 12c0-2.2-1.9-4-4.2-4 0 2.2 1.9 4 4.2 4z" />
    <path d="M12 6a2 2 0 1 0 0-3 2 2 0 0 0 0 3z" />
  </svg>
);

/** Black & grey — an ink drop with a shaded core. */
export const BlackGreyIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M12 3s6 6.4 6 10.6A6 6 0 0 1 6 13.6C6 9.4 12 3 12 3z" />
    <path d="M9.4 14.4a2.7 2.7 0 0 0 2.6 2.9" />
  </svg>
);

/** Realism / portrait — a profile. */
export const PortraitIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M16.5 21v-1.6a4 4 0 0 0-2.6-3.7c2.4-1 4-3.2 4-5.8A6 6 0 0 0 6.4 8.2" />
    <path d="M6.6 9.4 5 13.2h2.2v2.1a1.9 1.9 0 0 0 1.9 1.9h1.3" />
    <circle cx="9.7" cy="10.4" r=".7" fill="currentColor" stroke="none" />
  </svg>
);

/** Illustrative colour — a rose outline in the traditional manner. */
export const IllustrativeIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M12 12.6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
    <path d="M12 3.4c3.6 0 6.2 2.6 6.2 6.2S15.6 16 12 16s-6.2-2.8-6.2-6.4S8.4 3.4 12 3.4z" />
    <path d="M12 16v5" /><path d="M12 18.4c-1.6 0-2.9-1-3.4-2.4" />
  </svg>
);

/** Lettering — a serif character on a baseline. */
export const LetteringIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M5 16 9.8 5l4.8 11" /><path d="M6.7 12.6h6.2" />
    <path d="M17 16V9.6" /><path d="M15.4 9.6h3.2" />
    <path d="M4 20h16" />
  </svg>
);

/** Sleeve — a tattooed forearm. */
export const SleeveIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M8.5 3h7l-.9 5.2a4 4 0 0 0 .2 2l1 2.6a3 3 0 0 1-.4 2.9L13 21H11l-2.4-5.3a3 3 0 0 1-.4-2.9l1-2.6a4 4 0 0 0 .2-2L8.5 3z" />
    <path d="M9.6 11.4h4.8" /><path d="M10.1 14.6h3.8" />
  </svg>
);

/** Back or chest piece — a torso. */
export const TorsoIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M12 6.2a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z" />
    <path d="M8.6 7.4h6.8A3.4 3.4 0 0 1 18.8 11l-.5 4.4h-2l-.5 5.6H8.2l-.5-5.6h-2L5.2 11a3.4 3.4 0 0 1 3.4-3.6z" />
    <path d="M12 10.6v6" />
  </svg>
);

/** Custom design — a pencil over a sheet. */
export const CustomDesignIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M5 20.4 4.2 21l.6-2.8L15.2 7.8l2.2 2.2L6.9 20.4z" />
    <path d="M16.4 6.6 18 5a1.6 1.6 0 0 1 2.3 0l.2.2a1.6 1.6 0 0 1 0 2.3l-1.6 1.6" />
    <path d="M3.4 10.6h6" /><path d="M3.4 6.4h9" />
  </svg>
);

/** Consultation row: private WhatsApp conversation. */
export const ChatIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M21 11.4c0 4.4-4 8-9 8a10 10 0 0 1-3.6-.7L3 20.4l1.6-4a7.6 7.6 0 0 1-1.6-5c0-4.4 4-8 9-8s9 3.6 9 8z" />
  </svg>
);

/** Consultation row: video or audio call. */
export const CallIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="2.6" y="6.4" width="12" height="11.2" rx="2.4" />
    <path d="M14.6 11.2 21.4 8v8l-6.8-3.2z" />
  </svg>
);

/** Consultation row: studio or Home Call. */
export const StudioIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <path d="M3 10.4 12 3l9 7.4V20a1.4 1.4 0 0 1-1.4 1.4H4.4A1.4 1.4 0 0 1 3 20v-9.6z" />
    <path d="M9.2 21.4v-6.6h5.6v6.6" />
  </svg>
);

/** Consultation row: the consultation fee. */
export const PaymentIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="2.4" y="5.4" width="19.2" height="13.2" rx="2.4" />
    <path d="M2.4 10h19.2" /><path d="M6 14.6h3.4" />
  </svg>
);

/** Consultation row: confirming a date and time. */
export const ScheduleIcon = ({ size = 22 }: IconProps) => (
  <svg {...base(size)}>
    <rect x="3.2" y="5" width="17.6" height="16" rx="2.2" />
    <path d="M3.2 9.6h17.6M8.4 3v4M15.6 3v4" />
    <path d="M12 12.8v3.1l2 1.2" />
  </svg>
);

/** Every tattoo-type icon, addressed by the id stored in the booking config. */
export const TATTOO_TYPE_ICONS = {
  'fine-line': FineLineIcon,
  'black-grey': BlackGreyIcon,
  'realism-portrait': PortraitIcon,
  'illustrative-colour': IllustrativeIcon,
  lettering: LetteringIcon,
  sleeve: SleeveIcon,
  'back-chest': TorsoIcon,
  'custom-design': CustomDesignIcon,
} as const;

export type TattooTypeIconId = keyof typeof TATTOO_TYPE_ICONS;
