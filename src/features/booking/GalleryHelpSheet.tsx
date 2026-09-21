import Sheet from '../video-feed/ui/Sheet';
import { ArrowRightIcon, CalendarIcon, MailIcon } from '../video-feed/ui/icons';

interface Props {
  /** The gallery the visitor is currently in, if any. */
  artistName?: string | null;
  onClose: () => void;
  onBook: () => void;
  onEnquire: () => void;
}

/**
 * The choice sheet behind the floating contact button on an artist gallery.
 *
 * The button used to drop straight into a generic WhatsApp chat, which threw
 * away the context of whose gallery the visitor was looking at. It now asks
 * what they want first, so booking arrives at the real flow with the artist
 * already chosen, and a general question goes to the enquiry composer rather
 * than to WhatsApp.
 */
export default function GalleryHelpSheet({ artistName, onClose, onBook, onEnquire }: Props) {
  return (
    <Sheet
      onClose={onClose}
      title="What would you like to do?"
      subtitle={artistName ? `You're viewing ${artistName}'s gallery` : undefined}
    >
      <div className="px-5 pt-4 pb-5 space-y-3" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
        <button
          type="button"
          onClick={onBook}
          className="feed-focusable w-full flex items-center gap-3 px-4 py-4 min-h-11 rounded-xl bg-[#f4f3ef] text-[#101010] text-left"
        >
          <span className="flex-shrink-0"><CalendarIcon size={20} /></span>
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-bold uppercase tracking-wider">Book an appointment</span>
            <span className="block text-[11px] text-[#404040] mt-0.5">
              {artistName ? `${artistName} will be preselected for you` : 'Start a consultation request'}
            </span>
          </span>
          <span className="flex-shrink-0"><ArrowRightIcon /></span>
        </button>

        <button
          type="button"
          onClick={onEnquire}
          className="feed-focusable w-full flex items-center gap-3 px-4 py-4 min-h-11 rounded-xl text-[#f4f3ef] text-left"
          style={{ border: '1px solid rgba(255,255,255,0.18)' }}
        >
          <span className="flex-shrink-0 text-[#b5b5b2]"><MailIcon /></span>
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-medium uppercase tracking-wider">Make an enquiry</span>
            <span className="block text-[11px] text-[#858585] mt-0.5">Ask a question — your details stay private</span>
          </span>
          <span className="flex-shrink-0 text-[#626262]"><ArrowRightIcon /></span>
        </button>
      </div>
    </Sheet>
  );
}
