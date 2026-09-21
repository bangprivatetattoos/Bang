/**
 * Cloudinary delivery for the application.
 *
 * The frontend never talks to the Cloudinary API and never holds a credential
 * — it only builds delivery URLs from public identifiers in the generated
 * manifest. The cloud name is public by design: it appears in every URL.
 *
 * Nothing here uploads. Uploading is `npm run media:sync`, which runs in Node.
 */

import manifest from './manifest.json';

export type MediaCategory = 'videos' | 'carousel' | 'artists' | 'galleries' | 'branding';

export interface MediaAsset {
  /** Stable content id — for clips this is the feed/comments/analytics key. */
  id: string;
  publicId: string;
  resourceType: 'image' | 'video';
  format: string | null;
  width: number | null;
  height: number | null;
  duration?: number;
  bytes: number;
  category: MediaCategory;
  artistId?: string;
  /** Zero-based position within its category. */
  order?: number;
  /** One-based carousel sequence. Authoritative for batch composition. */
  carouselOrder?: number;
  /** Repository-relative original, used as the development fallback. */
  source: string;
}

interface Manifest {
  generatedAt: string;
  cloudName: string;
  counts: Partial<Record<MediaCategory, number>>;
  assets: Partial<Record<MediaCategory, MediaAsset[]>>;
}

const data = manifest as unknown as Manifest;

/** Configured cloud name, preferring the build-time value. */
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim() || data.cloudName || '';

const BASE = CLOUD_NAME ? `https://res.cloudinary.com/${CLOUD_NAME}` : '';

export const MEDIA_MANIFEST_READY = Boolean(CLOUD_NAME) && Object.keys(data.assets ?? {}).length > 0;

export function assetsIn(category: MediaCategory): MediaAsset[] {
  return data.assets?.[category] ?? [];
}

const byId = new Map<string, MediaAsset>();
for (const list of Object.values(data.assets ?? {})) {
  for (const asset of list ?? []) byId.set(asset.id, asset);
}

export function assetById(id: string): MediaAsset | undefined {
  return byId.get(id);
}

/**
 * Named image treatments.
 *
 * Every one asks for automatic quality and automatic format, so a browser
 * that supports AVIF or WebP is served it without the manifest knowing.
 * `c_limit` means an asset is never scaled up past its own resolution — a
 * 736px source stays 736px rather than being stretched to a requested 1200.
 */
const IMAGE_TRANSFORMS = {
  /** Small square-ish crop for avatars and rail portraits. */
  thumbnail: 'f_auto,q_auto,c_fill,g_auto,w_160,h_160,dpr_auto',
  /** Portrait card in the carousel interlude. */
  carousel: 'f_auto,q_auto,c_fill,g_auto,w_460,h_650,dpr_auto',
  /** Grid tile in an artist gallery. */
  gallery: 'f_auto,q_auto,c_limit,w_800,dpr_auto',
  /** Full-screen viewer. */
  full: 'f_auto,q_auto,c_limit,w_1600,dpr_auto',
  /** Artist portrait on a profile page. */
  portrait: 'f_auto,q_auto,c_fill,g_auto,w_640,h_800,dpr_auto',
} as const;

export type ImageTreatment = keyof typeof IMAGE_TRANSFORMS;

/**
 * Video delivery.
 *
 * `f_auto` lets Cloudinary pick the container the browser prefers, `q_auto`
 * the bitrate and `vc_auto` the codec. Nothing here preloads: the feed still
 * mounts only the previous, current and next clip, so moving to Cloudinary
 * changes where the bytes come from, not how many are fetched.
 */

/**
 * The widest frame each device tier ever needs from the portrait feed.
 *
 * Paired with `c_limit`, which scales down and never up. The current library
 * tops out at 720x1280, so a phone already receives the source resolution and
 * these ceilings cost it nothing; they exist so a higher-resolution clip added
 * later cannot quietly start shipping a desktop-sized encode to a phone, and
 * so no clip is ever upscaled past its own resolution.
 */
const VIDEO_WIDTHS = { mobile: 720, tablet: 1080, desktop: 1280 } as const;

export type VideoTier = keyof typeof VIDEO_WIDTHS;

const videoTransform = (tier: VideoTier) => `f_auto,q_auto,vc_auto,c_limit,w_${VIDEO_WIDTHS[tier]}`;

/**
 * The poster frame for a tier: the still at zero seconds.
 *
 * `c_limit` rather than `c_fill` so the poster keeps the clip's own aspect
 * ratio. The feed applies `object-fit: cover` to both, and a poster cropped
 * on a different rule would jump visibly the moment playback starts.
 */
const posterTransform = (tier: VideoTier) => `f_auto,q_auto,c_limit,w_${VIDEO_WIDTHS[tier]},so_0`;

function deliver(resourceType: 'image' | 'video', publicId: string, transform: string, extension?: string) {
  if (!BASE) return null;
  const suffix = extension ? `.${extension}` : '';
  return `${BASE}/${resourceType}/upload/${transform}/${publicId}${suffix}`;
}

/**
 * A delivery URL for an image.
 *
 * Returns null when the asset has not been migrated yet, so the caller can
 * fall back to the local file in development and surface the gap in
 * production rather than rendering a broken image.
 */
export function imageUrl(asset: MediaAsset | undefined, treatment: ImageTreatment = 'gallery'): string | null {
  if (!asset || asset.resourceType !== 'image') return null;
  return deliver('image', asset.publicId, IMAGE_TRANSFORMS[treatment]);
}

/** Delivery URL for a clip. The feed is portrait-first, so `mobile` is the default. */
export function videoUrl(asset: MediaAsset | undefined, tier: VideoTier = 'mobile'): string | null {
  if (!asset || asset.resourceType !== 'video') return null;
  return deliver('video', asset.publicId, videoTransform(tier));
}

/** Poster frame for a clip, so the feed has something to show while buffering. */
export function videoPosterUrl(asset: MediaAsset | undefined, tier: VideoTier = 'mobile'): string | null {
  if (!asset || asset.resourceType !== 'video') return null;
  // A still from a clip is requested from the *video* resource type with an
  // image extension — /video/upload/<transform>/<id>.jpg. Asking
  // /image/upload/ for a video's public id returns 404: there is no image
  // asset under that id.
  return deliver('video', asset.publicId, posterTransform(tier), 'jpg');
}

/**
 * Resolves a delivery URL, falling back to the bundled local file.
 *
 * During the migration most assets are still local. Development quietly uses
 * the local copy; a production build logs the gap once so an unmigrated asset
 * is visible rather than silently broken.
 */
const reported = new Set<string>();

export function resolveMedia(id: string, localUrl: string | null, treatment: ImageTreatment = 'gallery'): string | null {
  const asset = assetById(id);
  const remote = asset?.resourceType === 'video' ? videoUrl(asset) : imageUrl(asset, treatment);
  if (remote) return remote;

  if (!import.meta.env.DEV && !reported.has(id)) {
    reported.add(id);
    console.warn(`[media] "${id}" is not in the Cloudinary manifest; serving the bundled original.`);
  }
  return localUrl;
}
