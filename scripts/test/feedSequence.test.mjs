import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  INTERLUDE_EVERY, createState, extend, upcomingVideoIndices,
} from '../../src/features/video-feed/hooks/feedSequence.ts';

const POOL = 46;

/** Walks the feed forward the way a visitor does, with a given lookahead. */
function walk(lookahead, steps) {
  let state = createState(POOL, lookahead);
  const visited = [state.entries[0]];
  for (let i = 1; i <= steps; i += 1) {
    state = extend(state, i + lookahead, POOL);
    state = { ...state, position: i };
    visited.push(state.entries[i]);
  }
  return { state, visited };
}

test('the interlude lands after exactly five newly discovered clips', () => {
  const { visited } = walk(2, 6);
  const kinds = visited.map(entry => entry.kind);
  assert.deepEqual(kinds.slice(0, 5), ['video', 'video', 'video', 'video', 'video']);
  assert.equal(kinds[5], 'interlude', 'position 5 must be the carousel');
});

test('looking further ahead does NOT skip or move the carousel', () => {
  // The regression this guards: preparing the first five clips up front must
  // not consume the discovery count and push the interlude out of the way.
  for (const lookahead of [2, 3, 5, 6, 8]) {
    const { visited } = walk(lookahead, 6);
    const kinds = visited.map(entry => entry.kind);
    assert.deepEqual(
      kinds,
      ['video', 'video', 'video', 'video', 'video', 'interlude', 'video'],
      `lookahead ${lookahead} changed the sequence`,
    );
  }
});

test('a deeper lookahead decides the same entries, only sooner', () => {
  // Same bag would be needed for identical indices, which shuffling prevents,
  // so this asserts the SHAPE is identical — which is what ordering depends on.
  const shallow = walk(2, 12).visited.map(e => e.kind);
  const deep = walk(6, 12).visited.map(e => e.kind);
  assert.deepEqual(shallow, deep);
});

test('interludes recur every five clips, and each takes the next batch', () => {
  const { visited } = walk(5, 17);
  const interludeAt = visited
    .map((entry, index) => (entry.kind === 'interlude' ? index : -1))
    .filter(index => index >= 0);
  // Five videos, carousel, five videos, carousel, and so on.
  assert.deepEqual(interludeAt, [5, 11, 17]);
  const indices = interludeAt.map(at => visited[at].interludeIndex);
  assert.deepEqual(indices, [0, 1, 2], 'each interlude must take the next carousel batch');
});

test('every clip in a discovery batch is distinct and none repeats itself', () => {
  const { visited } = walk(5, 5);
  const indices = visited.filter(e => e.kind === 'video').map(e => e.index);
  assert.equal(new Set(indices).size, indices.length, 'a batch must not repeat a clip');
});

test('upcoming lookup reads decided entries and never mints new ones', () => {
  const state = createState(POOL, 5);
  const before = JSON.parse(JSON.stringify(state));
  const next = upcomingVideoIndices(state, 1, 4);
  // Asking what is next must not advance the feed or consume the bag.
  assert.deepEqual(state, before);
  assert.ok(next.length <= 4);
  for (const index of next) assert.ok(index >= 0 && index < POOL);
});

test('upcoming lookup skips interludes and returns clips only', () => {
  const state = createState(POOL, 8);
  const entries = state.entries;
  const interlude = entries.findIndex(e => e.kind === 'interlude');
  assert.ok(interlude > 0, 'this fixture needs an interlude in range');
  const next = upcomingVideoIndices(state, 0, 6);
  // Interludes have no clip index, so they simply do not appear.
  assert.equal(next.length, entries.slice(0, entries.length).filter(e => e.kind === 'video').slice(0, 6).length);
});

test('INTERLUDE_EVERY is the single source of the cadence', () => {
  assert.equal(INTERLUDE_EVERY, 5);
});
