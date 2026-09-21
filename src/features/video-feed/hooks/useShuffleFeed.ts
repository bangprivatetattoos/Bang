import { useCallback, useMemo, useState } from 'react';
import type { FeedVideo } from '../types';

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
const INTERLUDE_EVERY = 5;

/** How far ahead the next entries are decided, so they can be preloaded. */
const LOOKAHEAD = 2;

interface FeedState {
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

function shuffled(length: number): number[] {
  const order = Array.from({ length }, (_, index) => index);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** Draws the next clip, refilling the bag when the pool has been exhausted. */
function drawFrom(bag: number[], poolSize: number, exclude: number | null): { index: number; bag: number[] } {
  if (poolSize <= 1) return { index: 0, bag };

  const source = bag.length > 0 ? [...bag] : shuffled(poolSize);

  // Refilling can put the clip that is already on screen at the front. Take
  // the one before it instead, so a clip never immediately repeats itself.
  let at = source.length - 1;
  if (exclude !== null && source[at] === exclude && source.length > 1) at -= 1;

  const [index] = source.splice(at, 1);
  return { index, bag: source };
}

const lastVideoIndex = (entries: FeedEntry[]): number | null => {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (entry.kind === 'video') return entry.index;
  }
  return null;
};

/** Appends decided-but-unseen entries until `upTo` is inside the window. */
function extend(state: FeedState, upTo: number, poolSize: number): FeedState {
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

function createState(poolSize: number): FeedState {
  if (poolSize === 0) return { entries: [], bag: [], discoveries: 0, interludes: 0, position: 0 };
  const bag = shuffled(poolSize);
  const seed = bag.pop() ?? 0;
  // The opening clip is itself the first discovery, so five clips are seen
  // before the first interlude appears.
  const seeded: FeedState = { entries: [{ kind: 'video', index: seed }], bag, discoveries: 1, interludes: 0, position: 0 };
  return extend(seeded, LOOKAHEAD, poolSize);
}

/**
 * Randomised forward discovery over a fixed pool, with an exact session
 * history.
 *
 * Forward order is drawn from a shuffle bag: every clip is shown once before
 * any clip repeats, and a clip never follows itself. Once an entry has been
 * visited it is pinned into `entries`, so swiping back and forward again
 * replays the identical sequence instead of re-randomising. New entries are
 * minted only when the visitor moves past the end of that history.
 *
 * Entries are decided a couple of steps ahead of the visitor so the next clip
 * is known early enough to preload, which is what makes a swipe feel instant.
 */
export function useShuffleFeed(videos: FeedVideo[]) {
  const poolSize = videos.length;
  const [state, setState] = useState<FeedState>(() => createState(poolSize));

  const goForward = useCallback(() => {
    setState(current => {
      const position = current.position + 1;
      return { ...extend(current, position + LOOKAHEAD, poolSize), position };
    });
  }, [poolSize]);

  const goBackward = useCallback(() => {
    setState(current => (current.position === 0 ? current : { ...current, position: current.position - 1 }));
  }, []);

  const { entries, position } = state;

  const { previousVideo, currentVideo, nextVideo } = useMemo(() => {
    const findVideo = (from: number, step: -1 | 1): FeedVideo | null => {
      for (let i = from; i >= 0 && i < entries.length; i += step) {
        const entry = entries[i];
        if (entry.kind === 'video') return videos[entry.index] ?? null;
      }
      return null;
    };
    const here = entries[position];
    return {
      currentVideo: here?.kind === 'video' ? videos[here.index] ?? null : findVideo(position - 1, -1),
      previousVideo: findVideo(position - 1, -1),
      nextVideo: findVideo(position + 1, 1),
    };
  }, [entries, position, videos]);

  return {
    entries,
    position,
    current: entries[position] ?? null,
    currentVideo,
    previousVideo,
    nextVideo,
    canGoBackward: position > 0,
    goForward,
    goBackward,
  };
}
