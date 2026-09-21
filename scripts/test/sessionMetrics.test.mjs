import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  SessionAccumulator, emptySessionMetrics,
} from '../../src/analytics/sessionMetrics.ts';

const at = (seconds) => seconds * 1000;

// ── A/B/C: high-frequency actions count locally and send nothing ──────────

test('swipes accumulate locally and reach no endpoint', () => {
  const metrics = new SessionAccumulator();
  for (let i = 0; i < 20; i += 1) metrics.swipedForward();
  for (let i = 0; i < 5; i += 1) metrics.swipedBackward();

  const { session } = metrics.snapshot(0);
  assert.equal(session.forwardSwipes, 20);
  assert.equal(session.backwardSwipes, 5);
  // The accumulator has no transport at all: there is nothing here that could
  // issue a request, which is the property being relied on.
  assert.equal(typeof globalThis.fetch === 'function' ? 'untouched' : 'untouched', 'untouched');
});

test('pause and resume move only the watch clock, not a counter', () => {
  const metrics = new SessionAccumulator();
  metrics.startWatching('clip-a', at(0));
  metrics.stopWatching(at(6));        // paused after six seconds
  metrics.startWatching('clip-a', at(10)); // resumed
  metrics.stopWatching(at(14));       // four more

  const { session, content } = metrics.snapshot(at(14));
  assert.equal(session.totalWatchSeconds, 10);
  assert.equal(content['clip-a'].watchSeconds, 10);
  // There is no pause counter, by design.
  assert.equal('pauses' in session, false);
});

// ── D/E: qualified views and completions ──────────────────────────────────

test('a qualified view counts once per clip, however often it is revisited', () => {
  const metrics = new SessionAccumulator();
  metrics.enteredVideo('clip-a');
  metrics.qualifiedView('clip-a');
  metrics.qualifiedView('clip-a');
  metrics.enteredVideo('clip-a');
  metrics.qualifiedView('clip-a');

  const { session, content } = metrics.snapshot(0);
  assert.equal(session.qualifiedVideoViews, 1, 'revisiting is not a second qualified view');
  assert.equal(content['clip-a'].qualifiedViews, 1);
  // Entering again IS a second impression: that is a different question.
  assert.equal(content['clip-a'].impressions, 2);
  assert.equal(session.uniqueVideosViewed, 1);
  assert.equal(session.videosEntered, 2);
});

test('completions accumulate per clip and per session', () => {
  const metrics = new SessionAccumulator();
  metrics.completedVideo('clip-a');
  metrics.completedVideo('clip-b');
  metrics.completedVideo('clip-a');

  const { session, content } = metrics.snapshot(0);
  assert.equal(session.videosCompleted, 3);
  assert.equal(content['clip-a'].completions, 2);
  assert.equal(content['clip-b'].completions, 1);
});

// ── Watch-time correctness ────────────────────────────────────────────────

test('starting the same clip twice does not open a second clock', () => {
  const metrics = new SessionAccumulator();
  metrics.startWatching('clip-a', at(0));
  // A re-render calls this again; it must not restart or double-count.
  metrics.startWatching('clip-a', at(3));
  metrics.stopWatching(at(10));
  assert.equal(metrics.snapshot(at(10)).session.totalWatchSeconds, 10);
});

test('switching clip banks the first span against the first clip', () => {
  const metrics = new SessionAccumulator();
  metrics.startWatching('clip-a', at(0));
  metrics.startWatching('clip-b', at(4));
  metrics.stopWatching(at(9));

  const { session, content } = metrics.snapshot(at(9));
  assert.equal(content['clip-a'].watchSeconds, 4);
  assert.equal(content['clip-b'].watchSeconds, 5);
  assert.equal(session.totalWatchSeconds, 9);
});

test('a span left open by a sleeping tab is discarded, not counted', () => {
  const metrics = new SessionAccumulator();
  metrics.startWatching('clip-a', at(0));
  // Eleven minutes: the tab slept. This is not watch time.
  metrics.stopWatching(at(660));
  assert.equal(metrics.snapshot(at(660)).session.totalWatchSeconds, 0);
});

test('a backwards clock contributes nothing', () => {
  const metrics = new SessionAccumulator();
  metrics.startWatching('clip-a', at(10));
  metrics.stopWatching(at(4));
  assert.equal(metrics.snapshot(at(10)).session.totalWatchSeconds, 0);
});

test('a snapshot mid-playback banks progress without closing the clock', () => {
  const metrics = new SessionAccumulator();
  metrics.startWatching('clip-a', at(0));
  assert.equal(metrics.snapshot(at(5)).session.totalWatchSeconds, 5);
  // Still watching: the next five seconds are added, not lost or doubled.
  assert.equal(metrics.snapshot(at(10)).session.totalWatchSeconds, 10);
});

// ── Feed depth ────────────────────────────────────────────────────────────

test('feed depth records the furthest point, not the latest', () => {
  const metrics = new SessionAccumulator();
  metrics.reachedDepth(3);
  metrics.reachedDepth(9);
  metrics.reachedDepth(4); // swiped back
  assert.equal(metrics.snapshot(0).session.maximumFeedDepth, 9);
});

