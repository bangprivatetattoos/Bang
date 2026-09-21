import { ARTISTS, WORK_IMAGES } from '../../../data/artists';
import { assetsIn, imageUrl } from '../../../media/delivery';
import { batchIndexFor, computeBatchRanges, CAROUSEL_BATCH_SIZE } from './carouselBatching';

export interface CarouselCard {
  /** Stable id (the source filename), used for analytics and label overrides. */
  id: string;
  url: string;
  /** Small-caps label under the card. Omitted when nothing truthful is known. */
  category: string | null;
  alt: string;
  /** Present only when the piece has a confirmed artist. */
  artistId?: string;
}

/**
 * Dedicated carousel artwork.
 *
 * `/caro images` at the repository root is the supplied set. `/sitecarousel`
 * and `/carousel` are also read so the folder can be renamed later without a
 * code change. If none of them contain anything, the interlude falls back to
 * the real portfolio images already published on the site, so it never ships
 * stock photography.
 */
/**
 * The originals on disk, for development only.
 *
 * Guarded by `import.meta.env.DEV`, which the production build replaces with
 * `false`. The glob object then has no reader, so Rollup drops it and Vite
 * emits none of the originals — the ~13 MB of carousel images that used to
 * ship in every deploy for files the browser fetched from Cloudinary anyway.
 *
 * The glob patterns themselves stay in the source because `scripts/media`
 * reads them to discover which folders to sync.
 */
/**
 * Carousel artwork is served from Cloudinary and described by the generated
 * manifest, which is committed, so both development and production read the
 * same source of truth.
 *
 * The originals are deliberately NOT globbed any more: an eager
 * `import.meta.glob` made Vite emit all 35 of them into every build -- about
 * 13 MB of files the browser never requested, because Cloudinary serves them.
 * Vite processes those imports while transforming, so guarding the glob behind
 * `import.meta.env.DEV` does not stop the emission; the glob has to be gone.
 *
 * `scripts/media/config.mjs` records which folders to sync.
 */


/**
 * Per-image style labels, keyed by filename.
 *
 * Left empty on purpose: the supplied files carry no style information, and
 * labelling a piece "FINE LINE" or crediting an artist without knowing is a
 * claim about someone's work. Add entries here to label cards, for example:
 *
 *   export const CAROUSEL_LABELS: Record<string, string> = {
 *     '0-IMG-20260920-WA0024.jpg': 'BLACK & GREY',
 *   };
 */
export const CAROUSEL_LABELS: Record<string, string> = {};

/**
 * Files in `/caro images` to leave out of the carousel.
 *
 * Empty by default: nothing supplied is hidden without being asked for.
 *
 * Seven of the supplied files carry another studio's watermark and TikTok
 * handle, and six of those are six-up contact sheets rather than single
 * pieces, so they crop to a fragment in a portrait card. To drop them, move
 * the filenames below out of this comment and into the array:
 *
 *   '0-IMG-20260920-WA0024.jpg'                        TATTOO_MAKEOUT, 6-up
 *   '1-IMG-20260920-WA0023.jpg'                        TATTOO_MAKEOUT, 6-up
 *   '2-IMG-20260920-WA0022.jpg'                        TATTOO_MAKEOUT, 6-up
 *   '30-2e55299dbadac093f8de0cf8176a5a00.webp'         TATTOO_MAKEOUT, 6-up
 *   '31-040712c253423783d31dfca0d4d1461b.webp'         TATTOO_MAKEOUT, 6-up
 *   '32-221e88e282e9adb8e7d15088ca3b8a20.webp'         TATTOO_MAKEOUT, 6-up
 *   '33-cc2f210e56258495e029bb41e46c9961.webp'         TikTok @mazssz
 */
export const CAROUSEL_EXCLUDE: string[] = [];

const excluded = new Set(CAROUSEL_EXCLUDE);

const readableName = (fileName: string) =>
  fileName.replace(/^\d+-/, '').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();

/**
 * Artworks the sync skipped as repeats.
 *
 * The supplied set stores a few pieces twice under different ordering
 * prefixes. Deduplication now happens once, in the media sync, so the
 * manifest already holds one entry per artwork. Kept as a published surface
 * for anything that reported on it.
 */
export const DUPLICATE_CAROUSEL_FILES: string[] = [];

