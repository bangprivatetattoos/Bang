/**
 * Development-only placeholder engagement counts.
 *
 * These exist so the rail can be judged visually with numbers present. They
 * are NOT real activity and must never reach a visitor.
 *
 * Two independent guards, both of which must pass:
 *   1. `import.meta.env.DEV` — false in every production build, so the whole
 *      branch is dead code that the bundler drops.
 *   2. `VITE_ENABLE_MOCK_ENGAGEMENT === 'true'` — opt-in even in development.
 *
 * Because the DEV check is a build-time constant, setting the env var on the
 * production build cannot switch this on.
 */
export const MOCK_ENGAGEMENT_ENABLED =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCK_ENGAGEMENT === 'true';

const MIN = 150;
const MAX = 3000;

/**
 * Stable per-clip placeholder, so a number does not change on every render
 * while a layout is being reviewed.
 */
export function mockReactionCount(contentId: string): number {
  let hash = 0;
  for (let i = 0; i < contentId.length; i += 1) {
    hash = (hash * 31 + contentId.charCodeAt(i)) >>> 0;
  }
  return MIN + (hash % (MAX - MIN + 1));
}

if (import.meta.env.DEV && MOCK_ENGAGEMENT_ENABLED) {
  console.warn(
    '[video-feed] Mock engagement counts are ON. These are placeholders, not real activity, and are disabled in production builds.',
  );
}
