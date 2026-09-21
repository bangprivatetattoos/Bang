import type { FeedVideo } from '../types';
import { VIDEO_ARTIST_MAP } from './videoArtistMap';
import { DEFAULT_VIDEO_COPY, VIDEO_COPY_OVERRIDES } from './videoContent';
import { ARTISTS } from '../../../data/artists';
import { assetsIn, videoUrl, viewportVideoTier } from '../../../media/delivery';

/**
 * The feed's clips, taken from the generated media manifest.
 *
 * The clips themselves live in Cloudinary. They are deliberately NOT globbed
 * out of `/sitevideos` any more: an eager `import.meta.glob` made Vite copy
 * all 46 originals into `dist`, which put ~129 MB of video into every
 * production deploy for files the browser then fetched from a CDN instead.
 * The manifest carries the identifiers, so the bundle carries none of the
 * bytes.
 *
 * The originals stay on disk, untracked, as the rollback source.
 */

/**
 * Decided once, at module load.
 *
 * Re-deciding per render would swap a playing clip's source mid-feed, which is
 * far more disruptive than serving one encode tier to a visitor who rotated
 * their phone.
 */
const DELIVERY_TIER = viewportVideoTier();

/**
 * Where the originals sit during development.
 *
 * A plain path, resolved at runtime, so nothing here is a module import and
 * the production build has nothing to bundle. Vite's dev server serves the
 * project root, so this works while developing and is simply absent in
 * production, where Cloudinary is the only source.
 */
const devLocalUrl = (fileName: string): string | null =>
  import.meta.env.DEV ? `/sitevideos/${encodeURIComponent(fileName)}` : null;

const fileNameOf = (source: string) => source.split('/').pop() ?? source;

/**
 * Manifest order is the numeric filename order the clips were supplied in
 * (`0-`, `1-`, … `45-`), because the generator sorts ids with numeric
 * collation. Keeping it means each clip draws the same default caption as
 * before; the feed randomises playback order on top of it regardless.
 */
const VIDEO_ASSETS = assetsIn('videos');

const knownArtistIds = new Set(ARTISTS.map(artist => artist.id));

export const FEED_VIDEOS: FeedVideo[] = VIDEO_ASSETS.map((asset, index) => {
  const fileName = fileNameOf(asset.source);
  // The manifest id IS the content id: comments, reactions, analytics and feed
  // history are keyed on it, so it is carried through untouched.
  const id = asset.id;
  const mapped = VIDEO_ARTIST_MAP[id];
  const base = DEFAULT_VIDEO_COPY[index % DEFAULT_VIDEO_COPY.length];
  const override = VIDEO_COPY_OVERRIDES[id] ?? {};

  const remote = videoUrl(asset, DELIVERY_TIER);
  const local = devLocalUrl(fileName);

  return {
    id,
    src: remote ?? local ?? '',
    localSrc: local,
    fileName,
    // An unrecognised artist id is dropped rather than rendered, so a typo in
    // the mapping can never surface as a broken or invented attribution.
    artistId: mapped && knownArtistIds.has(mapped) ? mapped : null,
    label: override.label ?? base.label,
    caption: override.caption ?? base.caption,
    cta: override.cta ?? base.cta,
  };
}).filter(video => video.src !== '');

if (import.meta.env.DEV) {
  if (VIDEO_ASSETS.length === 0) {
    console.warn(
      '[video-feed] The media manifest contains no videos. Run `npm run media:sync` to generate it.',
    );
  }
  const withoutRemote = FEED_VIDEOS.filter(video => video.src === video.localSrc);
  if (withoutRemote.length) {
    console.info(
      `[video-feed] ${withoutRemote.length}/${FEED_VIDEOS.length} clips have no Cloudinary URL and are being served from disk.`,
      withoutRemote.map(video => video.id),
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
