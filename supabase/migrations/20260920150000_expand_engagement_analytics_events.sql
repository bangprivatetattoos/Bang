-- Expanded engagement analytics: video milestones, artist journey,
-- booking funnel and carousel batch tracking.
--
-- Additive only: every previously accepted event name is retained, so existing
-- dashboard metrics and historical rows are unaffected.

alter table public.analytics_events drop constraint analytics_events_event_name_check;

alter table public.analytics_events add constraint analytics_events_event_name_check check (event_name in (
  'page_view', 'artist_view', 'artist_gallery_open', 'book_artist_click',
  'portfolio_view', 'portfolio_image_open', 'booking_start', 'booking_success',
  'whatsapp_click', 'whatsapp_handoff', 'home_call_view', 'home_call_click',
  'faq_open', 'content_view', 'video_started', 'video_completed',
  'video_swiped', 'reaction', 'comment_open', 'comment_submit',
  'artist_open', 'gallery_open', 'booking_started', 'location_selected',
  'artist_selected', 'tattoo_type_selected', 'price_range_selected', 'whatsapp_continue',
  'carousel_view', 'carousel_interaction', 'video_paused', 'video_resumed',
  'video_auto_advanced', 'artist_gallery_booking_open', 'artist_gallery_enquiry_open', 'video_3s_view',
  'video_25_percent', 'video_50_percent', 'video_75_percent', 'video_swiped_forward',
  'video_swiped_back', 'video_replayed', 'video_reaction_added', 'video_reaction_removed',
  'comment_submitted', 'artist_avatar_clicked', 'artist_dropdown_open', 'artist_gallery_view',
  'artist_video_interaction', 'artist_booking_selected', 'artist_changed_during_booking', 'artist_whatsapp_continue',
  'consultation_acknowledgement_viewed', 'carousel_shown', 'carousel_image_impression', 'carousel_manual_swipe',
  'carousel_auto_advance', 'carousel_completed', 'carousel_swipe_up_continue', 'carousel_swipe_back',
  'carousel_image_clicked', 'carousel_artist_clicked'
));
