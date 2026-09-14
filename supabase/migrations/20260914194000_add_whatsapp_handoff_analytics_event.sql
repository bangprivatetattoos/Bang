alter table public.analytics_events drop constraint analytics_events_event_name_check;

alter table public.analytics_events add constraint analytics_events_event_name_check check (event_name in (
  'page_view', 'artist_view', 'artist_gallery_open', 'book_artist_click',
  'portfolio_view', 'portfolio_image_open', 'booking_start', 'booking_success',
  'whatsapp_click', 'whatsapp_handoff', 'home_call_view', 'home_call_click', 'faq_open'
));
