import type { Artist } from '../../data/artists';

/** A single item in the vertical discovery feed. */
export interface FeedVideo {
  /** Stable content id. Derived from the source filename, so it survives reordering. */
  id: string;
  /**
   * Where the clip is actually fetched from: the Cloudinary delivery URL once
   * the asset has been migrated, otherwise the bundled original.
   */
  src: string;
  /**
   * The original on disk, during development only.
   *
   * Null in production: the originals are not shipped in the bundle, so there
   * is nothing local to fall back to there. Cloudinary is the only source.
   */
  localSrc: string | null;
  /**
   * A still of the clip's first frame, from Cloudinary.
   *
   * Shown while the clip buffers, so a swipe lands on the image the video is
   * about to start on rather than on an empty frame.
   */
  poster: string | null;
  /** Original filename, kept so mappings can be authored against what is on disk. */
  fileName: string;
  /**
   * Authoritative artist attribution, or null when no mapping has been supplied.
   * A null artist renders the BANG PRIVATE TATTOOS studio treatment; the feed
   * never guesses which artist produced a piece.
   */
  artistId: string | null;
  /** Small-caps eyebrow above the caption. */
  label: string;
  /** Caption body. Newlines are preserved. */
  caption: string;
  /** Muted supporting line under the caption. */
  cta: string;
}

/** Either a real artist record or the studio-level BANG identity. */
export type FeedAttribution =
  | { kind: 'artist'; artist: Artist }
  | { kind: 'studio'; name: string; label: string };

export type ReactionKind = 'like' | 'love';

export interface ReactionState {
  /** Total reactions recorded for this content id, or null while unknown. */
  counts: Record<ReactionKind, number> | null;
  /** The reaction this visitor has left, if any. */
  mine: ReactionKind | null;
}

export interface OfficialReply {
  id: string;
  body: string;
  createdAt: string;
}

export interface PublicComment {
  id: string;
  /** Null when the visitor left the name blank; rendered as "Anonymous". */
  displayName: string | null;
  comment: string;
  createdAt: string;
  reactionCount: number;
  replies: OfficialReply[];
}

/** A screen the feed can be showing. */
export type FeedScreen = { kind: 'video'; video: FeedVideo } | { kind: 'interlude' };

export type FeedSheet = 'none' | 'comments' | 'booking';
