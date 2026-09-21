import { useCallback, useMemo, useState } from 'react';
import type { FeedVideo } from '../types';
import {
  createState, extend, upcomingVideoIndices, type FeedEntry, type FeedState,
} from './feedSequence';

export type { FeedEntry } from './feedSequence';

/**
 * How far ahead entries are decided.
 *
 * Deep enough to cover a whole discovery batch, so the preloader knows every
 * clip up to the next carousel and can warm them in order. Deciding an entry
 * early does not change the sequence — entries are minted deterministically
 * from the shuffle bag — so this cannot move or skip the interlude. That is
 * asserted directly in `feedSequence.test.mjs`.
 */
const LOOKAHEAD = 6;

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
 * The ordering itself lives in `feedSequence.ts`, so it can be tested without
 * React and so the preloader can read what is coming without duplicating it.
 */
export function useShuffleFeed(videos: FeedVideo[]) {
  const poolSize = videos.length;
  const [state, setState] = useState<FeedState>(() => createState(poolSize, LOOKAHEAD));

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

  /**
   * The clips after `next`, in the order they will be reached.
   *
   * Read from entries that have already been decided, so asking never mints a
   * new one and never advances the feed. `next` itself is excluded: it is
   * already mounted with `preload="auto"`, and warming it a second time would
   * be two elements racing for the same bytes.
   */
  const upcomingVideos = useMemo(() => {
    const after = upcomingVideoIndices(state, position + 1, LOOKAHEAD);
    return after.slice(1).map(index => videos[index]).filter(Boolean) as FeedVideo[];
  }, [state, position, videos]);

  return {
    entries: entries as FeedEntry[],
    position,
    current: entries[position] ?? null,
    currentVideo,
    previousVideo,
    nextVideo,
    upcomingVideos,
    canGoBackward: position > 0,
    goForward,
    goBackward,
  };
}
