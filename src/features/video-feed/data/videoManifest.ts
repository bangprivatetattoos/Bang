import type { FeedVideo } from '../types';
import { VIDEO_ARTIST_MAP } from './videoArtistMap';
import { DEFAULT_VIDEO_COPY, VIDEO_COPY_OVERRIDES } from './videoContent';
import { ARTISTS } from '../../../data/artists';

/**
 * The real tattoo clips live in `/sitevideos` at the repository root, which is
 * outside `src` but still inside Vite's project root, so the asset pipeline
 * can fingerprint and emit them exactly as it already does for the artist
 * galleries in `src/data/artists.ts`.
 *
 * `query: '?url'` means this eager glob only pulls the resolved URL strings
 * into the bundle — the clips themselves stay separate files that the browser
 * fetches on demand, so landing on the feed does not download 130 MB of video.
 */
const videoAssets = import.meta.glob<string>('../../../../sitevideos/*.{mp4,webm,m4v,mov,MP4,WEBM,M4V,MOV}', {
  eager: true,
  query: '?url',
  import: 'default',
});

/** Extensions browsers can play from a progressive <video> element. */
const PLAYABLE = new Set(['mp4', 'webm', 'm4v']);

const fileNameOf = (path: string) => path.split('/').pop() ?? path;
const extensionOf = (path: string) => (fileNameOf(path).split('.').pop() ?? '').toLowerCase();

function contentId(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * The clips are named with a numeric prefix (`0-`, `1-`, … `45-`). Sorting on
 * that keeps the manifest order stable and human-predictable; the feed itself
 * randomises playback order on top of it.
 */
function sortKey(fileName: string) {
  const leading = /^(\d+)/.exec(fileName);
  return leading ? Number.parseInt(leading[1], 10) : Number.MAX_SAFE_INTEGER;
}

const entries = Object.entries(videoAssets).sort(([a], [b]) => {
  const byNumber = sortKey(fileNameOf(a)) - sortKey(fileNameOf(b));
  return byNumber !== 0 ? byNumber : a.localeCompare(b);
});

/** Source files whose container the browser cannot be relied on to play. */
export const UNSUPPORTED_VIDEO_FILES: string[] = entries
  .filter(([path]) => !PLAYABLE.has(extensionOf(path)))
  .map(([path]) => fileNameOf(path));

const knownArtistIds = new Set(ARTISTS.map(artist => artist.id));

export const FEED_VIDEOS: FeedVideo[] = entries
  .filter(([path]) => PLAYABLE.has(extensionOf(path)))
  .map(([path, src], index) => {
    const fileName = fileNameOf(path);
    const id = contentId(fileName);
    const mapped = VIDEO_ARTIST_MAP[id];
    const base = DEFAULT_VIDEO_COPY[index % DEFAULT_VIDEO_COPY.length];
    const override = VIDEO_COPY_OVERRIDES[id] ?? {};

    return {
      id,
      src,
      fileName,
      // An unrecognised artist id is dropped rather than rendered, so a typo in
      // the mapping can never surface as a broken or invented attribution.
      artistId: mapped && knownArtistIds.has(mapped) ? mapped : null,
      label: override.label ?? base.label,
      caption: override.caption ?? base.caption,
      cta: override.cta ?? base.cta,
    };
  });

if (import.meta.env.DEV) {
  if (UNSUPPORTED_VIDEO_FILES.length) {
    console.warn(
      `[video-feed] ${UNSUPPORTED_VIDEO_FILES.length} file(s) in /sitevideos use a container that is not reliably playable in browsers and were excluded:`,
      UNSUPPORTED_VIDEO_FILES,
    );
  }
  const unmapped = FEED_VIDEOS.filter(video => video.artistId === null);
  if (unmapped.length) {
    console.info(
      `[video-feed] ${unmapped.length}/${FEED_VIDEOS.length} clips have no artist mapping and render under the BANG studio identity. Content ids:`,
      unmapped.map(video => video.id),
    );
  }
}
