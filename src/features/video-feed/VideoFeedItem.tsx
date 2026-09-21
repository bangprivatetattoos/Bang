import { useCallback, useEffect, useRef, useState } from 'react';
import type { FeedVideo } from './types';
import { isAutoplayRejection } from './hooks/feedSoundState';

export type VideoRole = 'current' | 'next' | 'previous';

interface Props {
  video: FeedVideo;
  role: VideoRole;
  /**
   * Whether this clip should be playing right now. False while an overlay is
   * open or the visitor has paused by hand. Toggling it resumes from the
   * current position rather than restarting.
   */
  shouldPlay: boolean;
  /**
   * The feed's sound setting, not this clip's.
   *
   * A clip never decides whether the visitor authorised audio — it is mounted
   * and unmounted far too often to hold that answer. It reads the feed's.
   */
  soundEnabled: boolean;
  /**
   * Bumped when the visitor asks for sound again. Releases the local muted
   * fallback below so a refused clip retries once the visitor says to.
   */
  audioAttempt: number;
  /** Hands the element up so a user gesture can play it directly. */
  registerElement?: (element: HTMLVideoElement | null, active: boolean) => void;
  /** The browser refused audible playback for this specific clip. */
  onAudioBlocked?: (contentId: string) => void;
  /** Audible playback is running, so any stale prompt can be retired. */
  onAudiblePlayback?: () => void;
  /** Fired once when playback actually begins for this clip. */
  onStarted?: (video: FeedVideo) => void;
  /** Fired when the clip plays through to its end. */
  onEnded?: (video: FeedVideo) => void;
  /**
   * Playback milestones, each reported at most once per clip: a three-second
   * view, then quarter, half and three-quarter progress. Deduplicated here so
   * scrubbing, pausing or resuming cannot inflate the counts.
   */
  onMilestone?: (video: FeedVideo, milestone: Milestone) => void;
}

export type Milestone = 'video_3s_view' | 'video_25_percent' | 'video_50_percent' | 'video_75_percent';

const PROGRESS_MILESTONES: Array<{ at: number; milestone: Milestone }> = [
  { at: 0.25, milestone: 'video_25_percent' },
  { at: 0.5, milestone: 'video_50_percent' },
  { at: 0.75, milestone: 'video_75_percent' },
];

/**
 * Keeps memory and bandwidth bounded across a 46-clip pool.
 *
 * Only the clip on screen plays. The next one buffers so a swipe starts
 * instantly; the previous one is kept, already decoded, so swiping back is
 * instant too. Anything outside that window is never mounted, so the browser
 * is only ever holding three video elements regardless of how long the visitor
 * browses.
 */
const PRELOAD: Record<VideoRole, 'auto' | 'metadata'> = {
  current: 'auto',
  next: 'auto',
  previous: 'metadata',
};

/** Keeps the property and the attribute in step, in that order, always. */
function applyMuted(element: HTMLVideoElement, wantsSound: boolean) {
  element.muted = !wantsSound;
  // Some iOS versions read the attribute rather than the property when
  // deciding what may autoplay.
  if (wantsSound) element.removeAttribute('muted');
  else element.setAttribute('muted', '');
}