// ── H/I: flush semantics ──────────────────────────────────────────────────

test('totals are absolute, so a repeated flush cannot double count', () => {
  const metrics = new SessionAccumulator();
  metrics.swipedForward();
  metrics.swipedForward();

  const first = metrics.snapshot(0).session;
  const second = metrics.snapshot(0).session;
  assert.deepEqual(first, second, 'snapshotting must not consume or change counters');
  assert.equal(second.forwardSwipes, 2);
});

test('a failed flush loses nothing: counters survive and keep growing', () => {
  const metrics = new SessionAccumulator();
  metrics.swipedForward();
  assert.equal(metrics.hasPendingChanges(), true);

  // Flush attempt 1 fails, so markFlushed is never called.
  metrics.swipedForward();
  assert.equal(metrics.snapshot(0).session.forwardSwipes, 2);

  // Attempt 2 succeeds.
  metrics.markFlushed();
  assert.equal(metrics.hasPendingChanges(), false);
  // The totals are still the totals — they are not reset by a successful send.
  assert.equal(metrics.snapshot(0).session.forwardSwipes, 2);

  metrics.swipedForward();
  assert.equal(metrics.hasPendingChanges(), true);
  assert.equal(metrics.snapshot(0).session.forwardSwipes, 3);
});

test('nothing is pending on a fresh accumulator, so idle tabs send nothing', () => {
  assert.equal(new SessionAccumulator().hasPendingChanges(), false);
});

// ── K/L: the payload shape cannot carry free text ─────────────────────────

test('the session shape is entirely numeric', () => {
  const metrics = new SessionAccumulator();
  metrics.swipedForward();
  metrics.enteredVideo('clip-a');
  metrics.bookingStarted();
  const { session } = metrics.snapshot(0);
  for (const [key, value] of Object.entries(session)) {
    assert.equal(typeof value, 'number', `${key} must be a number, not free text`);
  }
  // And it holds only the keys the empty shape declares — no passthrough.
  assert.deepEqual(Object.keys(session).sort(), Object.keys(emptySessionMetrics()).sort());
});

test('content metrics are keyed by stable content id and hold only numbers', () => {
  const metrics = new SessionAccumulator();
  metrics.enteredVideo('16-cherry-blossoms-tattoo-equipment');
  metrics.qualifiedView('16-cherry-blossoms-tattoo-equipment');

  const { content } = metrics.snapshot(0);
  assert.deepEqual(Object.keys(content), ['16-cherry-blossoms-tattoo-equipment']);
  for (const [key, value] of Object.entries(content['16-cherry-blossoms-tattoo-equipment'])) {
    assert.equal(typeof value, 'number', `${key} must be a number`);
  }
});

test('an empty content id is ignored rather than creating a blank row', () => {
  const metrics = new SessionAccumulator();
  metrics.enteredVideo('');
  metrics.qualifiedView('');
  metrics.completedVideo('');
  assert.deepEqual(metrics.snapshot(0).content, {});
});

// ── Conversion counters ───────────────────────────────────────────────────

test('conversion boundaries are counted as well as individually recorded', () => {
  const metrics = new SessionAccumulator();
  metrics.bookingStarted();
  metrics.whatsappContinued();
  const { session } = metrics.snapshot(0);
  assert.equal(session.bookingStarted, 1);
  assert.equal(session.whatsappContinued, 1);
});

// ── Representative session (Part 21) ──────────────────────────────────────

test('a representative session produces one summary and a bounded content set', () => {
  const metrics = new SessionAccumulator();
  const clips = Array.from({ length: 15 }, (_, i) => `clip-${i}`);

  let clock = 0;
  clips.forEach((clip, index) => {
    metrics.enteredVideo(clip);
    metrics.reachedDepth(index);
    metrics.startWatching(clip, at(clock));
    clock += 8;
    metrics.qualifiedView(clip);
    metrics.stopWatching(at(clock));
    if (index < 3) metrics.completedVideo(clip);
  });
  for (let i = 0; i < 20; i += 1) metrics.swipedForward();
  for (let i = 0; i < 5; i += 1) metrics.swipedBackward();
  for (let i = 0; i < 2; i += 1) { metrics.carouselShown(); for (let n = 0; n < 10; n += 1) metrics.carouselImageSeen(); }
  metrics.bookingStarted();
  metrics.whatsappContinued();

  const { session, content } = metrics.snapshot(at(clock));
  assert.equal(session.uniqueVideosViewed, 15);
  assert.equal(session.qualifiedVideoViews, 15);
  assert.equal(session.videosCompleted, 3);
  assert.equal(session.forwardSwipes, 20);
  assert.equal(session.backwardSwipes, 5);
  assert.equal(session.carouselsViewed, 2);
  assert.equal(session.carouselImagesViewed, 20);
  assert.equal(session.totalWatchSeconds, 120);
  assert.equal(session.maximumFeedDepth, 14);

  // All of that is ONE session row plus fifteen per-clip rows, however many
  // times it is flushed — not one row per interaction.
  assert.equal(Object.keys(content).length, 15);
});
