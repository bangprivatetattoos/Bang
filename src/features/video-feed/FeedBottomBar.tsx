import { CalendarIcon, CommentIcon } from './ui/icons';

interface Props {
  onEnquiry: () => void;
  onBook: () => void;
}

/**
 * The fixed bottom CTAs. Padding resolves against the safe-area inset so the
 * buttons sit clear of the iPhone home indicator.
 */
export default function FeedBottomBar({ onEnquiry, onBook }: Props) {
  return (
    <div
      className="absolute left-0 right-0 bottom-0 z-20 flex gap-2 px-3 pt-2 md:px-6 md:gap-3"
      style={{ paddingBottom: 'var(--feed-safe-bottom)' }}
    >
      <button
        type="button"
        onClick={onEnquiry}
        className="feed-focusable feed-glass-control flex-1 md:flex-none md:min-w-[200px] flex items-center justify-center gap-1.5 py-3.5 min-h-11 rounded-xl text-[#f4f3ef] text-[11px] md:text-[12px] font-medium uppercase tracking-wider"
      >
        <CommentIcon size={15} /> Make Enquiry
      </button>
      <button
        type="button"
        onClick={onBook}
        className="feed-focusable flex-[1.5] md:flex-none md:min-w-[280px] flex items-center justify-center gap-1.5 py-3.5 min-h-11 rounded-xl bg-[#f4f3ef] text-[#101010] text-[11px] md:text-[12px] font-bold uppercase tracking-wider"
      >
        <CalendarIcon size={15} /> Book Appointment
      </button>
    </div>
  );
}
