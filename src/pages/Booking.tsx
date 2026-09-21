import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ARTISTS } from '../data/artists';
import { whatsappUrl } from '../data/siteContact';
import { getAnalyticsSessionId, trackAnalytics } from '../analytics/client';
import { trackMetaLead } from '../analytics/metaPixel';
import type { BookingRequest, BookingResult } from '../lib/supabase/createBooking';

type ServiceType = 'studio' | 'home-call';
type FormState = 'idle' | 'loading' | 'error' | 'success';

interface BookingProps {
  preselectedArtistId?: string | null;
  preselectedServiceType?: ServiceType;
}

const WA_HELP_URL = whatsappUrl("Hi, I'd like help booking a tattoo consultation.");
const HANDOFF_DELAY_MS = 2_000;
const HANDOFF_STORAGE_PREFIX = 'bpt_whatsapp_handoff_';
const HANDOFF_ANALYTICS_STORAGE_PREFIX = 'bpt_whatsapp_handoff_analytics_';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LENGTHS = { name: 120, email: 254, whatsapp: 32, city: 160, idea: 4000, placement: 120, size: 120 };
// Backend field names mapped to form fields, so server-side validation errors appear under the matching input.
const FORM_FIELDS: Record<string, string> = {
  full_name: 'name',
  email: 'email',
  phone: 'whatsapp',
  location: 'city',
  tattoo_idea: 'idea',
  placement: 'placement',
  approximate_size: 'size',
};

// The booking endpoint module is loaded only when a visitor submits the form.
async function submitBooking(booking: BookingRequest): Promise<BookingResult> {
  try {
    const { createBooking } = await import('../lib/supabase/createBooking');
    return await createBooking(booking);
  } catch {
    return { ok: false };
  }
}

