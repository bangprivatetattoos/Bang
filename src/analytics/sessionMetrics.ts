/**
 * Feed behaviour, accumulated in memory instead of written a row at a time.
 *
 * Swipes, pauses, milestones and carousel movement are high-frequency: a
 * single browsing session produces hundreds of them, and a permanent database
 * row for each answers no question anybody asks. What the business wants to
 * know is how many clips were genuinely watched, for how long, how deep the
 * visitor went and which pieces held attention — all of which are sums.
 *
 * So they are summed here and flushed periodically. Business and funnel
 * events (booking, artist selection, WhatsApp handoff, reactions, comments)
 * are NOT aggregated: those stay individually recorded, because each one is a
 * distinct thing that happened to a real enquiry.
 *
 * Pure and synchronous on purpose — no network, no timers, no browser — so
 * the counting rules can be tested directly.
 */

/** A clip's performance within one session. */
export interface ContentMetrics {
  /** Times this clip became the active item. */
  impressions: number;
  /** Times it was watched past the qualifying threshold. */
  qualifiedViews: number;
  completions: number;
  replays: number;
  watchSeconds: number;
}

export interface SessionMetrics {
  forwardSwipes: number;
  backwardSwipes: number;
  /** Every entry onto a clip, including returning to one already seen. */
  videosEntered: number;
  uniqueVideosViewed: number;
  qualifiedVideoViews: number;
  videosCompleted: number;
  videosReplayed: number;
  totalWatchSeconds: number;
  /** The furthest position reached in the feed this session. */
  maximumFeedDepth: number;
  carouselsViewed: number;
  carouselImagesViewed: number;
  carouselManualSwipes: number;
  artistProfilesViewed: number;
  bookingStarted: number;
  whatsappContinued: number;
}

export const emptySessionMetrics = (): SessionMetrics => ({
  forwardSwipes: 0,
  backwardSwipes: 0,
  videosEntered: 0,
  uniqueVideosViewed: 0,
  qualifiedVideoViews: 0,
  videosCompleted: 0,
  videosReplayed: 0,
  totalWatchSeconds: 0,
  maximumFeedDepth: 0,
  carouselsViewed: 0,
  carouselImagesViewed: 0,
  carouselManualSwipes: 0,
  artistProfilesViewed: 0,
  bookingStarted: 0,
  whatsappContinued: 0,
});

const emptyContent = (): ContentMetrics => ({
  impressions: 0,
  qualifiedViews: 0,
  completions: 0,
  replays: 0,
  watchSeconds: 0,
});

/** Guards against a stuck timer contributing an implausible span. */
const MAX_SINGLE_WATCH_SPAN_SECONDS = 600;

export class SessionAccumulator {
  private session = emptySessionMetrics();
  private content = new Map<string, ContentMetrics>();
  /** Clips already counted once, so uniqueness is not recomputed from a list. */
  private seen = new Set<string>();
  /** Clips already counted as a qualified view, which happens at most once each. */
  private qualified = new Set<string>();

  /** Open watch span: which clip, and when the clock started. */
  private watching: { contentId: string; since: number } | null = null;

  /** Whether anything has changed since the last successful flush. */
  private dirty = false;

  private forContent(contentId: string): ContentMetrics {
    let entry = this.content.get(contentId);
    if (!entry) {
      entry = emptyContent();
      this.content.set(contentId, entry);
    }
    return entry;
  }

  private touch() { this.dirty = true; }

  // ── Feed movement ──────────────────────────────────────────────────────

  swipedForward() { this.session.forwardSwipes += 1; this.touch(); }
  swipedBackward() { this.session.backwardSwipes += 1; this.touch(); }

  /** The visitor's furthest point in the feed, not their current one. */
  reachedDepth(position: number) {
    if (position > this.session.maximumFeedDepth) {
      this.session.maximumFeedDepth = position;
      this.touch();
    }
  }

  /** A clip became the active item. */
  enteredVideo(contentId: string) {
    if (!contentId) return;
    this.session.videosEntered += 1;
    this.forContent(contentId).impressions += 1;
    if (!this.seen.has(contentId)) {
      this.seen.add(contentId);
      this.session.uniqueVideosViewed += 1;
    }
    this.touch();
  }

