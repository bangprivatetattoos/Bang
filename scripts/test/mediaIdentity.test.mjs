import assert from 'node:assert/strict';
import { test } from 'node:test';

import { assertStableIdentity, feedContentId, toPublicId } from '../media/discover.mjs';

/**
 * The identity guard exists to protect engagement data.
 *
 * A content id is the key comments, reactions, analytics and feed history are
 * stored under. If two clips ever resolved to one id they would share all of
 * it, irreversibly — so the sync must refuse to run rather than proceed.
 */

const asset = (relativePath, contentId, publicId, category = 'videos') => ({
  relativePath, contentId, publicId, category,
});

test('accepts a library whose ids are all distinct', () => {
  assert.doesNotThrow(() => assertStableIdentity([
    asset('sitevideos/a.mp4', 'a', 'bang-private-tattoos/videos/a'),
    asset('sitevideos/b.mp4', 'b', 'bang-private-tattoos/videos/b'),
  ]));
});

test('refuses two clips that resolve to one content id', () => {
  assert.throws(
    () => assertStableIdentity([
      asset('sitevideos/one.mp4', 'shared-id', 'bang-private-tattoos/videos/one'),
      asset('sitevideos/two.mp4', 'shared-id', 'bang-private-tattoos/videos/two'),
    ]),
    error => {
      assert.match(error.message, /Content id "shared-id" is claimed by 2 files/);
      assert.match(error.message, /sitevideos\/one\.mp4/);
      assert.match(error.message, /sitevideos\/two\.mp4/);
      // The point of the guard: it stops, rather than resolving the clash.
      assert.match(error.message, /nothing was uploaded/);
      return true;
    },
  );
});

test('refuses two files that resolve to one Cloudinary public id', () => {
  assert.throws(
    () => assertStableIdentity([
      asset('sitevideos/one.mp4', 'one', 'bang-private-tattoos/videos/same'),
      asset('sitevideos/two.mp4', 'two', 'bang-private-tattoos/videos/same'),
    ]),
    /Cloudinary public id "bang-private-tattoos\/videos\/same" is claimed by 2 files/,
  );
});

test('the same content id in two categories is not a collision', () => {
  // Content ids are only ever looked up within their own category, so a clip
  // and a carousel card may legitimately share a slug.
  assert.doesNotThrow(() => assertStableIdentity([
    asset('sitevideos/x.mp4', 'shared', 'bang-private-tattoos/videos/x', 'videos'),
    asset('caro images/x.jpg', 'shared', 'bang-private-tattoos/carousel/x', 'carousel'),
  ]));
});

test('truncation at 80 characters is what makes the guard necessary', () => {
  // Two real-shaped names that agree for the first 80 characters collapse to
  // one content id. This is the failure the guard is here to catch.
  const prefix = '15-Everything is my work except the reaper valley-quote on the outer calf . The knee';
  const a = `${prefix} and the shoulder.mp4`;
  const b = `${prefix} and the ribs.mp4`;
  assert.equal(feedContentId(a), feedContentId(b));

  assert.throws(
    () => assertStableIdentity([
      asset(`sitevideos/${a}`, feedContentId(a), toPublicId('bang-private-tattoos/videos', a)),
      asset(`sitevideos/${b}`, feedContentId(b), toPublicId('bang-private-tattoos/videos', b)),
    ]),
    /Content id/,
  );
});