function newSubmissionId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // crypto.randomUUID is unavailable outside secure contexts (e.g. a LAN IP over http).
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export default function Booking({ preselectedArtistId, preselectedServiceType }: BookingProps) {
  const navigate = useNavigate();
  const artist = preselectedArtistId ? ARTISTS.find(a => a.id === preselectedArtistId) : null;
  const [formState, setFormState] = useState<FormState>('idle');
  const [reference, setReference] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType>(preselectedServiceType ?? 'studio');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submissionError, setSubmissionError] = useState('');
  const [handoffSeconds, setHandoffSeconds] = useState<number | null>(null);
  const submitting = useRef(false);
  const lastAttempt = useRef<{ details: string; submissionId: string } | null>(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    whatsapp: '',
    city: '',
    artistId: preselectedArtistId || '',
    location: '',
    idea: '',
    placement: '',
    size: '',
  });

  useEffect(() => {
    if (preselectedArtistId) setForm(f => ({ ...f, artistId: preselectedArtistId }));
  }, [preselectedArtistId]);

  useEffect(() => {
    if (preselectedServiceType) setServiceType(preselectedServiceType);
  }, [preselectedServiceType]);

  useEffect(() => {
    trackAnalytics('booking_start', { entityType: 'service', entityId: preselectedServiceType ?? 'studio' });
  }, []);

  const storageGet = (key: string) => {
    try { return window.sessionStorage.getItem(key); } catch { return null; }
  };

  const storageSet = (key: string) => {
    try { window.sessionStorage.setItem(key, '1'); } catch { /* Safari private mode can deny storage. */ }
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [k]: e.target.value }));
    setErrors(er => { const n = { ...er }; delete n[k]; return n; });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    const phoneDigits = form.whatsapp.replace(/\D/g, '').length;
    if (!form.name.trim()) e.name = 'Required';
    if (!EMAIL_PATTERN.test(form.email.trim())) e.email = 'Valid email required';
    if (!/^[+()\-\s\d]+$/.test(form.whatsapp.trim()) || phoneDigits < 7 || phoneDigits > 15) e.whatsapp = 'Valid WhatsApp / phone required';
    if (!form.idea.trim()) e.idea = 'Tell us a little about your idea';
    if (serviceType === 'home-call' && !form.city.trim()) e.city = 'Required for Home Call';
    for (const [key, max] of Object.entries(MAX_LENGTHS)) {
      if (key === 'city' && serviceType !== 'home-call') continue;
      if (!e[key] && form[key as keyof typeof MAX_LENGTHS].trim().length > max) e[key] = `Must be ${max} characters or fewer`;
    }
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const details = {
      full_name: form.name.trim(),
      email: form.email.trim(),
      phone: form.whatsapp.trim(),
      service_type: serviceType,
      location: serviceType === 'home-call' ? form.city.trim() : null,
      preferred_artist: ARTISTS.some(a => a.id === form.artistId) ? form.artistId : null,
      tattoo_idea: form.idea.trim(),
      placement: form.placement.trim() || null,
      approximate_size: form.size.trim() || null,
    };
    // Retrying unchanged details reuses the submission id, so the backend returns the
    // original reference instead of storing a duplicate lead.
    const detailsKey = JSON.stringify(details);
    const attempt = lastAttempt.current?.details === detailsKey
      ? lastAttempt.current
      : { details: detailsKey, submissionId: newSubmissionId() };
    lastAttempt.current = attempt;

    submitting.current = true;
    setFormState('loading');
    setSubmissionError('');
    const result = await submitBooking({ ...details, submission_id: attempt.submissionId, analytics_session_id: getAnalyticsSessionId() });
    submitting.current = false;

    if (result.ok) {
      trackAnalytics('booking_success', { entityType: 'service', entityId: serviceType });
      trackMetaLead(result.metaEventId);
      setReference(result.reference);
      setFormState('success');
      window.scrollTo({ top: 0 });
      return;
    }

    const fieldErrors: Record<string, string> = {};
    for (const [field, message] of Object.entries(result.fields ?? {})) {
      if (FORM_FIELDS[field]) fieldErrors[FORM_FIELDS[field]] = message;
    }
    if (Object.keys(fieldErrors).length) setErrors(fieldErrors);
    setSubmissionError(Object.keys(fieldErrors).length
      ? 'Please check the highlighted details and try again.'
      : "We couldn't send your request. Your details are still here, so please try again.");
    setFormState('error');
  };

  const openWhatsApp = () => {
    if (!reference) return;
    const handoffKey = `${HANDOFF_STORAGE_PREFIX}${reference}`;
    const analyticsKey = `${HANDOFF_ANALYTICS_STORAGE_PREFIX}${reference}`;
    storageSet(handoffKey);
    if (!storageGet(analyticsKey)) {
      storageSet(analyticsKey);
      trackAnalytics('whatsapp_handoff', { entityType: 'booking', entityId: reference });
    }
    const artistName = form.artistId ? ARTISTS.find(a => a.id === form.artistId)?.name ?? form.artistId : 'No preference';
    const message = [
      'Hi BANG PRIVATE TATTOOS,',
      '',
      'I just submitted a tattoo consultation through the website.',
      '',
      `Reference: ${reference}`,
      `Name: ${form.name.trim()}`,
      `Service: ${serviceType === 'home-call' ? 'Home Call' : 'Studio Appointment'}`,
      `Preferred Artist: ${artistName}`,
      ...(form.city.trim() ? [`Location: ${form.city.trim()}`] : []),
      ...(form.placement.trim() ? [`Placement: ${form.placement.trim()}`] : []),
      ...(form.size.trim() ? [`Approximate Size: ${form.size.trim()}`] : []),
      '',
      'Tattoo idea:',
      form.idea.trim(),
      '',
      "I'd like to continue with my consultation.",
    ].join('\n');
    window.location.assign(whatsappUrl(message));
  };

  useEffect(() => {
    if (formState !== 'success' || !reference) return;
    if (storageGet(`${HANDOFF_STORAGE_PREFIX}${reference}`)) {
      setHandoffSeconds(null);
      return;
    }
    setHandoffSeconds(2);
    const startedAt = Date.now();
    const countdown = window.setInterval(() => {
      setHandoffSeconds(Math.max(1, Math.ceil((HANDOFF_DELAY_MS - (Date.now() - startedAt)) / 1_000)));
    }, 200);
    const handoff = window.setTimeout(() => {
      if (!storageGet(`${HANDOFF_STORAGE_PREFIX}${reference}`)) openWhatsApp();
    }, HANDOFF_DELAY_MS);
    return () => { window.clearInterval(countdown); window.clearTimeout(handoff); };
  }, [formState, reference]);

  if (formState === 'success' && reference) {
    return (
      <div className="min-h-[100dvh] bg-[#111111] flex flex-col items-center justify-center px-5 py-20 text-center" style={{ paddingTop: 'calc(max(80px, env(safe-area-inset-top)) + 40px)' }}>
        <p className="text-[10px] tracking-[0.3em] uppercase text-[#858582] font-body mb-6">Consultation Received</p>
        <h1 className="font-display font-900 text-[18vw] md:text-[10vw] lg:text-[7vw] uppercase leading-none tracking-tight text-[#f5f5f2] mb-6">
          REQUEST<br />RECEIVED.
        </h1>
        <div className="inline-block border border-white/10 px-6 py-3 mb-8">
          <p className="text-[10px] tracking-[0.25em] uppercase text-[#858582] font-body mb-1">Reference</p>
          <p className="font-display font-700 text-2xl tracking-widest text-[#f5f5f2]">{reference}</p>
        </div>
        <p className="font-body text-[#b7b7b2] text-sm max-w-md leading-relaxed mb-10">
          Your consultation request has been saved. Continue with our booking team on WhatsApp to discuss your tattoo, artist availability, scheduling, pricing, placement, and references.
        </p>
        {handoffSeconds !== null && (
          <p className="text-[10px] tracking-[0.18em] uppercase text-[#858582] font-body -mt-5 mb-5" aria-live="polite">
            Continuing to WhatsApp in {handoffSeconds} {handoffSeconds === 1 ? 'second' : 'seconds'}...
          </p>
        )}
        <button
          onClick={openWhatsApp}
          className="bg-[#f5f5f2] text-[#111111] font-body font-600 text-[11px] tracking-[0.2em] uppercase px-8 py-4 hover:bg-white transition-colors mb-4"
        >
          Continue to WhatsApp →
        </button>
        <button
          onClick={() => navigate('/')}
          className="text-[11px] tracking-[0.15em] uppercase font-body text-[#858582] hover:text-[#f5f5f2] transition-colors"
        >
          Back to Studio
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[100svh] bg-[#111111]" style={{ paddingTop: 'calc(max(80px, env(safe-area-inset-top)) + 40px)' }}>
      <div className="max-w-[680px] min-w-0 mx-auto px-5 md:px-8 pb-24">

        {/* Artist context */}
        {artist && (
          <div className="flex items-center gap-4 mb-12 pb-8 border-b border-white/06">
            <div className="w-16 h-16 bg-[#1c1c1c] overflow-hidden shrink-0">
              <img src={artist.portrait} alt={artist.name} className="w-full h-full object-cover" loading="lazy" />
            </div>
            <div>
              <p className="text-[9px] tracking-[0.25em] uppercase text-[#858582] font-body mb-0.5">Booking with</p>
              <p className="font-display font-800 text-xl uppercase tracking-wider text-[#f5f5f2]">{artist.name}</p>
              <p className="text-[11px] text-[#858582] font-body">{artist.specialties.join(' · ')}</p>
            </div>
          </div>
        )}

        {/* Headline */}
        <h1 className="font-display font-900 text-[15vw] md:text-[11vw] lg:text-[9vw] uppercase leading-none tracking-tight text-[#f5f5f2] mb-4">
          {artist ? (
            <>REQUEST AN<br />APPOINTMENT<br />WITH {artist.name.split(' ')[0].toUpperCase()}.</>
          ) : (
            <>LET'S TALK<br />ABOUT YOUR<br />TATTOO.</>
          )}
        </h1>
        <p className="font-body text-[#858582] text-sm leading-relaxed mb-12 max-w-sm">
          Tell us a few details below. Once your request is received, you can continue directly with our booking team through WhatsApp.
        </p>

        <form onSubmit={handleSubmit} noValidate className="min-w-0">
          {/* Service type */}
          <div className="mb-8">
            <p className="text-[10px] tracking-[0.25em] uppercase text-[#858582] font-body mb-3">Service Type</p>
            <div className="flex gap-0 border border-white/10">
              {(['studio', 'home-call'] as ServiceType[]).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setServiceType(type)}
                  className="flex-1 py-3 text-[11px] tracking-[0.2em] uppercase font-body font-500 transition-all"
                  style={{
                    background: serviceType === type ? '#f5f5f2' : 'transparent',
                    color: serviceType === type ? '#111111' : '#858582',
                  }}
                >
                  {type === 'studio' ? 'Studio Appointment' : 'Home Call'}
                </button>
              ))}
            </div>
          </div>

          {/* Fields */}
          <div className="flex flex-col gap-5">
            <Field label="Full Name" error={errors.name}>
              <input value={form.name} onChange={set('name')} placeholder="Your full name" className="booking-control w-full px-4 py-3.5" />
            </Field>
            <Field label="Email" error={errors.email}>
              <input type="email" value={form.email} onChange={set('email')} placeholder="your@email.com" className="booking-control w-full px-4 py-3.5" />
            </Field>
            <Field label="WhatsApp / Phone" error={errors.whatsapp}>
              <input type="tel" value={form.whatsapp} onChange={set('whatsapp')} placeholder="+1 (555) 000-0000" className="booking-control w-full px-4 py-3.5" />
            </Field>

            {serviceType === 'home-call' && (
              <Field label="City / Location" error={errors.city}>
                <input value={form.city} onChange={set('city')} placeholder="City, State" className="booking-control w-full px-4 py-3.5" />
              </Field>
            )}

            {!artist && (
              <Field label="Preferred Artist (optional)">
                <select value={form.artistId} onChange={set('artistId')} className="booking-control w-full px-4 py-3.5 cursor-pointer">
                  <option value="">No preference / Help me choose</option>
                  {ARTISTS.map(a => (
                    <option key={a.id} value={a.id}>{a.name} — {a.specialties[0]}</option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="Tell Us About Your Tattoo Idea" error={errors.idea}>
              <textarea value={form.idea} onChange={set('idea')} placeholder="Describe the concept, style, references, or anything that helps us understand your vision..." rows={5} className="booking-control w-full px-4 py-3.5 resize-none" />
            </Field>

            <div className="grid min-w-0 grid-cols-1 min-[420px]:grid-cols-2 gap-5">
              <Field label="Placement (optional)" error={errors.placement}>
                <input value={form.placement} onChange={set('placement')} placeholder="e.g. forearm, back" className="booking-control w-full px-4 py-3.5" />
              </Field>
              <Field label="Approximate Size (optional)" error={errors.size}>
                <input value={form.size} onChange={set('size')} placeholder="e.g. palm-sized" className="booking-control w-full px-4 py-3.5" />
              </Field>
            </div>
          </div>

          <div className="mt-10">
            <button
              type="submit"
              disabled={formState === 'loading'}
              className="w-full bg-[#f5f5f2] text-[#111111] font-body font-600 text-[11px] tracking-[0.2em] uppercase py-4 hover:bg-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {formState === 'loading' ? 'Sending Request...' : 'Continue to WhatsApp →'}
            </button>
            {submissionError && (
              <p role="alert" className="text-[10px] text-red-400 font-body text-center mt-4">
                {submissionError}{' '}
                <a href={WA_HELP_URL} target="_blank" rel="noopener noreferrer" className="underline">Or message us on WhatsApp ↗</a>
              </p>
            )}
            <p className="text-[10px] text-[#858582] font-body text-center mt-4">
              Your information will be kept confidential and used only for booking purposes.
            </p>
            <p className="text-[10px] text-[#858582] font-body text-center leading-relaxed mt-2">
              By submitting this request, you acknowledge our{' '}
              <Link to="/privacy" className="underline underline-offset-2 hover:text-[#f5f5f2] transition-colors">Privacy Policy</Link>{' '}
              and{' '}
              <Link to="/terms" className="underline underline-offset-2 hover:text-[#f5f5f2] transition-colors">Terms of Service</Link>.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="booking-field min-w-0">
      <label className="block text-[10px] tracking-[0.2em] uppercase text-[#858582] font-body mb-1.5">{label}</label>
      {children}
      {error && <p role="alert" className="text-[11px] text-red-400 font-body mt-1">{error}</p>}
    </div>
  );
}
