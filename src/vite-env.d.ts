/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_META_PIXEL_ID?: string;
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMetaEnv {
  /**
   * Development-only placeholder engagement counts for visual review.
   * Ignored entirely in production builds; see
   * src/features/video-feed/data/mockEngagement.ts.
   */
  readonly VITE_ENABLE_MOCK_ENGAGEMENT?: string;
}
