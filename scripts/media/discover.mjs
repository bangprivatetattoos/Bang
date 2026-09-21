import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  ARTIST_GALLERY_FOLDER, ARTIST_PORTRAIT_FOLDER, ARTISTS_SOURCE,
  IMAGE_EXTENSIONS, NOTEWORTHY_EXTENSIONS, PROJECT_ROOT, SOURCES, VIDEO_EXTENSIONS,
} from './config.mjs';

/**
 * Content hash of a file.
 *
 * SHA-256 over the bytes, streamed so a 7 MB clip never lands in memory whole.
 * A hash rather than a timestamp: copying a repository, checking it out fresh
 * or touching a file all move mtimes without changing a single byte, and any
 * of those would otherwise look like "this asset changed, re-upload it".
 */
export function hashFile(absolutePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(absolutePath);
    stream.on('error', reject);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

/**
 * Natural ordering, so `2.jpg` sorts before `10.jpg`.
 *
 * The carousel depends on this: its batches walk the collection in manifest
 * order, and a lexicographic sort would interleave them wrongly.
 */
export function naturalCompare(a, b) {
  return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
}

/**
 * A Cloudinary public id derived from the source path.
 *
 * Deterministic: the same file always resolves to the same id, so re-running
 * the sync updates an asset in place instead of creating another copy. The
 * readable stem is kept so the Cloudinary dashboard stays browsable.
 */
export function toPublicId(cloudinaryFolder, fileName) {
  const stem = fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 180);
  return `${cloudinaryFolder}/${stem || 'asset'}`;
}

/**
 * The feed's content id for a clip.
 *
 * Deliberately identical to `contentId()` in
 * `src/features/video-feed/data/videoManifest.ts`. Comments, reactions,
 * analytics and feed history are all keyed on it, so migrating the bytes to
 * Cloudinary must not change it.
 */
