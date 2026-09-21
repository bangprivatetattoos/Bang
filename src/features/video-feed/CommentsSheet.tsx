import { useCallback, useEffect, useId, useState } from 'react';
import Sheet from './ui/Sheet';
import { CheckIcon, HeartIcon, LockIcon } from './ui/icons';
import { fetchComments, setCommentReaction, submitComment, submitInquiry } from './data/feedApi';
import { useCommentsRealtime } from './hooks/useCommentsRealtime';
import type { PublicComment } from './types';

interface Props {
  contentId: string;
  /** `enquiry` opens a private message to the studio instead of a comment. */
  variant: 'comments' | 'enquiry';
  /** Set when the enquiry came from an artist's gallery. */
  artistId?: string | null;
  onClose: () => void;
  onSubmitted?: () => void;
  onCountChange?: (contentId: string, count: number) => void;
}

const PRIVACY_COPY =
  'Your contact details are private and will not be displayed publicly. They are collected only so BANG PRIVATE TATTOOS can contact you regarding your enquiry.';

type Status = 'loading' | 'ready' | 'unavailable';

function relativeDate(iso: string) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const minutes = Math.floor((Date.now() - then) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** One comment, its official reply and its reaction control. */
function CommentRow({ comment, onReact }: { comment: PublicComment; onReact: (id: string, next: boolean) => void }) {
  const [reacted, setReacted] = useState(false);

  return (
    <article className="py-3.5" style={{ borderBottom: '1px solid #1e1e1e' }}>
      <div className="flex items-center justify-between gap-3 mb-1.5">
        {/* A blank name is shown as Anonymous rather than left empty. */}
        <span className="text-[#f4f3ef] text-[13px] font-medium truncate">{comment.displayName ?? 'Anonymous'}</span>
        <span className="text-[#626262] text-[11px] flex-shrink-0">{relativeDate(comment.createdAt)}</span>
      </div>
      {/* Rendered as a text node — never as HTML. */}
      <p className="text-[#b5b5b2] text-[13px] leading-relaxed whitespace-pre-line">{comment.comment}</p>

      <div className="flex items-center gap-3 mt-2">
        <button
          type="button"
          onClick={() => { const next = !reacted; setReacted(next); onReact(comment.id, next); }}
          aria-pressed={reacted}
          aria-label={reacted ? 'Remove your reaction' : 'React to this comment'}
          className="feed-focusable flex items-center gap-1.5 min-h-11 -my-2 px-1"
          style={{ color: reacted ? 'var(--feed-accent)' : '#626262' }}
        >
          <HeartIcon filled={reacted} size={15} />
          {comment.reactionCount + (reacted ? 1 : 0) > 0 && (
            <span className="text-[11px] tabular-nums">{comment.reactionCount + (reacted ? 1 : 0)}</span>
          )}
        </button>
      </div>

      {comment.replies.map(reply => (
        <div key={reply.id} className="mt-3 ml-3 pl-3 rounded-r-lg" style={{ borderLeft: '2px solid #383838' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="display-font text-[10px] font-bold tracking-[0.18em] text-[#f4f3ef] uppercase">
              BANG PRIVATE TATTOOS
            </span>
            <span
              className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded text-[#101010] bg-[#f4f3ef] font-bold"
            >
              Official reply
            </span>
          </div>
          <p className="text-[#b5b5b2] text-[12.5px] leading-relaxed whitespace-pre-line">{reply.body}</p>
          <p className="text-[#626262] text-[10px] mt-1">{relativeDate(reply.createdAt)}</p>
        </div>
      ))}
    </article>
  );
}

export default function CommentsSheet({ contentId, variant, artistId, onClose, onSubmitted, onCountChange }: Props) {
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [composing, setComposing] = useState(variant === 'enquiry');
  const [fields, setFields] = useState({ displayName: '', contact: '', comment: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const nameId = useId();
  const contactId = useId();
  const commentId = useId();

  const isEnquiry = variant === 'enquiry';

  const load = useCallback(() => {
    if (isEnquiry) { setStatus('ready'); return; }
    void fetchComments(contentId).then(result => {
      if (result === null) { setStatus('unavailable'); return; }
      setComments(result);
      setStatus('ready');
      onCountChange?.(contentId, result.length);
    });
  }, [contentId, isEnquiry, onCountChange]);

  useEffect(() => { setStatus('loading'); load(); }, [load]);

  // Someone else's comment, or a moderation change, lands here without a refresh.
  useCommentsRealtime({ contentId: isEnquiry ? null : contentId, onCommentsChanged: load });

  const update = (key: keyof typeof fields) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { value } = event.target;
    setFields(current => ({ ...current, [key]: value }));
    setErrors(current => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const handleReact = useCallback((id: string, next: boolean) => {
    void setCommentReaction(id, next ? 'love' : null);
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    const next: Record<string, string> = {};
    if (!fields.comment.trim()) next.comment = isEnquiry ? 'Tell us what you would like to know' : 'Write a comment';
    if (Object.keys(next).length) { setErrors(next); return; }

    setSubmitting(true);
    const result = isEnquiry
      ? await submitInquiry({
          message: fields.comment.trim(),
          displayName: fields.displayName,
          contact: fields.contact.trim(),
          contentId,
          artistId: artistId ?? null,
        })
      : await submitComment({ contentId, displayName: fields.displayName, comment: fields.comment.trim() });
    setSubmitting(false);

    if (!result.ok) {
      setErrors(result.fields ?? { form: 'We could not send that just now. Please try again.' });
      return;
    }
    setDone(true);
    setFields({ displayName: '', contact: '', comment: '' });
    onSubmitted?.();
    if (!isEnquiry) load();
  };

  const title = isEnquiry ? 'Make Enquiry' : `Comments${status === 'ready' ? ` (${comments.length})` : ''}`;
  const subtitle = isEnquiry ? "We'll get back to you personally" : undefined;

  return (
    <Sheet onClose={onClose} title={title} subtitle={subtitle}>
      {done ? (
        <div className="px-5 py-10 text-center animate-feed-fade-in-up" style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom))' }}>
          <div className="w-11 h-11 rounded-full bg-[#161616] flex items-center justify-center mx-auto mb-3 text-[#f4f3ef]" style={{ border: '1px solid #383838' }}>
            <CheckIcon />
          </div>
          <p className="display-font text-[15px] font-bold uppercase tracking-wider text-[#f4f3ef]">
            {isEnquiry ? 'Enquiry received' : 'Comment posted'}
          </p>
          <p className="text-[#858585] text-[12.5px] mt-1.5 leading-relaxed max-w-xs mx-auto">
            {isEnquiry
              ? 'Our team will review your message and contact you using the details you provided.'
              : 'Thanks — your comment is now on this piece.'}
          </p>
          <button
            type="button"
            onClick={isEnquiry ? onClose : () => { setDone(false); setComposing(false); }}
            className="feed-focusable mt-6 w-full py-3.5 min-h-11 rounded-xl text-[#b5b5b2] text-[13px] uppercase tracking-wider"
            style={{ border: '1px solid rgba(255,255,255,0.14)' }}
          >
            {isEnquiry ? 'Close' : 'Back to comments'}
          </button>
        </div>
      ) : (
        <>
          {!isEnquiry && (
            <div className="feed-scroll flex-1 overflow-y-auto px-5 py-2 min-h-[120px]">
              {status === 'loading' && <p className="text-[#626262] text-[13px] py-6">Loading comments…</p>}

              {status === 'unavailable' && (
                <p className="text-[#626262] text-[13px] py-6 leading-relaxed">
                  Comments are unavailable right now. You can still leave one and it will appear once the connection is back.
                </p>
              )}

              {status === 'ready' && comments.length === 0 && (
                <p className="text-[#626262] text-[13px] py-6 leading-relaxed">
                  No comments on this one yet. Be the first to leave one.
                </p>
              )}

              {comments.map(comment => (
                <CommentRow key={comment.id} comment={comment} onReact={handleReact} />
              ))}
            </div>
          )}

          {!composing ? (
            <div className="px-5 pb-7 pt-3 flex-shrink-0" style={{ paddingBottom: 'max(28px, env(safe-area-inset-bottom))' }}>
              <button
                type="button"
                onClick={() => setComposing(true)}
                className="feed-focusable w-full py-3.5 min-h-11 rounded-xl text-[#b5b5b2] text-[13px] uppercase tracking-wider"
                style={{ border: '1px solid rgba(255,255,255,0.14)' }}
              >
                + Add a comment
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="feed-scroll px-5 pb-5 pt-3 flex-shrink-0 space-y-3 overflow-y-auto"
              style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
            >
              <div>
                <label htmlFor={nameId} className="text-[#626262] text-[10px] uppercase tracking-widest block mb-1">
                  {isEnquiry ? 'Name (optional)' : 'Name or nickname (optional)'}
                </label>
                <input
                  id={nameId}
                  value={fields.displayName}
                  onChange={update('displayName')}
                  maxLength={60}
                  autoComplete="nickname"
                  placeholder="Leave blank to post as Anonymous"
                  className="w-full px-3.5 py-2.5"
                />
              </div>

              {/* Contact is requested only for a private enquiry. An ordinary
                  comment never asks for a phone number or an email address. */}
              {isEnquiry && (
                <div>
                  <label htmlFor={contactId} className="text-[#626262] text-[10px] uppercase tracking-widest block mb-1">
                    Phone or email
                  </label>
                  <input
                    id={contactId}
                    value={fields.contact}
                    onChange={update('contact')}
                    maxLength={254}
                    inputMode="email"
                    autoComplete="email"
                    placeholder="So we can reply to you"
                    aria-invalid={Boolean(errors.contact)}
                    className="w-full px-3.5 py-2.5"
                  />
                  {errors.contact && <p className="text-[#d7cec1] text-[11px] mt-1">{errors.contact}</p>}
                </div>
              )}

              <div>
                <label htmlFor={commentId} className="text-[#626262] text-[10px] uppercase tracking-widest block mb-1">
                  {isEnquiry ? 'Your enquiry *' : 'Comment *'}
                </label>
                <textarea
                  id={commentId}
                  value={fields.comment}
                  onChange={update('comment')}
                  maxLength={isEnquiry ? 4000 : 1200}
                  rows={isEnquiry ? 4 : 3}
                  placeholder={isEnquiry ? 'What would you like to know?' : 'Share your thoughts…'}
                  aria-invalid={Boolean(errors.comment)}
                  className="w-full px-3.5 py-2.5 resize-none"
                />
                {errors.comment && <p className="text-[#d7cec1] text-[11px] mt-1">{errors.comment}</p>}
              </div>

              {isEnquiry && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-[#141414]" style={{ border: '1px solid #2a2a2a' }}>
                  <span className="text-[#575757] mt-0.5 flex-shrink-0"><LockIcon /></span>
                  <p className="text-[#575757] text-[10px] leading-relaxed">{PRIVACY_COPY}</p>
                </div>
              )}

              {errors.form && <p aria-live="polite" className="text-[#d7cec1] text-[12px]">{errors.form}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="feed-focusable w-full py-3.5 min-h-11 rounded-xl bg-[#f4f3ef] text-[#101010] text-[13px] font-semibold uppercase tracking-wider disabled:opacity-40"
              >
                {submitting ? 'Sending…' : isEnquiry ? 'Send Enquiry' : 'Post Comment'}
              </button>

              {!isEnquiry && (
                <button
                  type="button"
                  onClick={() => setComposing(false)}
                  className="feed-focusable w-full py-2 min-h-11 text-[#626262] text-[12px] text-center"
                >
                  Cancel
                </button>
              )}
            </form>
          )}
        </>
      )}
    </Sheet>
  );
}
