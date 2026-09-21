/**
 * Caption copy for the feed.
 *
 * The source filenames carry third-party captions from wherever the clips were
 * collected ("Located DMV  Ig-", "Tattoo Equipment  Tattoo Ink  Art Co."), so
 * they are not usable as production copy. Until per-video copy is supplied,
 * every item draws from this restrained, brand-safe rotation. None of these
 * lines claims a specific artist, style or client.
 */
export interface VideoCopy {
  label: string;
  caption: string;
  cta: string;
}

export const DEFAULT_VIDEO_COPY: VideoCopy[] = [
  {
    label: 'BANG PRIVATE TATTOOS',
    caption: 'Premium custom tattoo work.\nMeaningful designs. Lasting stories.',
    cta: 'Studio appointments • Home Call',
  },
  {
    label: 'CUSTOM WORK',
    caption: 'Designed around you, from first\nconsultation to final session.',
    cta: 'Book a consultation',
  },
  {
    label: 'IN THE CHAIR',
    caption: 'Considered linework, unhurried sessions,\nand a finish made to last.',
    cta: 'Studio appointments • Home Call',
  },
  {
    label: 'PRIVATE SESSIONS',
    caption: 'An appointment built entirely\naround your piece.',
    cta: 'Private appointments available',
  },
  {
    label: 'THE PROCESS',
    caption: 'Every piece begins as a conversation\nabout what you want to carry.',
    cta: 'Talk to us about your idea',
  },
  {
    label: 'BANG PRIVATE TATTOOS',
    caption: 'Real art. Real people.\nLasting stories.',
    cta: 'Studio appointments • Home Call',
  },
];

/**
 * Per-video copy overrides, keyed by content id. Add an entry here to replace
 * the rotating default for a specific clip.
 */
export const VIDEO_COPY_OVERRIDES: Record<string, Partial<VideoCopy>> = {};
