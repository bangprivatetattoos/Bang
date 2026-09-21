/**
 * The feed's sound decision, as pure data.
 *
 * No React, no storage, no video element — so the rules below can be reasoned
 * about and tested directly. The bug this replaces was a state bug, not a
 * media bug, so the state is the part worth isolating.
 *
 * Four facts are kept apart on purpose, because conflating any two of them is
 * what silently loses the visitor's preference:
 *
 *   hasUserActivatedAudio  audible playback has succeeded at least once this
 *                          session, so onboarding is over
 *   soundWanted            the visitor wants sound
 *   userMuted              the visitor deliberately asked for silence
 *   blockedContentId       the one clip whose audible playback the *browser*
 *                          refused
 *
 * Only the visitor can change the first three. A refusal by the browser sets
 * the fourth and nothing else: it may veto one clip's playback, but it never
 * revokes an authorisation the visitor gave, and it never reaches the other
 * clips in the feed.
 */

export interface FeedSoundState {
  hasUserActivatedAudio: boolean;
  soundWanted: boolean;
  userMuted: boolean;
  /**
   * The single clip the browser refused, or null.
   *
   * Scoped to a content id rather than held as a global flag, so moving to
   * another clip leaves the refusal behind with the clip it belonged to.
   */
  blockedContentId: string | null;
  /**
   * Incremented whenever the visitor asks for audio again, so a clip that
   * fell back to muted knows to try once more. Without it a retry on the same
   * clip would have nothing to react to.
   */
  attempt: number;
}

export type FeedSoundEvent =
  /** A user gesture asking for sound, before the browser has answered. */
  | { type: 'sound-requested' }
  /** Audible playback actually started. The only thing that grants activation. */
  | { type: 'activation-succeeded' }
  /** The visitor deliberately asked for silence. */
  | { type: 'user-muted' }
  /** The browser refused this clip's audible playback. */
  | { type: 'playback-blocked'; contentId: string }
  /** Audible playback is running, so any recorded refusal is stale. */
  | { type: 'playback-succeeded' };

export const EMPTY_SOUND_STATE: FeedSoundState = {
  hasUserActivatedAudio: false,
  soundWanted: false,
  userMuted: false,
  blockedContentId: null,
  attempt: 0,
};

export function feedSoundReducer(state: FeedSoundState, event: FeedSoundEvent): FeedSoundState {
  switch (event.type) {
    case 'sound-requested':
      // The gesture alone does not grant activation — the browser has not
      // answered yet. It clears the refusal and releases per-clip fallbacks so
      // the attempt is made fresh.
      return { ...state, userMuted: false, blockedContentId: null, attempt: state.attempt + 1 };

    case 'activation-succeeded':
      return {
        ...state,
        hasUserActivatedAudio: true,
        soundWanted: true,
        userMuted: false,
        blockedContentId: null,
      };

    case 'user-muted':
      // A deliberate mute is a preference, not a failure, so no prompt is
      // warranted and any pending refusal stops being relevant.
      return { ...state, soundWanted: false, userMuted: true, blockedContentId: null };

    case 'playback-blocked':
      // Deliberately leaves hasUserActivatedAudio, soundWanted and userMuted
      // alone. A browser refusal is never promoted to a preference.
      return state.blockedContentId === event.contentId
        ? state
        : { ...state, blockedContentId: event.contentId };

    case 'playback-succeeded':
      return state.blockedContentId === null ? state : { ...state, blockedContentId: null };

    default:
      return state;
  }
}

/**
 * The visitor's standing intent, independent of any one clip.
 *
 * This is what the speaker button reflects: it should not flip to "muted"
 * because a single clip was refused.
 */
export const isSoundOn = (state: FeedSoundState): boolean =>
  state.soundWanted && !state.userMuted;

/** Whether a specific clip should play audibly. */
export const isSoundEnabledFor = (state: FeedSoundState, contentId: string | null): boolean =>
  isSoundOn(state) && (contentId === null || state.blockedContentId !== contentId);

/**
 * Whether to show the "Tap for sound" affordance.
 *
 * Before first activation it is onboarding. Afterwards it returns only for the
 * clip the browser actually refused — never because the clip changed, the
 * element remounted, or the visitor swiped backwards.
 */
export const isSoundPromptVisibleFor = (state: FeedSoundState, contentId: string | null): boolean => {
  if (state.userMuted) return false;
  if (!state.hasUserActivatedAudio) return true;
  return contentId !== null && state.blockedContentId === contentId;
};

/** A rejected play() caused by the autoplay policy rather than a real fault. */
export function isAutoplayRejection(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: string }).name === 'NotAllowedError';
}