export function feedContentId(fileName) {
  return fileName
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Stops the sync before an identity collision can reach anything permanent.
 *
 * A content id is the key that comments, reactions, analytics and feed
 * history are all stored under, and it is derived from a slug truncated at 80
 * characters — so two long filenames sharing a prefix can resolve to one id.
 * Two clips sharing an id would silently share every comment and reaction on
 * either of them, and nothing afterwards could tell the two apart again.
 *
 * A Cloudinary public id is checked for the same reason on the remote side:
 * two assets resolving to one id means the second upload overwrites the first.
 *
 * Neither case is safe to resolve by guessing, so this throws. Renaming,
 * suffixing or merging automatically would move real engagement onto a new
 * key without anyone deciding that it should move.
 */
export function assertStableIdentity(assets) {
  const problems = [];

  const check = (label, keyOf, scopeOf) => {
    const seen = new Map();
    for (const asset of assets) {
      const key = keyOf(asset);
      if (!key) continue;
      // Content ids only have to be unique within their own category; public
      // ids have to be unique across the whole account.
      const scope = scopeOf(asset);
      const bucket = `${scope}\u0000${key}`;
      if (!seen.has(bucket)) seen.set(bucket, []);
      seen.get(bucket).push(asset.relativePath);
    }
    for (const [bucket, files] of seen) {
      if (files.length < 2) continue;
      const [, key] = bucket.split('\u0000');
      problems.push(`${label} "${key}" is claimed by ${files.length} files:\n    ${files.join('\n    ')}`);
    }
  };

  check('Content id', asset => asset.contentId, asset => asset.category);
  check('Cloudinary public id', asset => asset.publicId, () => 'all');

  if (problems.length === 0) return;

  throw new Error(
    `Media identity collision — nothing was uploaded and nothing was changed.\n\n${problems.join('\n\n')}\n\n`
    + 'Give one of the colliding files a source name that differs from the other\n'
    + 'within the first 80 characters of its slug, then run the sync again. No id\n'
    + 'is renamed or suffixed automatically: an id that already carries comments,\n'
    + 'reactions or analytics must not be moved without that being a decision.',
  );
}

function classify(fileName) {
  const extension = path.extname(fileName).toLowerCase();
  if (VIDEO_EXTENSIONS.has(extension)) return { resourceType: 'video', extension };
  if (IMAGE_EXTENSIONS.has(extension)) return { resourceType: 'image', extension };
  return { resourceType: null, extension };
}

async function listFiles(absoluteFolder) {
  try {
    const entries = await fs.readdir(absoluteFolder, { withFileTypes: true });
    return entries.filter(entry => entry.isFile()).map(entry => entry.name).sort(naturalCompare);
  } catch {
    return null;
  }
}

/**
 * Reads the real artist records so portraits and galleries follow the data
 * rather than a second copy of it kept in this script.
 *
 * `artists.ts` cannot be imported from Node — it uses `import.meta.glob` — so
 * the id and portrait path are read out of the source text.
 */
async function readArtists() {
  const source = await fs.readFile(ARTISTS_SOURCE, 'utf8');

  // A gallery folder is declared by its glob, not by the portrait path — one
  // artist's portrait lives at the repository root rather than beside her
  // gallery, so deriving the folder from the portrait would lose that gallery
  // entirely. Follow the real chain instead:
  //   <var>GalleryAssets = import.meta.glob('../../<FOLDER>/...')
  //   const <CONST>: GalleryImage[] = Object.entries(<var>GalleryAssets)
  //   { id: '<artist>', ..., gallery: <CONST> }
  const globFolders = new Map();
  const globPattern = /const\s+(\w+)\s*=\s*import\.meta\.glob<string>\('\.\.\/\.\.\/([^/']+)\//g;
  let globMatch;
  while ((globMatch = globPattern.exec(source)) !== null) {
    globFolders.set(globMatch[1], globMatch[2]);
  }

  const constFolders = new Map();
  const constPattern = /const\s+(\w+):\s*GalleryImage\[\]\s*=\s*Object\.entries\((\w+)\)/g;
  let constMatch;
  while ((constMatch = constPattern.exec(source)) !== null) {
    const folder = globFolders.get(constMatch[2]);
    if (folder) constFolders.set(constMatch[1], folder);
  }

  const artists = [];
  const blockPattern = /\{\s*\n\s*id: '([^']+)',[\s\S]*?portrait: new URL\('\.\.\/\.\.\/([^']+)', import\.meta\.url\)\.href,[\s\S]*?gallery: (\w+),/g;
  let match;
  while ((match = blockPattern.exec(source)) !== null) {
    const [, id, portraitPath, galleryConst] = match;
    artists.push({
      id,
      portraitPath,
      folder: constFolders.get(galleryConst) ?? null,
      portraitFile: portraitPath.slice(portraitPath.lastIndexOf('/') + 1),
    });
  }
  return artists;
}

/** One discovered asset, before any Cloudinary call. */
async function describe({ relativePath, category, cloudinaryFolder, extra = {} }) {
  const absolutePath = path.join(PROJECT_ROOT, relativePath);
  const fileName = path.basename(relativePath);
  const { resourceType, extension } = classify(fileName);
  const stats = await fs.stat(absolutePath);

  return {
    relativePath: relativePath.split(path.sep).join('/'),
    fileName,
    category,
    extension,
    resourceType,
    bytes: stats.size,
    publicId: resourceType ? toPublicId(cloudinaryFolder, fileName) : null,
    noteworthy: NOTEWORTHY_EXTENSIONS.has(extension),
    ...extra,
  };
}

/**
 * Walks every configured source and returns what is on disk.
 *
 * Nothing is moved, copied or written — discovery only reads.
 */
