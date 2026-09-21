import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

import { ARTIST_SOURCES, PROJECT_ROOT } from '../media/config.mjs';
import { discoverMedia } from '../media/discover.mjs';

/**
 * Discovery used to learn artist folders by parsing `src/data/artists.ts` with
 * regular expressions. Removing the `import.meta.glob` calls that Vite was
 * emitting 6.2 MB of unused originals from would have made it quietly find
 * fewer assets. These pin the replacement.
 */

test('every configured artist folder exists on disk', () => {
  for (const artist of ARTIST_SOURCES) {
    assert.ok(artist.folder, `${artist.id} has no folder`);
    assert.ok(
      fs.existsSync(`${PROJECT_ROOT}/${artist.folder}`),
      `${artist.id}: folder "${artist.folder}" is missing`,
    );
    assert.ok(
      fs.existsSync(`${PROJECT_ROOT}/${artist.portrait}`),
      `${artist.id}: portrait "${artist.portrait}" is missing`,
    );
  }
});

test('artist ids are unique and stable', () => {
  const ids = ARTIST_SOURCES.map(a => a.id);
  assert.equal(new Set(ids).size, ids.length);
  // These are also the Cloudinary public ids for the portraits, so a rename
  // would orphan an uploaded asset.
  assert.deepEqual(ids, [
    'bang-bang', 'solar', 'jay-shin', 'sara-kori', 'victor',
    'saint', 'pawel', 'tee', 'nemo', 'natashia',
  ]);
});

test('discovery finds the whole library without reading application source', async () => {
  const { assets } = await discoverMedia({ withHashes: false });
  // The number that must not move: 46 videos, 31 carousel, 10 portraits,
  // 161 gallery images, 1 branding clip.
  assert.equal(assets.length, 249);

  const byCategory = {};
  for (const asset of assets) byCategory[asset.category] = (byCategory[asset.category] ?? 0) + 1;
  assert.deepEqual(byCategory, {
    videos: 46, carousel: 31, artists: 10, galleries: 161, branding: 1,
  });
});

test('every artist still has their gallery discovered', async () => {
  const { assets } = await discoverMedia({ withHashes: false });
  const galleries = assets.filter(a => a.category === 'galleries');
  for (const artist of ARTIST_SOURCES) {
    const count = galleries.filter(a => a.artistId === artist.id).length;
    assert.ok(count > 0, `${artist.id} has no gallery images discovered`);
  }
  // A portrait per artist, and no more.
  const portraits = assets.filter(a => a.category === 'artists');
  assert.equal(portraits.length, ARTIST_SOURCES.length);
  assert.equal(new Set(portraits.map(a => a.artistId)).size, ARTIST_SOURCES.length);
});

test('no two assets claim the same Cloudinary public id', async () => {
  const { assets } = await discoverMedia({ withHashes: false });
  const ids = assets.map(a => a.publicId);
  assert.equal(new Set(ids).size, ids.length, 'a duplicate public id would overwrite an uploaded asset');
});

test('gallery ordering within an artist is stable and contiguous', async () => {
  const { assets } = await discoverMedia({ withHashes: false });
  for (const artist of ARTIST_SOURCES) {
    const gallery = assets
      .filter(a => a.category === 'galleries' && a.artistId === artist.id)
      .map(a => a.order);
    assert.deepEqual(
      gallery,
      gallery.map((_, index) => index),
      `${artist.id}: gallery order must be 0..n-1 in discovery order`,
    );
  }
});

test("an artist's portrait is never also counted as a gallery image", async () => {
  const { assets } = await discoverMedia({ withHashes: false });
  for (const artist of ARTIST_SOURCES) {
    const inGallery = assets.some(
      a => a.category === 'galleries' && a.relativePath === artist.portrait,
    );
    assert.equal(inGallery, false, `${artist.id}: portrait leaked into the gallery`);
  }
});
