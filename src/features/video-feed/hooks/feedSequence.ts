/**
 * The feed's ordering, as pure data.
 *
 * Extracted from `useShuffleFeed` unchanged so it can be tested directly and
 * so the preloader can ask what is coming next without duplicating — or
 * subtly diverging from — the algorithm that decides it.
 *
 * Two properties matter and are covered by tests:
 *
 *   * Deciding an entry early does not change the sequence. Entries are minted
 *     deterministically from the bag, so looking further ahead produces the
 *     same list, just sooner. Preloading therefore cannot skip the carousel.
 *   * `discoveries` counts entries MINTED, never entries viewed. Minting is
 *     what the interlude cadence is measured in; whether a clip was watched,
 *     swiped past or merely prepared is a separate question the feed answers
 *     elsewhere.
 */

/** A single position in the session's browsing history. */
export type FeedEntry =
  | { kind: 'video'; index: number }
  /**
   * `interludeIndex` counts interludes across the whole session, so each one
   * gets the next carousel batch. It is pinned into history, so travelling
   * back and forward re-shows the same batch rather than advancing.
   */
  | { kind: 'interlude'; interludeIndex: number };

/** The portfolio interlude appears after this many newly discovered clips. */
export const INTERLUDE_EVERY = 5;

export interface FeedState {
  /** Every position the visitor has reached, plus the decided lookahead. */
  entries: FeedEntry[];
  /** Clips not yet drawn in the current pass over the pool. */
  bag: number[];
  /** Newly discovered clips since the last interlude. */
  discoveries: number;
  /** How many interludes the session has minted, for carousel batching. */
  interludes: number;
  position: number;
}

export function shuffled(length: number): number[] {
  const order = Array.from({ length }, (_, index) => index);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** Draws the next clip, refilling the bag when the pool has been exhausted. */
export function drawFrom(bag: number[], poolSize: number, exclude: number | null): { index: number; bag: number[] } {
  if (poolSize <= 1) return { index: 0, bag };

  const source = bag.length > 0 ? [...bag] : shuffled(poolSize);

  // Refilling can put the clip that is already on screen at the front. Take
  // the one before it instead, so a clip never immediately repeats itself.
  let at = source.length - 1;
  if (exclude !== null && source[at] === exclude && source.length > 1) at -= 1;

  const [index] = source.splice(at, 1);
  return { index, bag: source };
}

export const lastVideoIndex = (entries: FeedEntry[]): number | null => {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (entry.kind === 'video') return entry.index;
  }
  return null;
};

/** Appends decided-but-unseen entries until `upTo` is inside the window. */
export function extend(state: FeedState, upTo: number, poolSize: number): FeedState {
  if (poolSize === 0) return state;

  let { entries, bag, discoveries, interludes } = state;
  if (entries.length >= upTo + 1) return state;

  entries = [...entries];
  while (entries.length < upTo + 1) {
    if (discoveries >= INTERLUDE_EVERY) {
      discoveries = 0;
      entries.push({ kind: 'interlude', interludeIndex: interludes });
      interludes += 1;
      continue;
    }
    const drawn = drawFrom(bag, poolSize, lastVideoIndex(entries));
    bag = drawn.bag;
    entries.push({ kind: 'video', index: drawn.index });
    discoveries += 1;
  }
  return { ...state, entries, bag, discoveries, interludes };
}

export function createState(poolSize: number, lookahead: number): FeedState {
  if (poolSize === 0) return { entries: [], bag: [], discoveries: 0, interludes: 0, position: 0 };
  const bag = shuffled(poolSize);
  const seed = bag.pop() ?? 0;
  // The opening clip is itself the first discovery, so five clips are seen
  // before the first interlude appears.
  const seeded: FeedState = { entries: [{ kind: 'video', index: seed }], bag, discoveries: 1, interludes: 0, position: 0 };
  return extend(seeded, lookahead, poolSize);
}

/**
 * The clip indices coming up, in order, starting at `from`.
 *
 * Used by the preloader to warm the near future. It reads entries that have
 * already been decided and never mints new ones, so asking what is next can
 * never advance the feed or consume the bag as a side effect.
 */
export function upcomingVideoIndices(state: FeedState, from: number, count: number): number[] {
  const out: number[] = [];
  for (let i = from; i < state.entries.length && out.length < count; i += 1) {
    const entry = state.entries[i];
    if (entry.kind === 'video') out.push(entry.index);
  }
  return out;
}
