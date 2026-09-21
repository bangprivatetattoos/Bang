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
 * Where each artist's media lives on disk.
 *
 * Declared here rather than parsed out of `src/data/artists.ts`, which is how
 * this used to work. Reading folder names back out of React source with
 * regular expressions meant the media tooling silently depended on the exact
 * shape of application code: renaming a variable, or removing the
 * `import.meta.glob` calls that Vite was emitting megabytes of unused images
 * from, would have made discovery quietly find fewer assets rather than fail.
 *
 * `portrait` is repository-relative because one of them is not inside the
 * artist's own folder.
 *
 * The ids match `src/data/artists.ts` exactly; they are also the Cloudinary
 * public ids for the portraits, so they must not be renamed casually.
 */
export const ARTIST_SOURCES = [
  { id: 'bang-bang', folder: 'Bang Bang', portrait: 'Bang Bang/BBFINAL2018.webp' },
  { id: 'solar', folder: 'Solar', portrait: 'Solar/IMG_4930.webp' },
  { id: 'jay-shin', folder: 'JAY SHIN', portrait: 'JAY SHIN/JAY232.jpg' },
  { id: 'sara-kori', folder: 'SARA Kori', portrait: 'SARA Kori/Sara_Kori_Website_photo.jpg' },
  { id: 'victor', folder: 'victor', portrait: 'victor/Victor_Final_.jpg' },
  { id: 'saint', folder: 'saint', portrait: 'saint/Screenshot_2024-08-24_at_4.27.20 PM.png' },
  { id: 'pawel', folder: 'Pawel', portrait: 'Pawel/pawel.jpg' },
  { id: 'tee', folder: 'TEE', portrait: 'TEE/DSC00288.jpg' },
  { id: 'nemo', folder: 'nemo', portrait: 'nemo/DSC00408.jfif' },
  // Her portrait sits at the repository root rather than beside her gallery.
  { id: 'natashia', folder: 'NATASHIA', portrait: 'NTS241.jpg' },
];
export const ARTIST_PORTRAIT_FOLDER = `${CLOUDINARY_ROOT}/artists`;
export const ARTIST_GALLERY_FOLDER = `${CLOUDINARY_ROOT}/galleries`;
