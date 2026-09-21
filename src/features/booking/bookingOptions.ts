import type { TattooTypeIconId } from './tattooIcons';

/**
 * The single configuration file for the booking journey.
 *
 * Every location, tattoo type and price figure the flow can show lives here.
 * No pricing literal appears in any component, so the ranges below are the one
 * place to edit when they are confirmed.
 */

export interface PriceRange {
  id: string;
  /** What the visitor sees, and what goes into the WhatsApp message. */
  label: string;
  /** Lower bound in dollars, for ordering and for any future validation. */
  from: number;
  /** Upper bound, or null for the open-ended top band. */
  to: number | null;
}

/**
 * Monetary price ranges.
 *
 * PROVISIONAL — needs confirmation before launch.
 *
 * The production pricing guide in `PricingSection` (src/pages/Home.tsx) quotes
 * *starting* estimates per category, not ranges: $150 small and simple, $600
 * medium, $900 large, $1,500 half sleeve, up to $4,000 for a full back and
 * "custom quote" beyond. These four bands are drawn to sit against those real
 * figures — note the floor is the guide's real $150, not the design
 * prototype's invented $250 — but the boundaries themselves are a judgement
 * call, because no approved range ladder exists in the project.
 */
export const PRICE_RANGES: PriceRange[] = [
  { id: 'r1', label: '$150 – $500', from: 150, to: 500 },
  { id: 'r2', label: '$500 – $900', from: 500, to: 900 },
  { id: 'r3', label: '$900 – $1,500', from: 900, to: 1500 },
  { id: 'r4', label: '$1,500+', from: 1500, to: null },
];

export const PRICING_DISCLAIMER = 'Final pricing may vary based on size, complexity, placement and artist.';

export interface TattooType {
  id: TattooTypeIconId;
  label: string;
}

/**
 * Drawn from the labels in the production pricing guide and the real artist
 * specialties in `src/data/artists.ts`. "Illustrative colour" is the studio's
 * own wording for that style — several artists list it — so it is kept rather
 * than renamed to match a prototype.
 */
export const TATTOO_TYPES: TattooType[] = [
  { id: 'fine-line', label: 'Fine line' },
  { id: 'black-grey', label: 'Black & grey' },
  { id: 'realism-portrait', label: 'Realism / portrait' },
  { id: 'illustrative-colour', label: 'Illustrative colour' },
  { id: 'lettering', label: 'Lettering' },
  { id: 'sleeve', label: 'Sleeve' },
  { id: 'back-chest', label: 'Back or chest piece' },
  { id: 'custom-design', label: 'Custom design' },
];

export interface LocationOption {
  id: string;
  label: string;
  detail?: string;
  /** Opens the U.S. state search instead of being submitted verbatim. */
  needsState?: boolean;
}

/**
 * The studio is in New York; Home Call requests are accepted across the U.S.,
 * so the nearby markets are quick picks rather than the supported set.
 */
export const LOCATIONS: LocationOption[] = [
  { id: 'nyc', label: 'New York City', detail: 'Our studio' },
  { id: 'new-jersey', label: 'New Jersey' },
  { id: 'connecticut', label: 'Connecticut' },
  { id: 'philadelphia', label: 'Philadelphia' },
  // One option, not two: "Elsewhere in the U.S." and a separate "Other" meant
  // the same thing and offered two controls for one decision.
  { id: 'elsewhere-us', label: 'Elsewhere in the U.S.', detail: 'Search your state or area', needsState: true },
];

/** How many real artists the booking flow offers at step two. */
export const BOOKING_ARTIST_CHOICES = { min: 2, max: 3 } as const;

/**
 * The consultation acknowledgement, broken into rows so the final step reads
 * as five short commitments rather than one wall of text. The wording carries
 * the same meaning as the approved copy.
 */
export interface ConsultationPoint {
  icon: 'chat' | 'call' | 'studio' | 'payment' | 'schedule';
  title: string;
  body: string;
}

export const CONSULTATION_POINTS: ConsultationPoint[] = [
  {
    icon: 'chat',
    title: 'WhatsApp',
    body: 'Your consultation gives you direct access to your selected artist on WhatsApp, to discuss your concept, references, placement and size.',
  },
  {
    icon: 'call',
    title: 'Call',
    body: 'It may include a private video or audio call with your artist, so you can explain your ideas clearly before the session.',
  },
  {
    icon: 'studio',
    title: 'Studio or Home Call',
    body: 'Both studio appointments and Home Call requests are available, subject to artist availability and location requirements.',
  },
  {
    icon: 'payment',
    title: 'Consultation fee',
    body: 'A consultation fee is required to continue, and is credited toward your overall tattoo cost where applicable.',
  },
  {
    icon: 'schedule',
    title: 'Scheduling',
    body: 'Share your preferred date and time on WhatsApp. Our team or your selected artist will confirm availability with you.',
  },
];