export async function discoverMedia({ withHashes = true } = {}) {
  const assets = [];
  const unsupported = [];
  const missingFolders = [];
  const folderMap = [];
  /** Repeats of an artwork already counted; skipped, never deleted on disk. */
  const duplicates = [];

  for (const source of SOURCES) {
    if (source.files) {
      for (const file of source.files) {
        try {
          await fs.access(path.join(PROJECT_ROOT, file));
        } catch {
          continue;
        }
        folderMap.push({ from: file, to: source.cloudinaryFolder, category: source.category });
        assets.push(await describe({ relativePath: file, category: source.category, cloudinaryFolder: source.cloudinaryFolder }));
      }
      continue;
    }

    let resolved = null;
    for (const folder of source.folders) {
      const files = await listFiles(path.join(PROJECT_ROOT, folder));
      if (files) { resolved = { folder, files }; break; }
    }
    if (!resolved) { missingFolders.push(source.folders[0]); continue; }

    folderMap.push({ from: `${resolved.folder}/`, to: source.cloudinaryFolder, category: source.category, count: resolved.files.length });

    let order = 0;
    // The carousel folder stores a few artworks twice under different ordering
    // prefixes. The application already skips the repeats, so the sync skips
    // the same ones: uploading them would put identical bytes in Cloudinary
    // under two ids, and numbering them would make the manifest disagree with
    // what the carousel actually renders.
    const seenArtwork = new Set();

    for (const fileName of resolved.files) {
      if (source.category === 'carousel') {
        const artworkKey = fileName.replace(/^\d+-/, '').toLowerCase();
        if (seenArtwork.has(artworkKey)) {
          duplicates.push({ relativePath: `${resolved.folder}/${fileName}`, category: source.category });
          continue;
        }
        seenArtwork.add(artworkKey);
      }

      const asset = await describe({
        relativePath: `${resolved.folder}/${fileName}`,
        category: source.category,
        cloudinaryFolder: source.cloudinaryFolder,
        extra: source.category === 'videos'
          // `assetFolder` is the Media Library folder this product
          // environment files the asset under. It is display placement only:
          // the public id, and therefore every delivery URL, is unaffected.
          // Carried for videos alone, because that is the category being
          // migrated — the already-uploaded categories are left exactly where
          // they are rather than being reorganised as a side effect.
          ? { contentId: feedContentId(fileName), assetFolder: source.cloudinaryFolder }
          // Carousel order is explicit and derived from natural sort, so the
          // generated manifest carries it rather than leaving the frontend to
          // re-sort strings. `carouselOrder` is the 1-based sequence the
          // batches are cut from.
          : source.category === 'carousel'
            ? { order, carouselOrder: ++order, contentId: fileName }
            : {},
      });
      if (!asset.resourceType) { unsupported.push(asset); continue; }
      assets.push(asset);
    }
  }

  // ── Artist portraits and galleries ───────────────────────────────────────
  const artists = await readArtists();
  for (const artist of artists) {
    const portraitRelative = artist.portraitPath;
    try {
      await fs.access(path.join(PROJECT_ROOT, portraitRelative));
      const portrait = await describe({
        relativePath: portraitRelative,
        category: 'artists',
        cloudinaryFolder: ARTIST_PORTRAIT_FOLDER,
        extra: { artistId: artist.id, role: 'portrait' },
      });
      // One portrait per artist, named for the artist rather than the file, so
      // replacing the photograph later keeps the same Cloudinary identifier.
      portrait.publicId = `${ARTIST_PORTRAIT_FOLDER}/${artist.id}`;
      if (portrait.resourceType) assets.push(portrait); else unsupported.push(portrait);
    } catch {
      missingFolders.push(portraitRelative);
    }

    if (!artist.folder) continue;
    const galleryFiles = await listFiles(path.join(PROJECT_ROOT, artist.folder));
    if (!galleryFiles) { missingFolders.push(artist.folder); continue; }

    folderMap.push({
      from: `${artist.folder}/`,
      to: `${ARTIST_GALLERY_FOLDER}/${artist.id}`,
      category: 'galleries',
      count: galleryFiles.length - 1,
    });

    let order = 0;
    for (const fileName of galleryFiles) {
      // The portrait lives in the same folder and is already mapped above.
      if (fileName === artist.portraitFile) continue;
      const asset = await describe({
        relativePath: `${artist.folder}/${fileName}`,
        category: 'galleries',
        cloudinaryFolder: `${ARTIST_GALLERY_FOLDER}/${artist.id}`,
        extra: { artistId: artist.id, order: order++ },
      });
      if (!asset.resourceType) { unsupported.push(asset); continue; }
      assets.push(asset);
    }
  }

  // Checked before hashing, so a collision fails in a second rather than
  // after reading 128 MB of video off disk.
  assertStableIdentity(assets);

  if (withHashes) {
    for (const asset of assets) {
      asset.sha256 = await hashFile(path.join(PROJECT_ROOT, asset.relativePath));
    }
  }

  return { assets, unsupported, missingFolders, folderMap, duplicates, artists };
}