export default function VideoFeedItem({
  video, role, shouldPlay, soundEnabled, audioAttempt,
  registerElement, onAudioBlocked, onAudiblePlayback,
  onStarted, onEnded, onMilestone,
}: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const startedFor = useRef<string | null>(null);
  const reached = useRef(new Set<Milestone>());

  /**
   * This clip, and only this clip, was refused audible playback.
   *
   * Held locally so the retry cannot loop: one audible attempt per clip, then
   * it plays muted. Cleared when the clip changes or when the visitor asks for
   * sound again — never on its own, and never for other clips.
   */
  const [refusedHere, setRefusedHere] = useState(false);

  /**
   * Cloudinary failed for this clip, so the bundled original is used instead.
   *
   * One switch per clip and no retry: if the fallback fails too, the poster
   * field stays rather than the feed looping on a broken source.
   */
  const [useLocal, setUseLocal] = useState(false);
  const source = useLocal ? video.localSrc : video.src;

  const active = role === 'current';
  const wantsSound = active && soundEnabled && !refusedHere;

  // Read by the ref callback, which runs before any effect has had a chance to
  // set anything.
  const wantsSoundRef = useRef(wantsSound);
  wantsSoundRef.current = wantsSound;
  const activeRef = useRef(active);
  activeRef.current = active;

  /**
   * Mutes the element the instant it exists.
   *
   * A freshly mounted <video> defaults to *unmuted*, and a ref callback runs
   * during commit — before paint and before every effect. Setting it here is
   * what stops a new element from briefly holding the wrong value and then
   * having feed state applied over the top of it.
   */
  const attachRef = useCallback((element: HTMLVideoElement | null) => {
    ref.current = element;
    if (!element) return;
    applyMuted(element, wantsSoundRef.current);
    registerElement?.(element, activeRef.current);
  }, [registerElement]);

  useEffect(() => {
    setReady(false);
    startedFor.current = null;
    reached.current = new Set();
  }, [video.id]);

  useEffect(() => { setRefusedHere(false); }, [video.id, audioAttempt]);
  useEffect(() => { setUseLocal(false); }, [video.id]);

  // Role changes without remounting, so the feed is told again which element
  // is the active one.
  useEffect(() => { registerElement?.(ref.current, active); }, [registerElement, active, video.id]);

  const reportAudible = useCallback(() => {
    if (wantsSoundRef.current) onAudiblePlayback?.();
  }, [onAudiblePlayback]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Order matters on mobile Safari: muted is settled first, play() second,
    // and muted is never changed afterwards to "fix up" a running element.
    applyMuted(element, wantsSound);

    if (!active || !shouldPlay) {
      element.pause();
      return;
    }

    // play() resumes from the current position, so closing an overlay picks up
    // where the visitor left off instead of restarting the clip.
    const played = element.play();
    if (!played || typeof played.then !== 'function') return;

    void played.then(reportAudible).catch((error: unknown) => {
      if (!wantsSound) {
        // Already silent and still refused — iOS Low Power Mode, for example.
        // The poster state stays visible rather than the screen going blank.
        return;
      }
      if (!isAutoplayRejection(error)) {
        // A genuine media fault, not the autoplay policy. Reporting it as a
        // sound block would put a misleading prompt in front of the visitor.
        return;
      }
      // The policy refused this clip. Fall back to silent playback so the feed
      // keeps moving, and tell the feed which clip it was. The visitor's
      // standing preference is untouched.
      setRefusedHere(true);
      applyMuted(element, false);
      void element.play().catch(() => {});
      onAudioBlocked?.(video.id);
      if (import.meta.env.DEV) {
        console.info(`[feed-sound] "${video.id}" was refused audible playback; continuing muted.`);
      }
    });
  }, [active, shouldPlay, wantsSound, video.id, onAudioBlocked, reportAudible]);

  const handleTimeUpdate = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    if (!active || !onMilestone) return;
    const element = event.currentTarget;
    const { currentTime, duration } = element;

    const report = (milestone: Milestone) => {
      if (reached.current.has(milestone)) return;
      reached.current.add(milestone);
      onMilestone(video, milestone);
    };

    if (currentTime >= 3) report('video_3s_view');
    if (!Number.isFinite(duration) || duration <= 0) return;
    for (const { at, milestone } of PROGRESS_MILESTONES) {
      if (currentTime / duration >= at) report(milestone);
    }
  };

  const handlePlaying = () => {
    setReady(true);
    if (startedFor.current === video.id) return;
    startedFor.current = video.id;
    if (active) onStarted?.(video);
  };

  return (
    <div
      className="absolute inset-0 transition-opacity duration-300"
      style={{ opacity: active ? 1 : 0, zIndex: active ? 1 : 0 }}
      aria-hidden={!active}
    >
      {/* Poster state: a graceful brand-dark field rather than a blank frame
          or a spinner while the clip buffers. */}
      <div
        className="absolute inset-0 transition-opacity duration-500"
        style={{
          opacity: ready ? 0 : 1,
          background: 'radial-gradient(120% 90% at 50% 25%, #161616 0%, #0c0c0c 55%, #080808 100%)',
        }}
      />
      <video
        ref={attachRef}
        src={source}
        onError={() => {
          // Only ever falls back, never forward, so this cannot loop.
          if (useLocal || video.localSrc === video.src) return;
          setUseLocal(true);
          console.warn(`[video-feed] "${video.id}" failed to load from Cloudinary; serving the bundled original.`);
        }}
        // `muted` is applied in the ref callback and the effect above, not
        // declared here: it follows the feed's sound setting, and React
        // reconciles the property and the attribute differently once the
        // element is mounted.
        playsInline
        preload={PRELOAD[role]}
        controls={false}
        disablePictureInPicture
        disableRemotePlayback
        tabIndex={-1}
        aria-label={`Tattoo work by BANG Private Tattoos — ${video.label}`}
        onLoadedData={() => setReady(true)}
        onPlaying={handlePlaying}
        onTimeUpdate={handleTimeUpdate}
        // Deliberately not `loop`: reaching the end is what advances the feed.
        onEnded={() => { if (active) onEnded?.(video); }}
        className="w-full h-full object-cover pointer-events-none"
        style={{ opacity: ready ? 1 : 0, transition: 'opacity 320ms ease' }}
      />
      {/* Legibility scrim: darker at the top bar and behind the caption/CTAs. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(8,8,8,0.58) 0%, transparent 22%, transparent 52%, rgba(8,8,8,0.88) 100%)' }}
      />
    </div>
  );
}
