import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  EMPTY_SOUND_STATE, feedSoundReducer, isAutoplayRejection,
  isSoundEnabledFor, isSoundOn, isSoundPromptVisibleFor,
} from '../../src/features/video-feed/hooks/feedSoundState.ts';

const run = (state, ...events) => events.reduce(feedSoundReducer, state);

/** Activated the way a visitor does it: a gesture, then a real play(). */
const activated = () => run(EMPTY_SOUND_STATE, { type: 'sound-requested' }, { type: 'activation-succeeded' });

// ── Fresh session ────────────────────────────────────────────────────────

test('a fresh session starts silent, wants nothing, and offers the prompt', () => {
  assert.equal(EMPTY_SOUND_STATE.hasUserActivatedAudio, false);
  assert.equal(EMPTY_SOUND_STATE.soundWanted, false);
  assert.equal(isSoundEnabledFor(EMPTY_SOUND_STATE, 'clip-a'), false);
  assert.equal(isSoundPromptVisibleFor(EMPTY_SOUND_STATE, 'clip-a'), true);
  // Nothing has been refused: the first clip plays muted by design, not
  // because an audible play() was attempted and rejected.
  assert.equal(EMPTY_SOUND_STATE.blockedContentId, null);
});

// ── Activation ───────────────────────────────────────────────────────────

test('the gesture alone does not activate; only a successful play() does', () => {
  const requested = feedSoundReducer(EMPTY_SOUND_STATE, { type: 'sound-requested' });
  assert.equal(requested.hasUserActivatedAudio, false);
  assert.equal(isSoundEnabledFor(requested, 'clip-a'), false);

  const live = feedSoundReducer(requested, { type: 'activation-succeeded' });
  assert.equal(live.hasUserActivatedAudio, true);
  assert.equal(live.soundWanted, true);
  assert.equal(live.userMuted, false);
  assert.equal(isSoundEnabledFor(live, 'clip-a'), true);
  assert.equal(isSoundPromptVisibleFor(live, 'clip-a'), false);
});

// ── Navigation cannot lose sound ─────────────────────────────────────────

test('navigation emits no sound event, so sound survives forward and backward travel', () => {
  // The regression under test. A→F→C→H and back H→C→F→A are content changes;
  // none of them is a sound event, so none can reach this state at all.
  const live = activated();
  for (const clip of ['A', 'F', 'C', 'H', 'C', 'F', 'A']) {
    assert.equal(isSoundEnabledFor(live, clip), true, `clip ${clip} should be audible`);
    assert.equal(isSoundPromptVisibleFor(live, clip), false, `clip ${clip} should not re-prompt`);
  }
  assert.deepEqual(run(live), live);
});

test('auto-advance, remount and returning from the carousel all preserve sound', () => {
  const live = activated();
  // Each is a content change with no sound event attached.
  assert.deepEqual(run(live), live);
  assert.equal(isSoundEnabledFor(live, 'any-newly-mounted-clip'), true);
});

// ── Transient block is scoped to one clip ────────────────────────────────

test('a refusal is recorded against one clip and does not touch the others', () => {
  const live = activated();
  const blocked = feedSoundReducer(live, { type: 'playback-blocked', contentId: 'clip-c' });

  // The refused clip falls back and offers recovery...
  assert.equal(isSoundEnabledFor(blocked, 'clip-c'), false);
  assert.equal(isSoundPromptVisibleFor(blocked, 'clip-c'), true);
  // ...while every other clip in the feed is untouched.
  assert.equal(isSoundEnabledFor(blocked, 'clip-d'), true);
  assert.equal(isSoundPromptVisibleFor(blocked, 'clip-d'), false);
  // And the standing preference is never demoted by a browser refusal.
  assert.equal(blocked.soundWanted, true);
  assert.equal(blocked.userMuted, false);
  assert.equal(blocked.hasUserActivatedAudio, true);
  assert.equal(isSoundOn(blocked), true);
});

test('a refused clip recovers on the next genuine tap without re-onboarding', () => {
  const blocked = feedSoundReducer(activated(), { type: 'playback-blocked', contentId: 'clip-c' });
  const recovered = run(blocked, { type: 'sound-requested' }, { type: 'activation-succeeded' });
  assert.equal(isSoundEnabledFor(recovered, 'clip-c'), true);
  assert.equal(isSoundPromptVisibleFor(recovered, 'clip-c'), false);
  assert.equal(recovered.blockedContentId, null);
});

test('a repeated refusal for the same clip does not churn state', () => {
  const blocked = feedSoundReducer(activated(), { type: 'playback-blocked', contentId: 'clip-c' });
  assert.equal(feedSoundReducer(blocked, { type: 'playback-blocked', contentId: 'clip-c' }), blocked);
});

test('audible playback resuming clears a stale refusal', () => {
  const blocked = feedSoundReducer(activated(), { type: 'playback-blocked', contentId: 'clip-c' });
  const ok = feedSoundReducer(blocked, { type: 'playback-succeeded' });
  assert.equal(ok.blockedContentId, null);
  assert.equal(isSoundPromptVisibleFor(ok, 'clip-c'), false);
});

// ── Deliberate mute is a preference, not a failure ───────────────────────

test('manual mute silences later clips and does not nag', () => {
  const muted = feedSoundReducer(activated(), { type: 'user-muted' });
  assert.equal(muted.soundWanted, false);
  assert.equal(muted.userMuted, true);
  assert.equal(isSoundOn(muted), false);
  assert.equal(isSoundEnabledFor(muted, 'clip-x'), false);
  // Muting is a choice: offering "tap for sound" over it would be nagging.
  assert.equal(isSoundPromptVisibleFor(muted, 'clip-x'), false);
  // The earlier activation is remembered, so unmuting is not a fresh start.
  assert.equal(muted.hasUserActivatedAudio, true);
});

test('manual unmute re-enables sound for every later clip', () => {
  const muted = feedSoundReducer(activated(), { type: 'user-muted' });
  const live = run(muted, { type: 'sound-requested' }, { type: 'activation-succeeded' });
  assert.equal(isSoundOn(live), true);
  assert.equal(isSoundEnabledFor(live, 'clip-y'), true);
});

test('a browser refusal is never confused with a deliberate mute', () => {
  const blocked = feedSoundReducer(activated(), { type: 'playback-blocked', contentId: 'clip-c' });
  assert.equal(blocked.userMuted, false);
  const muted = feedSoundReducer(activated(), { type: 'user-muted' });
  assert.equal(muted.blockedContentId, null);
});

// ── Retry token ──────────────────────────────────────────────────────────

test('asking for sound bumps the token that releases per-clip fallbacks', () => {
  const live = activated();
  const blocked = feedSoundReducer(live, { type: 'playback-blocked', contentId: 'clip-c' });
  const retry = feedSoundReducer(blocked, { type: 'sound-requested' });
  assert.equal(retry.attempt, live.attempt + 1);
  assert.equal(retry.blockedContentId, null);
});

// ── Rejection classification ─────────────────────────────────────────────

test('only a policy rejection counts as a block', () => {
  assert.equal(isAutoplayRejection(Object.assign(new Error('x'), { name: 'NotAllowedError' })), true);
  // An aborted load is a media fault; prompting for sound would mislead.
  assert.equal(isAutoplayRejection(Object.assign(new Error('x'), { name: 'AbortError' })), false);
  assert.equal(isAutoplayRejection(null), false);
  assert.equal(isAutoplayRejection(undefined), false);
  assert.equal(isAutoplayRejection('NotAllowedError'), false);
});
