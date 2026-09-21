/**
 * How the portfolio collection is cut into carousel interludes.
 *
 * Deliberately free of imports so it can be unit-tested directly in Node,
 * away from the asset globs that need a bundler.
 *
 * The rule is simple and sequential: each interlude consumes the next slice
 * of the collection, in manifest order, and the batch size is a **maximum**,
 * never a minimum. A final partial batch is valid — even a batch of one — and
 * is never merged backwards or padded with repeats, because the carousel is a
 * deterministic stream through the collection rather than a set of equal
 * pages.
 */

/** Images one carousel interlude may show. A maximum, not a target. */
export const CAROUSEL_BATCH_SIZE = 10;

export interface BatchRange {
  /** Inclusive start index into the collection. */
  start: number;
  /** Exclusive end index. */
  end: number;
}

/**
 * Cuts `total` items into consecutive batches of at most `batchSize`.
 *
 * Every index appears in exactly one batch, in order, with nothing duplicated
 * and nothing dropped.
 */
export function computeBatchRanges(total: number, batchSize: number = CAROUSEL_BATCH_SIZE): BatchRange[] {
  if (!Number.isFinite(total) || total <= 0) return [];
  if (!Number.isFinite(batchSize) || batchSize <= 0) return [];

  const ranges: BatchRange[] = [];
  for (let start = 0; start < total; start += batchSize) {
    ranges.push({ start, end: Math.min(start + batchSize, total) });
  }
  return ranges;
}

/**
 * Which batch a given interlude shows.
 *
 * Interludes walk forward through the batches and wrap to the first once the
 * collection has been exhausted.
 */
export function batchIndexFor(interludeIndex: number, batchCount: number): number {
  if (batchCount <= 0) return 0;
  const wrapped = interludeIndex % batchCount;
  return wrapped < 0 ? wrapped + batchCount : wrapped;
}
