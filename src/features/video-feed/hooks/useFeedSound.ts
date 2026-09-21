import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import {
  EMPTY_SOUND_STATE, feedSoundReducer, isSoundEnabledFor, isSoundOn, isSoundPromptVisibleFor,
  type FeedSoundEvent, type FeedSoundState,
} from './feedSoundState';

/**
 * The feed's sound session.
 *
 * Sound belongs to the feed, not to a video element. A clip is transient —
 * mounted, unmounted and remounted by the previous/current/next window — so if
 * each one decided for itself whether the visitor had authorised audio, the
 * answer would reset every few swipes. It is decided once, here, and every
 * clip reads it.
 *
 * The rules live in `feedSoundState.ts`. This adds the two things that need a
 * browser: session persistence, and playing the real element from inside the
 * gesture that asked for it.
 */

const ACTIVATED_KEY = 'bang.feed.audio-activated';
const WANTED_KEY = 'bang.feed.sound-wanted';
const MUTED_KEY = 'bang.feed.user-muted';

/**
 * Session-scoped, never permanent.
 *
 * A new browsing session starts muted by design; a remount or a route change
 * inside the same session keeps a preference the visitor already expressed.
 */
function readSession(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) === 'true';
  } catch {
    // Private windows and blocked site data throw outright. The feed still
    // works; the preference just does not survive a remount.
    return false;
  }
}

function writeSession(key: string, value: boolean) {
  try {
    window.sessionStorage.setItem(key, value ? 'true' : 'false');
  } catch {
    // Nothing to recover: the preference lives in memory for this page.
  }
}

/**
 * Only settled user intent is restored.
 *
 * `blockedContentId` is deliberately absent: a browser refusal describes one
 * moment of one clip, and restoring it would resurrect a problem that no
 * longer exists.
 */
const restoreState = (): FeedSoundState => ({
  ...EMPTY_SOUND_STATE,
  hasUserActivatedAudio: readSession(ACTIVATED_KEY),
  soundWanted: readSession(WANTED_KEY),
  userMuted: readSession(MUTED_KEY),
});

export interface FeedSound {
  state: FeedSoundState;
  /** Whether the clip currently on screen should be audible. */
  soundEnabled: boolean;
  /** The visitor's standing intent, for the speaker control. */
  soundOn: boolean;
  promptVisible: boolean;
  /** Token that releases per-clip muted fallbacks when the visitor retries. */
  attempt: number;
  /** Called by each mounted clip so a gesture can act on the real elements. */
  registerElement: (element: HTMLVideoElement | null, active: boolean) => void;
  /** Run from a click handler: unmutes and plays inside the user gesture. */
  requestSound: () => void;
  toggleSound: () => void;
  reportBlocked: (contentId: string) => void;
  reportAudiblePlayback: () => void;
}

interface Options {
  /** The clip on screen, so a refusal can be scoped to it. */
  contentId: string | null;
  /** Observation only. Never allowed to affect playback — see `emit`. */
  onEvent?: (event: FeedSoundEvent, next: FeedSoundState) => void;
}

export function useFeedSound({ contentId, onEvent }: Options): FeedSound {
  const [state, dispatch] = useReducer(feedSoundReducer, undefined, restoreState);

  const activeElement = useRef<HTMLVideoElement | null>(null);
  /** Every mounted clip, so a gesture can prime the ones it is allowed to. */
  const mounted = useRef(new Set<HTMLVideoElement>());
  const stateRef = useRef(state);
  stateRef.current = state;
  const contentIdRef = useRef(contentId);
  contentIdRef.current = contentId;

  // Only settled intent is persisted. A refusal never is.
  useEffect(() => { writeSession(ACTIVATED_KEY, state.hasUserActivatedAudio); }, [state.hasUserActivatedAudio]);
  useEffect(() => { writeSession(WANTED_KEY, state.soundWanted); }, [state.soundWanted]);
  useEffect(() => { writeSession(MUTED_KEY, state.userMuted); }, [state.userMuted]);

  const emit = useCallback((event: FeedSoundEvent) => {
    dispatch(event);
    // Analytics is an observer and nothing more. It is dispatched after the
    // state change and wrapped, so a reporting fault can never stop sound
    // being enabled, stop a clip playing, or block a swipe.
    try {
      onEvent?.(event, feedSoundReducer(stateRef.current, event));
    } catch {
      // Observation failed. Playback does not care.
    }
  }, [onEvent]);

  const registerElement = useCallback((element: HTMLVideoElement | null, active: boolean) => {
    if (!element) return;
    mounted.current.add(element);
    if (active) activeElement.current = element;
  }, []);

  /**
   * Asks for audible playback from inside the gesture that requested it.
   *
   * play() is called synchronously here rather than from an effect, because a
   * browser grants audible playback to the call it can attribute to the tap.
   * `muted` is set before play() and never after: reversing that order is
   * what mobile Safari refuses.
   *
   * Activation is recorded only once the promise resolves. A preference the
   * browser refused is not a preference that took effect.
   */
  const requestSound = useCallback(() => {
    emit({ type: 'sound-requested' });

    const element = activeElement.current;
    if (!element) return;

    // Neighbours are primed silently within the same gesture. Some engines
    // grant playback permission per element rather than per page, so the clip
    // swiped to next arrives with a far better chance of being audible if it
    // was touched while the gesture was still in hand. They stay muted, and
    // anything that was paused is paused again, so nothing is heard and
    // nothing starts early.
    for (const other of mounted.current) {
      if (other === element || !other.isConnected) continue;
      const wasPaused = other.paused;
      try {
        const primed = other.play();
        if (primed && typeof primed.then === 'function') {
          void primed.then(() => { if (wasPaused) other.pause(); }).catch(() => {});
        }
      } catch {
        // Priming is opportunistic; a refusal here changes nothing.
      }
    }

    element.muted = false;
    element.removeAttribute('muted');
    const played = element.play();
    if (!played || typeof played.then !== 'function') return;

    void played
      .then(() => emit({ type: 'activation-succeeded' }))
      .catch((error: unknown) => {
        // Refused even from the gesture. Fall back silently for this clip so
        // the feed keeps running, and leave the prompt up to try again.
        element.muted = true;
        element.setAttribute('muted', '');
        void element.play().catch(() => {});
        if (import.meta.env.DEV) {
          console.info('[feed-sound] audible playback refused from the activation gesture:', error);
        }
        const current = contentIdRef.current;
        if (current) emit({ type: 'playback-blocked', contentId: current });
      });
  }, [emit]);

  const toggleSound = useCallback(() => {
    if (isSoundOn(stateRef.current)) {
      const element = activeElement.current;
      if (element) {
        element.muted = true;
        element.setAttribute('muted', '');
      }
      emit({ type: 'user-muted' });
      return;
    }
    requestSound();
  }, [emit, requestSound]);

  const reportBlocked = useCallback((blockedId: string) => {
    emit({ type: 'playback-blocked', contentId: blockedId });
  }, [emit]);

  const reportAudiblePlayback = useCallback(() => emit({ type: 'playback-succeeded' }), [emit]);

  return useMemo(() => ({
    state,
    soundEnabled: isSoundEnabledFor(state, contentId),
    soundOn: isSoundOn(state),
    promptVisible: isSoundPromptVisibleFor(state, contentId),
    attempt: state.attempt,
    registerElement,
    requestSound,
    toggleSound,
    reportBlocked,
    reportAudiblePlayback,
  }), [state, contentId, registerElement, requestSound, toggleSound, reportBlocked, reportAudiblePlayback]);
}
