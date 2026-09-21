import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Everything this project publishes lives under one Cloudinary root folder. */
export const CLOUDINARY_ROOT = 'bang-private-tattoos';

/** Where the sync records what it has already uploaded. Committed on purpose:
 *  it is the shared memory that stops two machines uploading the same file
 *  twice under different identifiers. */
export const SYNC_STATE_PATH = path.join(PROJECT_ROOT, 'media', 'sync-state.json');

/** The frontend-safe manifest the application reads. Generated, never edited. */
export const FRONTEND_MANIFEST_PATH = path.join(PROJECT_ROOT, 'src', 'media', 'manifest.json');

/** Extensions Cloudinary handles as video, and as image. */
export const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.m4v']);
export const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.jfif']);

/**
 * Extensions that upload correctly but are worth flagging.
 *
 * `.jfif` is ordinary JPEG data under a legacy extension. Cloudinary sniffs
 * the bytes so it uploads as an image without trouble, but the extension is
 * unusual enough to surface in the report rather than pass silently.
 */
export const NOTEWORTHY_EXTENSIONS = new Set(['.jfif']);

/**
 * Where media actually lives in this repository.
 *
 * Folder names are the real ones on disk — including the space in
 * "caro images" — rather than tidied guesses. Alternates are listed so the
 * folder can be renamed later without a code change.
 */
export const SOURCES = [
  {
    category: 'videos',
    folders: ['sitevideos'],
    cloudinaryFolder: `${CLOUDINARY_ROOT}/videos`,
    expects: 'video',
  },
  {
    category: 'carousel',
    folders: ['caro images', 'sitecarousel', 'carousel'],
    cloudinaryFolder: `${CLOUDINARY_ROOT}/carousel`,
    expects: 'image',
  },
  {
    category: 'branding',
    // Loose files at the repository root rather than a folder of their own.
    files: ['hero video.mp4'],
    cloudinaryFolder: `${CLOUDINARY_ROOT}/branding`,
    expects: 'any',
  },
];

/**
 * Artist portraits and galleries are derived from `src/data/artists.ts` at
 * discovery time rather than duplicated here, so the mapping cannot drift
 * away from the real artist records.
 */
export const ARTISTS_SOURCE = path.join(PROJECT_ROOT, 'src', 'data', 'artists.ts');
export const ARTIST_PORTRAIT_FOLDER = `${CLOUDINARY_ROOT}/artists`;
export const ARTIST_GALLERY_FOLDER = `${CLOUDINARY_ROOT}/galleries`;
