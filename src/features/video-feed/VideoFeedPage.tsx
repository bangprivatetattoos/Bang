import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ARTISTS } from '../../data/artists';
import { trackAnalytics } from '../../analytics/client';
import { useBookingFlow } from '../booking/BookingFlowProvider';
import { FEED_VIDEOS } from './data/videoManifest';
import { CAROUSEL_CARDS, preloadCarouselBatch } from './data/carouselAssets';
import { useVideoPrebuffer } from './hooks/useVideoPrebuffer';
import type { CarouselEvent } from './PortfolioInterlude';
import { fetchComments, fetchReactions, setReaction as persistReaction } from './data/feedApi';
import { useShuffleFeed } from './hooks/useShuffleFeed';
import { useFeedSound } from './hooks/useFeedSound';
import type { FeedSoundEvent, FeedSoundState } from './hooks/feedSoundState';
import { useReactionCountsRealtime } from './hooks/useReactionCountsRealtime';
import { useFeedNavigation, type NavigationMethod } from './hooks/useFeedNavigation';
import VideoFeedItem from './VideoFeedItem';
import VideoCaption from './VideoCaption';
import VideoActionRail from './VideoActionRail';
import FeedTopBar from './FeedTopBar';
import FeedBottomBar from './FeedBottomBar';
import ArtistDiscovery from './ArtistDiscovery';
import FeedSidebar from './FeedSidebar';
import PortfolioInterlude from './PortfolioInterlude';
const PortfolioViewer = lazy(() => import('./PortfolioViewer'));
const CommentsSheet = lazy(() => import('./CommentsSheet'));
import SwipeGuide from './SwipeGuide';
import { SoundOffIcon } from './ui/icons';
import type { FeedAttribution, ReactionKind, ReactionState } from './types';

interface Props {
  /** Hidden entrance to the protected analytics dashboard. */
  onOpenInsights?: () => void;
}

/** A completed clip this close to a manual move is a duplicate, not a cue. */
const AUTO_ADVANCE_GUARD_MS = 500;

const EMPTY_REACTION: ReactionState = { counts: null, mine: null };

/**
 * The public landing experience: an immersive vertical feed of the studio's
 * real tattoo work, with artist discovery, booking and the rest of the site
 * reachable from it.
 */
