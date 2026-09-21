import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { trackAnalytics } from '../../analytics/client';
import BookingFlowSheet, { type BookingFlowOptions } from './BookingFlowSheet';
import CommentsSheet from '../video-feed/CommentsSheet';

interface EnquiryOptions {
  /** Content the enquiry relates to — a clip id, or `artist-<id>`. */
  contentId: string;
  /** Set when the enquiry began inside an artist's gallery. */
  artistId?: string | null;
  source: string;
}

interface BookingFlowContextValue {
  /** Opens the one public booking journey. */
  openBooking: (options: BookingFlowOptions) => void;
  /** Opens the shared private-contact composer. */
  openEnquiry: (options: EnquiryOptions) => void;
  close: () => void;
  /** True while either sheet is open, so a host can pause media behind it. */
  isOpen: boolean;
}

const BookingFlowContext = createContext<BookingFlowContextValue | null>(null);

/**
 * Application-wide booking and enquiry sheets.
 *
 * Every public Book Appointment / Book Now control in the application — the
 * video feed, the artist galleries, the long-form site, the navigation bar and
 * the gallery WhatsApp sheet — opens this one flow. There is deliberately no
 * second public booking experience to keep in step.
 *
 * The sheets render here rather than inside the feed so they are available on
 * every route. The wrapper carries `feed-root` so they inherit the feed's
 * design tokens and its 16px input sizing wherever they appear.
 */
export function BookingFlowProvider({ children }: { children: ReactNode }) {
  const [booking, setBooking] = useState<BookingFlowOptions | null>(null);
  const [enquiry, setEnquiry] = useState<EnquiryOptions | null>(null);

  const openBooking = useCallback((options: BookingFlowOptions) => {
    setEnquiry(null);
    setBooking(options);
    trackAnalytics('booking_started', {
      entityType: 'booking',
      entityId: options.preselectedArtistId ?? options.contentId ?? undefined,
      metadata: { surface: options.source },
    });
    // Keeps the established dashboard funnel step reporting for this journey.
    trackAnalytics('booking_start', { entityType: 'service', entityId: 'studio' });
  }, []);

  const openEnquiry = useCallback((options: EnquiryOptions) => {
    setBooking(null);
    setEnquiry(options);
    trackAnalytics('comment_open', { entityType: 'enquiry', entityId: options.contentId, metadata: { surface: options.source } });
  }, []);

  const close = useCallback(() => {
    setBooking(null);
    setEnquiry(null);
  }, []);

  const value = useMemo<BookingFlowContextValue>(
    () => ({ openBooking, openEnquiry, close, isOpen: booking !== null || enquiry !== null }),
    [openBooking, openEnquiry, close, booking, enquiry],
  );

  return (
    <BookingFlowContext.Provider value={value}>
      {children}
      {(booking || enquiry) && (
        <div className="feed-root fixed inset-0 z-[300]">
          {booking && <BookingFlowSheet {...booking} onClose={close} />}
          {enquiry && (
            <CommentsSheet
              contentId={enquiry.contentId}
              artistId={enquiry.artistId ?? null}
              variant="enquiry"
              onClose={close}
              onSubmitted={() => trackAnalytics('comment_submit', { entityType: 'enquiry', entityId: enquiry.contentId })}
            />
          )}
        </div>
      )}
    </BookingFlowContext.Provider>
  );
}

export function useBookingFlow(): BookingFlowContextValue {
  const context = useContext(BookingFlowContext);
  if (!context) throw new Error('useBookingFlow must be used inside BookingFlowProvider');
  return context;
}