  /**
   * Watched past the qualifying threshold.
   *
   * Counted once per clip per session: returning to something already
   * qualified is not a second qualified view, and counting it as one would
   * make a visitor who swings back and forth look like an engaged audience.
   */
  qualifiedView(contentId: string) {
    if (!contentId || this.qualified.has(contentId)) return;
    this.qualified.add(contentId);
    this.session.qualifiedVideoViews += 1;
    this.forContent(contentId).qualifiedViews += 1;
    this.touch();
  }

  completedVideo(contentId: string) {
    if (!contentId) return;
    this.session.videosCompleted += 1;
    this.forContent(contentId).completions += 1;
    this.touch();
  }

  replayedVideo(contentId: string) {
    if (!contentId) return;
    this.session.videosReplayed += 1;
    this.forContent(contentId).replays += 1;
    this.touch();
  }

  // ── Watch time ─────────────────────────────────────────────────────────

  /**
   * Starts counting watch time for a clip.
   *
   * Calling this twice without stopping does not restart the clock or open a
   * second span, so a re-render cannot inflate the total.
   */
  startWatching(contentId: string, now: number) {
    if (!contentId) return;
    if (this.watching?.contentId === contentId) return;
    this.stopWatching(now);
    this.watching = { contentId, since: now };
  }

  /**
   * Stops counting and banks the elapsed span.
   *
   * Called when playback pauses, an overlay opens, the clip changes, the
   * carousel takes over or the tab is hidden — so the total is time the
   * visitor was actually watching, not time the page was open.
   */
  stopWatching(now: number) {
    const open = this.watching;
    this.watching = null;
    if (!open) return;
    const elapsed = (now - open.since) / 1000;
    // Negative means the clock moved backwards; over the ceiling means the
    // span was left open by a tab that slept. Neither is watch time.
    if (!Number.isFinite(elapsed) || elapsed <= 0 || elapsed > MAX_SINGLE_WATCH_SPAN_SECONDS) return;
    this.session.totalWatchSeconds += elapsed;
    this.forContent(open.contentId).watchSeconds += elapsed;
    this.touch();
  }

  // ── Carousel and artists ───────────────────────────────────────────────

  carouselShown() { this.session.carouselsViewed += 1; this.touch(); }
  carouselImageSeen() { this.session.carouselImagesViewed += 1; this.touch(); }
  carouselSwiped() { this.session.carouselManualSwipes += 1; this.touch(); }
  artistProfileViewed() { this.session.artistProfilesViewed += 1; this.touch(); }

  /**
   * Conversion boundaries, counted here as well as recorded individually.
   *
   * The individual event is what the funnel is built from; the counter is
   * what makes a session row answer "did this visit convert" without a join.
   */
  bookingStarted() { this.session.bookingStarted += 1; this.touch(); }
  whatsappContinued() { this.session.whatsappContinued += 1; this.touch(); }

  // ── Reading ────────────────────────────────────────────────────────────

  hasPendingChanges(): boolean { return this.dirty; }

  /**
   * The current totals.
   *
   * Absolute, never deltas. The server takes the larger of what it holds and
   * what arrives, so a retried or out-of-order flush can neither double-count
   * nor move a counter backwards — which a delta would do on both counts.
   */
  snapshot(now: number): { session: SessionMetrics; content: Record<string, ContentMetrics> } {
    // Bank any span still open, so a flush mid-playback reports the watch
    // time so far rather than losing it.
    const open = this.watching;
    if (open) {
      this.stopWatching(now);
      this.watching = { contentId: open.contentId, since: now };
    }
    return {
      session: { ...this.session, totalWatchSeconds: Math.round(this.session.totalWatchSeconds) },
      content: Object.fromEntries(
        [...this.content.entries()].map(([id, metrics]) => [
          id,
          { ...metrics, watchSeconds: Math.round(metrics.watchSeconds) },
        ]),
      ),
    };
  }

  /**
   * Marks a flush as delivered.
   *
   * Counters are deliberately NOT reset: they are absolute totals for the
   * session, and the server resolves them by taking the maximum. Keeping them
   * means a failed flush loses nothing — the next one carries everything.
   */
  markFlushed() { this.dirty = false; }
}
