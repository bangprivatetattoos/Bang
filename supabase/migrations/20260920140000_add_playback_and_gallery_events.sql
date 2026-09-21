-- Playback control and artist-gallery contact events.
--
-- Additive only: every previously accepted event name is retained, so existing
-- dashboard metrics and historical rows are unaffected.

alter table public.analytics_events drop constraint analytics_events_event_name_check;

alter table public.analytics_events add constraint analytics_events_event_name_check check (event_name in (
  'page_view', 'artist_view', 'artist_gallery_open', 'book_artist_click',
  'portfolio_view', 'portfolio_image_open', 'booking_start', 'booking_success',
  'whatsapp_click', 'whatsapp_handoff', 'home_call_view', 'home_call_click', 'faq_open',
  -- Video feed
  'content_view', 'video_started', 'video_completed', 'video_swiped',
  'reaction', 'comment_open', 'comment_submit', 'artist_open', 'gallery_open',
  'booking_started', 'location_selected', 'artist_selected',
  'tattoo_type_selected', 'price_range_selected', 'whatsapp_continue',
  'carousel_view', 'carousel_interaction',
  -- Playback control and artist-gallery contact routing
  'video_paused', 'video_resumed', 'video_auto_advanced',
  'artist_gallery_booking_open', 'artist_gallery_enquiry_open'
));
