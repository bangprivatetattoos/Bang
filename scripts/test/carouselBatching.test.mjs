import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CAROUSEL_BATCH_SIZE, batchIndexFor, computeBatchRanges,
} from '../../src/features/video-feed/data/carouselBatching.ts';

/** Batch sizes for a collection of `total` images. */
const sizes = total => computeBatchRanges(total).map(({ start, end }) => end - start);

test('batch size is ten', () => {
  assert.equal(CAROUSEL_BATCH_SIZE, 10);
});

test('31 images split 10 / 10 / 10 / 1 — the single trailing image is its own batch', () => {
  assert.deepEqual(sizes(31), [10, 10, 10, 1]);
});

test('35 images split 10 / 10 / 10 / 5', () => {
  assert.deepEqual(sizes(35), [10, 10, 10, 5]);
});

test('30 images split evenly with no empty trailing batch', () => {
  assert.deepEqual(sizes(30), [10, 10, 10]);
});

test('9 images make one short batch', () => {
  assert.deepEqual(sizes(9), [9]);
});

test('1 image makes one batch of one', () => {
  assert.deepEqual(sizes(1), [1]);
});

test('0 images make no batches', () => {
  assert.deepEqual(sizes(0), []);
});

test('a short final batch is never merged backwards', () => {
  // The rule this replaced folded a remainder under three into its
  // predecessor, turning 31 into 10/10/11. Guard against that returning.
  for (const total of [21, 22, 31, 32, 41, 42]) {
    const batches = sizes(total);
    assert.ok(
      batches.every(size => size <= CAROUSEL_BATCH_SIZE),
      `${total} images produced an oversized batch: ${batches.join(', ')}`,
    );
  }
  assert.deepEqual(sizes(21), [10, 10, 1]);
  assert.deepEqual(sizes(22), [10, 10, 2]);
});

test('a short final batch is never padded with repeats', () => {
  const ranges = computeBatchRanges(31);
  const last = ranges[ranges.length - 1];
  assert.equal(last.end - last.start, 1);
  assert.equal(last.start, 30);
  assert.equal(last.end, 31);
});

test('every image appears exactly once across one cycle', () => {
  for (const total of [1, 9, 30, 31, 35, 100]) {
    const seen = [];
    for (const { start, end } of computeBatchRanges(total)) {
      for (let index = start; index < end; index += 1) seen.push(index);
    }
    assert.equal(seen.length, total, `${total}: wrong number of images in a cycle`);
    assert.equal(new Set(seen).size, total, `${total}: an image repeated within a cycle`);
    assert.deepEqual(seen, [...seen].sort((a, b) => a - b), `${total}: order was not sequential`);
  }
});

test('batches run in manifest order, never shuffled', () => {
  const ranges = computeBatchRanges(31);
  assert.deepEqual(ranges.map(r => r.start), [0, 10, 20, 30]);
  assert.deepEqual(ranges.map(r => r.end), [10, 20, 30, 31]);
});

test('interludes walk forward and wrap to the first batch', () => {
  const count = computeBatchRanges(31).length;
  assert.equal(count, 4);
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5, 6, 7].map(i => batchIndexFor(i, count)),
    [0, 1, 2, 3, 0, 1, 2, 3],
    'the fifth interlude should wrap back to batch one',
  );
});

test('one cycle of interludes covers every image exactly once', () => {
  const total = 31;
  const ranges = computeBatchRanges(total);
  const seen = new Set();
  for (let interlude = 0; interlude < ranges.length; interlude += 1) {
    const { start, end } = ranges[batchIndexFor(interlude, ranges.length)];
    for (let index = start; index < end; index += 1) {
      assert.ok(!seen.has(index), `image ${index} appeared twice before the sequence wrapped`);
      seen.add(index);
    }
  }
  assert.equal(seen.size, total);
});

test('batchIndexFor is safe for an empty collection', () => {
  assert.equal(batchIndexFor(0, 0), 0);
  assert.equal(batchIndexFor(7, 0), 0);
});

// The generated manifest is the collection the carousel actually cuts up, so
// the rule is checked against the real 31 images, not only synthetic counts.
test('the real carousel manifest batches 10 / 10 / 10 / 1', async () => {
  const { default: manifest } = await import('../../src/media/manifest.json', { with: { type: 'json' } });
  const carousel = manifest.assets?.carousel ?? [];
  assert.equal(carousel.length, 31, 'expected 31 unique carousel images');
  assert.deepEqual(sizes(carousel.length), [10, 10, 10, 1]);

  const orders = carousel.map(asset => asset.carouselOrder);
  assert.deepEqual(orders, [...orders].sort((a, b) => a - b), 'manifest is not in carouselOrder order');
  assert.deepEqual(orders, Array.from({ length: 31 }, (_, i) => i + 1), 'carouselOrder is not 1..31');

  // Walk a full cycle of interludes and collect what each one shows.
  const ranges = computeBatchRanges(carousel.length);
  const shown = [];
  for (let interlude = 0; interlude < ranges.length; interlude += 1) {
    const { start, end } = ranges[batchIndexFor(interlude, ranges.length)];
    shown.push(...carousel.slice(start, end).map(asset => asset.carouselOrder));
  }
  assert.deepEqual(shown, orders, 'a cycle did not show every carouselOrder exactly once, in order');
  assert.equal(new Set(shown).size, 31, 'an image appeared twice before the sequence wrapped');
});
