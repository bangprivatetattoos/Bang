import type { FeedAttribution, ReactionKind, ReactionState } from './types';
import ReactionPicker from './ReactionPicker';
import { CalendarIcon, CommentIcon } from './ui/icons';

interface Props {
  /** Current clip id, used for the reaction control's count. */
  contentId: string;
  attribution: FeedAttribution;
  reaction: ReactionState;
  commentCount: number | null;
  onBook: () => void;
  onReact: (reaction: ReactionKind | null) => void;
  onOpenComments: () => void;
  /** Only provided when the clip has an authoritative artist mapping. */
  onOpenArtist?: () => void;
}

/** The BANG monogram, used whenever a clip has no confirmed artist mapping. */
function StudioAvatar() {
  return (
    <span
      className="feed-glass-control feed-avatar-ring w-11 h-11 rounded-full grid place-items-center"
      aria-hidden="true"
    >
      <span className="display-font text-[11px] font-black tracking-[0.08em] text-[#f4f3ef]">BPT</span>
    </span>
  );
}

/**
 * The right-hand action rail.
 *
 * Positioned by `.feed-rail`: anchored above the bottom CTA row and
 * bottom-aligned with the caption rather than vertically centred, so it reads
 * as part of the lower content band on any viewport height.
 *
 * Every control carries its own glass backing, because the footage underneath
 * can be white, skin-toned, black or high-contrast and the icons have to stay
 * legible over all of it without tinting the whole frame.
 *
 * Book Now opens the same booking flow as the primary bottom CTA. There is no
 * share or bookmark action by design.
 */
export default function VideoActionRail({
  contentId,
  attribution,
  reaction,
  commentCount,
  onBook,
  onReact,
  onOpenComments,
  onOpenArtist,
}: Props) {
  const isArtist = attribution.kind === 'artist';
  const name = isArtist ? attribution.artist.name : attribution.name;

  return (
    <div className="feed-rail">
      <button
        type="button"
        onClick={onBook}
        className="feed-focusable flex flex-col items-center gap-1"
        aria-label="Book an appointment"
      >
        <span className="feed-glass-control w-11 h-11 rounded-full flex items-center justify-center text-[#f4f3ef]">
          <CalendarIcon size={20} />
        </span>
        <span className="feed-control-label display-font text-[8px] font-bold tracking-[0.15em] text-[#f4f3ef] uppercase">
          Book Now
        </span>
      </button>

      <ReactionPicker state={reaction} onChange={onReact} contentId={contentId} />

      <button
        type="button"
        onClick={onOpenComments}
        className="feed-focusable flex flex-col items-center gap-1"
        aria-label={commentCount !== null && commentCount > 0 ? `Comments (${commentCount})` : 'Comments'}
      >
        <span className="feed-glass-control w-11 h-11 rounded-full flex items-center justify-center text-[#f4f3ef]">
          <CommentIcon size={20} />
        </span>
        {commentCount !== null && commentCount > 0 && (
          <span className="feed-control-label display-font text-[10px] tracking-wide text-[#f4f3ef] tabular-nums">
            {commentCount}
          </span>
        )}
      </button>

      {isArtist && onOpenArtist ? (
        <button
          type="button"
          onClick={onOpenArtist}
          className="feed-focusable flex flex-col items-center gap-1"
          aria-label={`View ${name}'s gallery`}
        >
          <span className="feed-glass-control feed-avatar-ring w-11 h-11 rounded-full overflow-hidden block p-0">
            <img src={attribution.artist.portrait} alt="" className="w-full h-full object-cover object-top rounded-full" loading="lazy" />
          </span>
          <span className="feed-control-label text-[#f4f3ef] text-[9px] text-center leading-tight w-14 truncate">
            {name.split(' ')[0]}
          </span>
        </button>
      ) : (
        // No confirmed artist for this clip, so it is presented as studio work
        // rather than credited to someone who may not have made it.
        <span className="flex flex-col items-center gap-1">
          <StudioAvatar />
          <span className="feed-control-label text-[#f4f3ef] text-[9px] text-center leading-tight w-14">BANG</span>
        </span>
      )}
    </div>
  );
}
