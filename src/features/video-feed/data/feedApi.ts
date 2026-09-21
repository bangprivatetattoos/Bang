import { getAnalyticsAttribution, getAnalyticsSessionId, getAnalyticsVisitorId } from '../../../analytics/client';
import type { PublicComment, ReactionKind } from '../types';

const COMMENTS_ENDPOINT = '/.netlify/functions/content-comments';
const COMMENT_REACTIONS_ENDPOINT = '/.netlify/functions/comment-reactions';
const REACTIONS_ENDPOINT = '/.netlify/functions/content-reactions';
const INQUIRIES_ENDPOINT = '/.netlify/functions/inquiries';
const BOOKING_INTENT_ENDPOINT = '/.netlify/functions/booking-intent';

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * The anonymous visitor identifier.
 *
 * This is the random UUID the analytics client already persists per browser.
 * It is reused rather than minting a second one, and it is only ever used for
 * legitimate application state: whether this browser has reacted to a clip or
 * a comment, and de-duplicating a double-posted comment. Nothing about it is
 * derived from the device, the network or the browser — it is not a
 * fingerprint, and it identifies no person.
 */
export function anonymousVisitorId(): string {
  return getAnalyticsVisitorId();
}

async function request<T>(url: string, init?: RequestInit): Promise<T | null> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { credentials: 'same-origin', signal: controller.signal, ...init });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

/** Published comments for one clip, with their replies and reaction totals. */
export async function fetchComments(contentId: string): Promise<PublicComment[] | null> {
  const body = await request<{ comments?: PublicComment[] }>(
    `${COMMENTS_ENDPOINT}?contentId=${encodeURIComponent(contentId)}`,
  );
  return body?.comments ?? null;
}

export type CommentSubmission =
  | { ok: true; comment?: PublicComment }
  | { ok: false; fields?: Record<string, string> };

/**
 * Posts a comment.
 *
 * Only a body is required. A blank display name is sent as-is and rendered
 * publicly as "Anonymous" — no contact detail is requested or stored here.
 */
export async function submitComment(input: { contentId: string; displayName: string; comment: string }): Promise<CommentSubmission> {
  const response = await fetch(COMMENTS_ENDPOINT, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contentId: input.contentId,
      displayName: input.displayName.trim() || null,
      comment: input.comment,
      visitorId: anonymousVisitorId(),
      analyticsSessionId: getAnalyticsSessionId(),
    }),
  }).catch(() => null);

  if (!response) return { ok: false };
  const body = await response.json().catch(() => null);
  if (response.ok) return { ok: true, comment: body?.comment };
  if (body?.error === 'invalid_request' && body.fields) return { ok: false, fields: body.fields };
  return { ok: false };
}

export interface CommentReactionState {
  commentId: string;
  reactionCount: number;
  mine: ReactionKind | null;
}

export async function fetchCommentReaction(commentId: string): Promise<CommentReactionState | null> {
  return request<CommentReactionState>(
    `${COMMENT_REACTIONS_ENDPOINT}?commentId=${encodeURIComponent(commentId)}&visitorId=${encodeURIComponent(anonymousVisitorId())}`,
  );
}

/** Sets or clears this visitor's reaction on a comment. */
export async function setCommentReaction(commentId: string, reaction: ReactionKind | null): Promise<CommentReactionState | null> {
  return request<CommentReactionState>(COMMENT_REACTIONS_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ commentId, reaction, visitorId: anonymousVisitorId() }),
  });
}

export interface ReactionResponse {
  counts: Record<ReactionKind, number>;
  mine: ReactionKind | null;
}

export async function fetchReactions(contentId: string): Promise<ReactionResponse | null> {
  return request<ReactionResponse>(
    `${REACTIONS_ENDPOINT}?contentId=${encodeURIComponent(contentId)}&visitorId=${encodeURIComponent(anonymousVisitorId())}`,
  );
}

/** Sets or clears this visitor's reaction on a clip. `null` removes it. */
export async function setReaction(contentId: string, reaction: ReactionKind | null): Promise<ReactionResponse | null> {
  return request<ReactionResponse>(REACTIONS_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contentId, reaction, visitorId: anonymousVisitorId() }),
  });
}

export type InquirySubmission = { ok: true } | { ok: false; fields?: Record<string, string> };

/**
 * Sends a private enquiry.
 *
 * Unlike a comment this may carry the contact detail the visitor chose to
 * give. It is stored in a table with no public read path and is never shown
 * on the site.
 */
export async function submitInquiry(input: {
  message: string;
  displayName: string;
  contact: string;
  contentId?: string | null;
  artistId?: string | null;
}): Promise<InquirySubmission> {
  const response = await fetch(INQUIRIES_ENDPOINT, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...input,
      displayName: input.displayName.trim() || null,
      visitorId: anonymousVisitorId(),
      analyticsSessionId: getAnalyticsSessionId(),
      attribution: getAnalyticsAttribution(),
    }),
  }).catch(() => null);

  if (!response) return { ok: false };
  const body = await response.json().catch(() => null);
  if (response.ok) return { ok: true };
  if (body?.error === 'invalid_request' && body.fields) return { ok: false, fields: body.fields };
  return { ok: false };
}

export interface BookingIntentInput {
  submissionId: string;
  location: string;
  artistId: string | null;
  artistName: string | null;
  tattooType: string;
  priceRange: string;
}

/**
 * Records the anonymous booking selections and returns the Meta event id for
 * the matching browser-side Lead, so the Pixel and CAPI events deduplicate.
 *
 * No name, email or phone is sent, because the flow never asks for any.
 */
export async function recordBookingIntent(input: BookingIntentInput): Promise<{ metaEventId: string } | null> {
  const body = await request<{ reference?: string; meta_event_id?: string }>(BOOKING_INTENT_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...input,
      analyticsSessionId: getAnalyticsSessionId(),
      attribution: getAnalyticsAttribution(),
    }),
  });

  const expected = body?.reference ? `bpt_lead_${body.reference}` : null;
  return expected && body?.meta_event_id === expected ? { metaEventId: expected } : null;
}