export default function VideoFeedPage({ onOpenInsights }: Props) {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const { openBooking, openEnquiry, isOpen: bookingFlowOpen } = useBookingFlow();

  const feed = useShuffleFeed(FEED_VIDEOS);
  const { current, currentVideo, previousVideo, nextVideo } = feed;

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  /**
   * Whether the visitor has swiped during THIS arrival.
   *
   * Deliberately not persisted. The guide is the one cue that teaches the
   * gesture, so every arrival at the feed — a fresh load, a reload, or coming
   * back from an artist page — starts without it set and shows the guide on
   * the opening clip again. It still retires the moment they swipe, so it
   * never interrupts someone who already knows.
   */
  const [hasSwiped, setHasSwiped] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  /**
   * Playback intent, kept separate from the element's own state.
   *
   * `manuallyPaused` is the visitor's decision and survives overlays opening
   * and closing; an overlay pauses playback without clearing it, so closing
   * the overlay resumes only what was actually playing before.
   */
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [showPauseIndicator, setShowPauseIndicator] = useState(false);

  /**
   * Sound is owned by the feed session, never by a clip.
   *
   * A clip is mounted and unmounted constantly by the previous/current/next
   * window, so it is in no position to remember whether the visitor
   * authorised audio. It reads the answer from here, and nothing about
   * changing clip, swiping back or remounting an element can alter it.
   */
  const sound = useFeedSound({
    // A refusal is recorded against the clip it happened on, so moving away
    // leaves it behind rather than carrying it across the feed.
    contentId: currentVideo?.id ?? null,
    onEvent: useCallback((event: FeedSoundEvent, next: FeedSoundState) => {
      if (event.type === 'activation-succeeded') {
        trackAnalytics('sound_enabled', { entityType: 'content', entityId: currentVideo?.id });
      } else if (event.type === 'user-muted') {
        trackAnalytics('sound_disabled', { entityType: 'content', entityId: currentVideo?.id });
      } else if (event.type === 'playback-blocked' && next.blockedContentId === event.contentId) {
        // The reducer returns the same object when that clip is already
        // blocked, so a repeated refusal cannot become a stream of duplicates.
        trackAnalytics('sound_playback_blocked', {
          entityType: 'content',
          entityId: event.contentId,
          metadata: { reason: 'autoplay_policy' },
        });
      }
    }, [currentVideo]),
  });

  const [reactions, setReactions] = useState<Record<string, ReactionState>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  const overlayOpen = commentsOpen || sidebarOpen || discoveryOpen || viewerIndex !== null || bookingFlowOpen;
  const onInterlude = current?.kind === 'interlude';
  const interludeIndex = current?.kind === 'interlude' ? current.interludeIndex : 0;
  const isPlaying = !overlayOpen && !manuallyPaused && !onInterlude;

  /** Timestamp of the last committed transition, to suppress a duplicate. */
  const lastNavigationAt = useRef(0);

  /** The clip's artist, or the studio identity when there is no mapping. */
  const attribution: FeedAttribution = useMemo(() => {
    const artist = currentVideo?.artistId ? ARTISTS.find(item => item.id === currentVideo.artistId) : undefined;
    return artist
      ? { kind: 'artist', artist }
      : { kind: 'studio', name: 'BANG PRIVATE TATTOOS', label: 'BANG' };
  }, [currentVideo]);

  // The feed owns the viewport, so the document behind it must not scroll.
  useEffect(() => {
    document.body.classList.add('feed-active');
    return () => document.body.classList.remove('feed-active');
  }, []);

  // A new clip always starts playing: a pause applies to the clip it was made
  // on, not to the rest of the session.
  useEffect(() => {
    setManuallyPaused(false);
    setShowPauseIndicator(false);
  }, [currentVideo?.id]);

  /**
   * The prompt impression, reported once per appearance rather than per
   * render, so a re-render cannot inflate the count.
   */
  const promptReported = useRef(false);
  useEffect(() => {
    if (!sound.promptVisible) { promptReported.current = false; return; }
    if (promptReported.current) return;
    promptReported.current = true;
    trackAnalytics('sound_activation_prompt_shown', {
      entityType: 'content',
      entityId: currentVideo?.id,
      metadata: { reason: sound.state.hasUserActivatedAudio ? 'playback_blocked' : 'first_visit' },
    });
  }, [sound.promptVisible, sound.state.hasUserActivatedAudio, currentVideo]);

  /**
   * Whether the clip on screen has actually started.
   *
   * Warming is held back until it has, so preparing what comes next can never
   * compete for bandwidth with the video the visitor is watching right now.
   */
  const [currentStarted, setCurrentStarted] = useState(false);
  useEffect(() => { setCurrentStarted(false); }, [currentVideo?.id]);

  // Clips after `next`, which is already mounted with preload="auto".
  const upcomingUrls = useMemo(
    () => feed.upcomingVideos.map(video => video.src).filter(Boolean),
    [feed.upcomingVideos],
  );

  const prebuffer = useVideoPrebuffer(upcomingUrls, {
    // One ahead while the current clip is still starting, more once it is
    // playing. Bounded further by the connection's own budget.
    depth: currentStarted ? 4 : 1,
    // An open overlay means the visitor is reading, not swiping; nothing is
    // gained by holding downloads open behind it.
    enabled: !overlayOpen,
  });

  /**
   * Warms the next carousel batch a couple of clips before it is reached, so
   * the interlude opens on images rather than empty frames.
   */
  useEffect(() => {
    const { entries, position } = feed;
    for (let i = position + 1; i < Math.min(entries.length, position + 3); i += 1) {
      const entry = entries[i];
      if (entry.kind === 'interlude') { preloadCarouselBatch(entry.interludeIndex); return; }
    }
  }, [feed.entries, feed.position]);

  if (import.meta.env.DEV) {
    // Diagnostics only, and only when something is actually warming.
    (window as Window & { __feedPrebuffer?: unknown }).__feedPrebuffer = () => ({
      budget: prebuffer.budget,
      warming: prebuffer.describe(),
    });
  }

  const markSwiped = useCallback(() => setHasSwiped(true), []);

  const goForward = useCallback((method: NavigationMethod | 'auto_complete') => {
    lastNavigationAt.current = Date.now();
    markSwiped();
    if (method === 'auto_complete') {
      trackAnalytics('video_auto_advanced', {
        entityType: 'content',
        entityId: currentVideo?.id,
        metadata: { navigation_method: 'auto_complete' },
      });
    } else {
      // Automatic transitions are deliberately not recorded as swipes.
      trackAnalytics('video_swiped', {
        entityType: 'content',
        entityId: currentVideo?.id,
        metadata: { direction: 'forward', navigation_method: method },
      });
      trackAnalytics('video_swiped_forward', { entityType: 'content', entityId: currentVideo?.id, metadata: { navigation_method: method } });
    }
    feed.goForward();
  }, [feed, currentVideo, markSwiped]);

  const goBackward = useCallback((method: NavigationMethod) => {
    if (!feed.canGoBackward) return;
    lastNavigationAt.current = Date.now();
    trackAnalytics('video_swiped', {
      entityType: 'content',
      entityId: currentVideo?.id,
      metadata: { direction: 'backward', navigation_method: method },
    });
    trackAnalytics('video_swiped_back', { entityType: 'content', entityId: currentVideo?.id, metadata: { navigation_method: method } });
    feed.goBackward();
  }, [feed, currentVideo]);

  useFeedNavigation(rootRef, { enabled: !overlayOpen, onForward: goForward, onBackward: goBackward });

  /**
   * Another visitor reacting to this clip updates the total here without a
   * refresh. Only the aggregate row for the clip on screen is subscribed to,
   * and the subscription is dropped as soon as the clip changes.
   */
  const handleLiveCounts = useCallback((counts: { like: number; love: number }) => {
    const id = currentVideo?.id;
    if (!id) return;
    setReactions(current => ({ ...current, [id]: { counts, mine: current[id]?.mine ?? null } }));
  }, [currentVideo?.id]);

  useReactionCountsRealtime({ contentId: currentVideo?.id ?? null, onCountsChanged: handleLiveCounts });

  /** Tap on the footage toggles playback, the way a reels feed does. */
  const togglePlayback = useCallback(() => {
    setManuallyPaused(paused => {
      const next = !paused;
      setShowPauseIndicator(next);
      trackAnalytics(next ? 'video_paused' : 'video_resumed', {
        entityType: 'content',
        entityId: currentVideo?.id,
        metadata: currentVideo ? { video_id: currentVideo.id } : undefined,
      });
      return next;
    });
  }, [currentVideo]);

  // The indicator is a confirmation, not furniture: it fades out once play resumes.
  useEffect(() => {
    if (manuallyPaused || !showPauseIndicator) return;
    const timer = window.setTimeout(() => setShowPauseIndicator(false), 260);
    return () => window.clearTimeout(timer);
  }, [manuallyPaused, showPauseIndicator]);

  /**
   * A clip reaching its end advances the feed through the same history engine
   * a swipe uses, so the shuffle bag, the session history and the interlude
   * counter all behave identically however the visitor got there.
   */
  const handleEnded = useCallback((endedVideoId: string) => {
    if (endedVideoId !== currentVideo?.id) return;
    trackAnalytics('video_completed', { entityType: 'content', entityId: endedVideoId, metadata: { video_id: endedVideoId } });
    if (overlayOpen || manuallyPaused) return;
    // A manual move already in flight owns this transition.
    if (Date.now() - lastNavigationAt.current < AUTO_ADVANCE_GUARD_MS) return;
    goForward('auto_complete');
  }, [currentVideo, overlayOpen, manuallyPaused, goForward]);

  // Reactions and comment counts for whatever is on screen. Both endpoints are
  // allowed to be unavailable: the rail simply renders without a number rather
  // than inventing one.
  useEffect(() => {
    if (!currentVideo) return;
    const { id } = currentVideo;
    let cancelled = false;

    trackAnalytics('content_view', { entityType: 'content', entityId: id, metadata: { video_id: id } });

    if (reactions[id] === undefined) {
      void fetchReactions(id).then(result => {
        if (cancelled || !result) return;
        setReactions(current => ({ ...current, [id]: { counts: result.counts, mine: result.mine } }));
      });
    }
    if (commentCounts[id] === undefined) {
      void fetchComments(id).then(result => {
        if (cancelled || result === null) return;
        setCommentCounts(current => ({ ...current, [id]: result.length }));
      });
    }

    return () => { cancelled = true; };
    // Keyed on the clip: the caches are read, not tracked, so they must not retrigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVideo?.id]);

  /** Carousel analytics, reported by the interlude through one channel. */
  const handleCarouselEvent = useCallback((event: CarouselEvent, detail?: Record<string, string>) => {
    trackAnalytics(event, { entityType: 'carousel', entityId: detail?.content_id, metadata: detail });
  }, []);

  useEffect(() => {
    if (onInterlude) trackAnalytics('carousel_view', { entityType: 'carousel' });
  }, [onInterlude]);

  const handleReact = useCallback((reaction: ReactionKind | null) => {
    const video = currentVideo;
    if (!video) return;
    const previous = reactions[video.id] ?? EMPTY_REACTION;

    // Optimistic, so the rail responds to the tap immediately; the server's
    // totals replace these as soon as they arrive.
    const optimisticCounts = previous.counts
      ? {
          like: previous.counts.like + (reaction === 'like' ? 1 : 0) - (previous.mine === 'like' ? 1 : 0),
          love: previous.counts.love + (reaction === 'love' ? 1 : 0) - (previous.mine === 'love' ? 1 : 0),
        }
      : previous.counts;
    setReactions(current => ({ ...current, [video.id]: { counts: optimisticCounts, mine: reaction } }));

    trackAnalytics(reaction ? 'video_reaction_added' : 'video_reaction_removed', {
      entityType: 'content', entityId: video.id,
      metadata: { video_id: video.id, ...(reaction ? { reaction } : {}) },
    });
    if (reaction) {
      trackAnalytics('reaction', { entityType: 'content', entityId: video.id, metadata: { reaction, video_id: video.id } });
    }

    void persistReaction(video.id, reaction).then(result => {
      if (!result) {
        setReactions(current => ({ ...current, [video.id]: previous }));
        return;
      }
      setReactions(current => ({ ...current, [video.id]: { counts: result.counts, mine: result.mine } }));
    });
  }, [currentVideo, reactions]);

  const startBooking = useCallback((source: string) => {
    setDiscoveryOpen(false);
    setSidebarOpen(false);
    setViewerIndex(null);
    openBooking({ source, preferredArtistId: currentVideo?.artistId ?? null, contentId: currentVideo?.id ?? null });
  }, [openBooking, currentVideo]);

  const openArtist = useCallback((artistId: string) => {
    const artist = ARTISTS.find(item => item.id === artistId);
    trackAnalytics('artist_open', {
      entityType: 'artist',
      entityId: artistId,
      metadata: artist ? { artist_name: artist.name } : undefined,
    });
    trackAnalytics('gallery_open', { entityType: 'artist', entityId: artistId });
    trackAnalytics('artist_gallery_view', { entityType: 'artist', entityId: artistId, metadata: artist ? { artist_name: artist.name } : undefined });
    setDiscoveryOpen(false);
    navigate(`/artists/${encodeURIComponent(artistId)}`);
  }, [navigate]);

  const handleCommentCount = useCallback((contentId: string, count: number) => {
    setCommentCounts(current => ({ ...current, [contentId]: count }));
  }, []);

  // No clips on disk is a deployment problem, not something to render blank.
  if (FEED_VIDEOS.length === 0 || !currentVideo) {
    return (
      <main className="feed-root min-h-[100dvh] grid place-items-center px-6 text-center">
        <div>
          <p className="display-font text-[28px] font-black uppercase tracking-wide text-[#f4f3ef]">BANG PRIVATE TATTOOS</p>
          <p className="text-[#858585] text-[13px] mt-3">
            The feed is unavailable right now.{' '}
            <button type="button" onClick={() => navigate('/studio')} className="underline underline-offset-4">
              Browse the studio instead
            </button>
            .
          </p>
        </div>
      </main>
    );
  }

  const reaction = reactions[currentVideo.id] ?? EMPTY_REACTION;
  const commentCount = commentCounts[currentVideo.id] ?? null;

  return (
    <div
      ref={rootRef}
      className="feed-root relative w-full overflow-hidden"
      style={{ height: '100dvh', minHeight: '100dvh', touchAction: overlayOpen ? 'auto' : 'none' }}
    >
      {/* Only the previous, current and next clips are ever mounted. */}
      {!onInterlude && (
        <>
          {previousVideo && previousVideo.id !== currentVideo.id && (
            <VideoFeedItem key={`previous-${previousVideo.id}`} video={previousVideo} role="previous" shouldPlay={false} soundEnabled={false} audioAttempt={sound.attempt} registerElement={sound.registerElement} />
          )}
          <VideoFeedItem
            key={`current-${currentVideo.id}`}
            video={currentVideo}
            role="current"
            shouldPlay={isPlaying}
            soundEnabled={sound.soundEnabled}
            audioAttempt={sound.attempt}
            registerElement={sound.registerElement}
            onAudioBlocked={sound.reportBlocked}
            onAudiblePlayback={sound.reportAudiblePlayback}
            onStarted={video => {
              setCurrentStarted(true);
              trackAnalytics('video_started', { entityType: 'content', entityId: video.id, metadata: { video_id: video.id } });
            }}
            onEnded={video => handleEnded(video.id)}
            onMilestone={(video, milestone) => trackAnalytics(milestone, {
              entityType: 'content', entityId: video.id, metadata: { video_id: video.id, milestone },
            })}
          />
          {nextVideo && nextVideo.id !== currentVideo.id && (
            <VideoFeedItem key={`next-${nextVideo.id}`} video={nextVideo} role="next" shouldPlay={false} soundEnabled={false} audioAttempt={sound.attempt} registerElement={sound.registerElement} />
          )}

          {/* Local fades so the controls stay legible over any footage,
              instead of one overlay dulling the whole frame. */}
          <div className="feed-bottom-scrim" aria-hidden="true" />
          <div className="feed-rail-scrim" aria-hidden="true" />

          {/* Sits above the footage but below every control, so tapping a
              button never toggles playback. */}
          <button
            type="button"
            className="feed-tap-layer"
            // While sound is still being offered, the first tap buys it back
            // rather than pausing: that is what the visitor is reaching for,
            // and pausing on the same tap would read as a bug. play() is
            // called inside this handler so the browser can attribute the
            // audible playback to the tap.
            onClick={sound.promptVisible ? sound.requestSound : togglePlayback}
            aria-label={sound.promptVisible ? 'Unmute videos' : manuallyPaused ? 'Play video' : 'Pause video'}
            aria-pressed={sound.promptVisible ? undefined : manuallyPaused}
          />

          {sound.promptVisible && (
            <div
              className="absolute inset-x-0 z-[15] flex justify-center pointer-events-none"
              style={{ top: 'calc(var(--feed-safe-top) + 58px)' }}
            >
              <span className="feed-glass-control flex items-center gap-2 rounded-full px-3.5 py-2 text-[11px] uppercase tracking-[0.12em] text-[#f4f3ef]">
                <SoundOffIcon size={15} />
                Tap for sound
              </span>
            </div>
          )}

          {showPauseIndicator && (
            <div className="absolute inset-0 z-[15] grid place-items-center pointer-events-none" aria-hidden="true">
              <span className="feed-pause-indicator feed-glass-control w-[72px] h-[72px] rounded-full grid place-items-center">
                {manuallyPaused ? (
                  <svg width="26" height="30" viewBox="0 0 26 30" fill="#f4f3ef"><path d="M3 2.2v25.6a1 1 0 0 0 1.53.85l21-12.8a1 1 0 0 0 0-1.7l-21-12.8A1 1 0 0 0 3 2.2z" /></svg>
                ) : (
                  <svg width="24" height="28" viewBox="0 0 24 28" fill="#f4f3ef"><rect x="3" y="2" width="6.5" height="24" rx="1.6" /><rect x="14.5" y="2" width="6.5" height="24" rx="1.6" /></svg>
                )}
              </span>
            </div>
          )}
        </>
      )}

      {onInterlude && (
        <PortfolioInterlude
          // Keyed on the interlude so each one starts its own batch cleanly.
          key={`interlude-${interludeIndex}`}
          interludeIndex={interludeIndex}
          onForward={() => { trackAnalytics('carousel_swipe_up_continue', { entityType: 'carousel' }); goForward('swipe'); }}
          onBackward={() => { trackAnalytics('carousel_swipe_back', { entityType: 'carousel' }); goBackward('swipe'); }}
          onEvent={handleCarouselEvent}
          onOpenCard={index => {
            setViewerIndex(index);
            const card = CAROUSEL_CARDS[index];
            if (card) trackAnalytics('portfolio_image_open', { entityType: 'portfolio', entityId: card.id });
          }}
        />
      )}

      {!onInterlude && (
        <>
          <FeedTopBar
            soundOn={sound.soundOn}
            onToggleSound={sound.toggleSound}
            onOpenSidebar={() => setSidebarOpen(true)}
            onToggleDiscovery={() => setDiscoveryOpen(open => {
              if (!open) trackAnalytics('artist_dropdown_open', { entityType: 'artist' });
              return !open;
            })}
            discoveryOpen={discoveryOpen}
          />

          {discoveryOpen && <ArtistDiscovery onClose={() => setDiscoveryOpen(false)} onOpenArtist={openArtist} />}

          <VideoActionRail
            contentId={currentVideo.id}
            attribution={attribution}
            reaction={reaction}
            commentCount={commentCount}
            onBook={() => startBooking('action_rail')}
            onReact={handleReact}
            onOpenComments={() => {
              setCommentsOpen(true);
              trackAnalytics('comment_open', { entityType: 'content', entityId: currentVideo.id });
            }}
            onOpenArtist={attribution.kind === 'artist' ? () => {
              trackAnalytics('artist_avatar_clicked', { entityType: 'artist', entityId: attribution.artist.id, metadata: { artist_name: attribution.artist.name } });
              openArtist(attribution.artist.id);
            } : undefined}
          />

          <VideoCaption video={currentVideo} />

          <FeedBottomBar
            onEnquiry={() => openEnquiry({ contentId: currentVideo.id, source: 'video_feed' })}
            onBook={() => startBooking('bottom_bar')}
          />

          <SwipeGuide onFirstItem={feed.position === 0} hasSwiped={hasSwiped} />
        </>
      )}

      {sidebarOpen && (
        <FeedSidebar
          onClose={() => setSidebarOpen(false)}
          onBook={() => startBooking('sidebar')}
          onNavigate={to => { setSidebarOpen(false); navigate(to); }}
          onOpenInsights={onOpenInsights}
        />
      )}

      {/* Both overlays arrive as their own chunk; an empty frame while one
          loads reads as the sheet opening, so no spinner is warranted. */}
      <Suspense fallback={null}>
      {commentsOpen && (
        <CommentsSheet
          contentId={currentVideo.id}
          variant="comments"
          onClose={() => setCommentsOpen(false)}
          onSubmitted={() => {
            trackAnalytics('comment_submit', { entityType: 'content', entityId: currentVideo.id });
            trackAnalytics('comment_submitted', { entityType: 'content', entityId: currentVideo.id, metadata: { content_id: currentVideo.id } });
          }}
          onCountChange={handleCommentCount}
        />
      )}

      {viewerIndex !== null && (
        <PortfolioViewer
          cards={CAROUSEL_CARDS}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onIndexChange={index => {
            setViewerIndex(index);
            const card = CAROUSEL_CARDS[index];
            if (card) trackAnalytics('portfolio_image_open', { entityType: 'portfolio', entityId: card.id });
          }}
          onBook={() => startBooking('portfolio_viewer')}
        />
      )}
      </Suspense>
    </div>
  );
}