/**
 * The manifest is the source of truth, in development and production alike.
 *
 * It carries the sequence the sync computed -- deduplicated, in
 * `carouselOrder`, under the same filename ids the labels and analytics use
 * -- so there is nothing left to re-derive from files the build no longer
 * ships.
 */
const DEDICATED_CARDS: CarouselCard[] = [];
for (const asset of assetsIn('carousel')) {
  const fileName = asset.id;
  if (excluded.has(fileName)) continue;
  const url = imageUrl(asset, 'carousel');
  if (!url) continue;
  DEDICATED_CARDS.push({
    id: fileName,
    url,
    category: CAROUSEL_LABELS[fileName] ?? null,
    alt: `BANG Private Tattoos portfolio — ${readableName(fileName)}`,
  });
}

/**
 * Fallback: the real portfolio pieces already published on the site, each
 * labelled with its artist's own primary specialty.
 */
const PORTFOLIO_CARDS: CarouselCard[] = WORK_IMAGES.map(image => {
  const artist = ARTISTS.find(item => item.id === image.artistId);
  return {
    id: image.url.split('/').pop() ?? image.url,
    url: image.url,
    category: artist?.specialties[0] ?? 'CUSTOM TATTOOS',
    alt: image.alt,
    artistId: image.artistId,
  };
});

export const CAROUSEL_CARDS: CarouselCard[] = DEDICATED_CARDS.length > 0 ? DEDICATED_CARDS : PORTFOLIO_CARDS;

/**
 * Fixed batch boundaries over the collection.
 *
 * Computed once so every interlude, and the analytics batch id, agree on where
 * each batch starts. Batches are consecutive slices of at most
 * CAROUSEL_BATCH_SIZE: a short final batch is shown at its real size — one
 * image is a valid batch — and is never merged into the batch before it, nor
 * padded with repeats.
 */
const BATCH_RANGES = computeBatchRanges(CAROUSEL_CARDS.length);

/** Number of batches the collection divides into. */
export const CAROUSEL_BATCH_COUNT = Math.max(1, BATCH_RANGES.length);

export { CAROUSEL_BATCH_SIZE };

export interface CarouselBatch {
  /** Stable identifier for analytics, e.g. "batch-2". */
  id: string;
  /** Zero-based position within the collection, after wrapping. */
  index: number;
  cards: CarouselCard[];
}

/** Batches already requested, so approaching an interlude twice costs nothing. */
const warmedBatches = new Set<number>();

/**
 * Fetches a carousel batch's images before the visitor reaches it.
 *
 * Called a couple of clips ahead, so the interlude opens on decoded images
 * rather than empty frames. The first three carry the visible cards and are
 * requested immediately at high priority; the rest wait for idle time, because
 * ten image downloads must never compete with the clip still playing.
 */
export function preloadCarouselBatch(interludeIndex: number): void {
  if (typeof window === 'undefined' || warmedBatches.has(interludeIndex)) return;
  warmedBatches.add(interludeIndex);

  const { cards } = getCarouselBatch(interludeIndex);
  if (cards.length === 0) return;

  const request = (card: CarouselCard, priority: 'high' | 'low') => {
    const image = new Image();
    // Progressive enhancement: unsupported in Safari, where it is simply
    // ignored and the fetch still happens.
    if ('fetchPriority' in image) {
      (image as HTMLImageElement & { fetchPriority: string }).fetchPriority = priority;
    }
    image.decoding = 'async';
    image.addEventListener('error', () => {
      // Reported rather than hidden: a carousel image that will not load is a
      // delivery problem worth seeing, and the interlude handles it visually.
      console.warn(`[carousel] image failed to preload: ${card.id}`);
    });
    image.src = card.url;
  };

  const visible = cards.slice(0, 3);
  const rest = cards.slice(3);
  for (const card of visible) request(card, 'high');

  if (rest.length === 0) return;
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => void }).requestIdleCallback;
  const later = () => { for (const card of rest) request(card, 'low'); };
  if (idle) idle(later, { timeout: 4000 });
  else window.setTimeout(later, 1200);
}

export function getCarouselBatch(interludeIndex: number): CarouselBatch {
  if (BATCH_RANGES.length === 0) return { id: 'batch-0', index: 0, cards: [] };

  const index = batchIndexFor(interludeIndex, BATCH_RANGES.length);
  const { start, end } = BATCH_RANGES[index];
  return { id: `batch-${index}`, index, cards: CAROUSEL_CARDS.slice(start, end) };
}
