import type { FeedVideo } from './types';

interface Props {
  video: FeedVideo;
}

/**
 * Caption block, bottom-left and clear of the action rail and the CTAs.
 */
export default function VideoCaption({ video }: Props) {
  return (
    // Shares a baseline with the action rail, so the two read as one band
    // sitting above the bottom CTAs on every viewport height.
    <div
      className="absolute left-4 right-20 md:left-6 md:right-28 lg:max-w-[520px] z-20"
      style={{ bottom: 'calc(var(--feed-bottom-inset) + 8px)' }}
    >
      <p className="feed-control-label display-font text-[10px] md:text-[11px] font-bold tracking-[0.28em] text-[#b5b5b2] uppercase mb-1">
        {video.label}
      </p>
      <p
        className="feed-control-label text-[#e8e7e3] text-[13px] md:text-[15px] leading-snug whitespace-pre-line mb-1.5"
      >
        {video.caption}
      </p>
      <p className="feed-control-label text-[#b5b5b2] text-[11px] md:text-[12px] tracking-wide">{video.cta}</p>
    </div>
  );
}
