import { ARTISTS, WORK_IMAGES } from '../../../data/artists';
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
const dedicatedAssets: Record<string, string> = {
  ...import.meta.glob<string>('../../../../caro images/*.{jpg,jpeg,jfif,png,webp,avif,JPG,JPEG,PNG,WEBP}', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
  ...import.meta.glob<string>('../../../../sitecarousel/*.{jpg,jpeg,jfif,png,webp,avif,JPG,JPEG,PNG,WEBP}', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
  ...import.meta.glob<string>('../../../../carousel/*.{jpg,jpeg,jfif,png,webp,avif,JPG,JPEG,PNG,WEBP}', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
};

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

const fileNameOf = (path: string) => path.split('/').pop() ?? path;

/** The numeric prefix the files are named with (`0-`, `1-`, … `34-`). */
const orderOf = (fileName: string) => {
  const leading = /^(\d+)-/.exec(fileName);
  return leading ? Number.parseInt(leading[1], 10) : Number.MAX_SAFE_INTEGER;
};

/** Filename with the ordering prefix removed, which identifies the artwork. */
const artworkKey = (fileName: string) => fileName.replace(/^\d+-/, '').toLowerCase();

const readableName = (fileName: string) =>
  fileName.replace(/^\d+-/, '').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();

const sorted = Object.entries(dedicatedAssets).sort(([a], [b]) => {
  const byNumber = orderOf(fileNameOf(a)) - orderOf(fileNameOf(b));
  return byNumber !== 0 ? byNumber : a.localeCompare(b, undefined, { numeric: true });
});

// The supplied set contains a few artworks saved twice under different
// ordering prefixes. Showing the same tattoo twice in one strip looks like a
// bug, so the first occurrence wins and the rest are skipped. Nothing on disk
// is touched.
const seen = new Set<string>();
export const DUPLICATE_CAROUSEL_FILES: string[] = [];

const DEDICATED_CARDS: CarouselCard[] = [];
for (const [path, url] of sorted) {
  const fileName = fileNameOf(path);
  if (excluded.has(fileName)) continue;
  const key = artworkKey(fileName);
  if (seen.has(key)) {
    DUPLICATE_CAROUSEL_FILES.push(fileName);
    continue;
  }
  seen.add(key);
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

export function getCarouselBatch(interludeIndex: number): CarouselBatch {
  if (BATCH_RANGES.length === 0) return { id: 'batch-0', index: 0, cards: [] };

  const index = batchIndexFor(interludeIndex, BATCH_RANGES.length);
  const { start, end } = BATCH_RANGES[index];
  return { id: `batch-${index}`, index, cards: CAROUSEL_CARDS.slice(start, end) };
}
