import { useMemo, useRef, useState, type ReactNode } from 'react';
import { ARTISTS, type Artist } from '../../data/artists';
import { whatsappUrl } from '../../data/siteContact';
import { trackAnalytics } from '../../analytics/client';
import { trackMetaLead } from '../../analytics/metaPixel';
import Sheet from '../video-feed/ui/Sheet';
import { ArrowRightIcon, CheckIcon, LocationIcon, WhatsAppIcon } from '../video-feed/ui/icons';
import {
  BOOKING_ARTIST_CHOICES, CONSULTATION_POINTS, LOCATIONS, PRICE_RANGES,
  PRICING_DISCLAIMER, TATTOO_TYPES,
} from './bookingOptions';
import {
  CallIcon, ChatIcon, PaymentIcon, ScheduleIcon, StudioIcon,
  TATTOO_TYPE_ICONS, type TattooTypeIconId,
} from './tattooIcons';
import { recordBookingIntent } from '../video-feed/data/feedApi';
import LocationAutocomplete from './LocationAutocomplete';
import type { UsState } from './usStates';

export interface BookingFlowOptions {
  /**
   * A deliberate choice — the visitor opened this from that artist's gallery,
   * so the artist carries through and is not silently swapped for another.
   */
  preselectedArtistId?: string | null;
  /** A softer hint, such as the artist attributed to the clip on screen. */
  preferredArtistId?: string | null;
  /** Where the journey began, recorded on the analytics events. */
  source: string;
  /** The clip the journey started from, carried for caller context. */
  contentId?: string | null;
}

interface Props extends BookingFlowOptions {
  onClose: () => void;
}

/**
 * Everything the visitor has chosen.
 *
 * One object, held for the lifetime of the sheet. Step four renders straight
 * from it, so moving back and forward never loses a selection and nothing is
 * ever reconstructed by reading the UI back.
 */
interface BookingSelection {
  locationId: string | null;
  usState: UsState | null;
  city: string;
  artistId: string | null;
  tattooTypeId: TattooTypeIconId | null;
  priceRangeId: string | null;
}

const EMPTY: BookingSelection = {
  locationId: null, usState: null, city: '', artistId: null, tattooTypeId: null, priceRangeId: null,
};

const STEP_LABELS = ['Location', 'Artist', 'Tattoo & Price', 'Review'] as const;

const CONSULTATION_ICONS = {
  chat: ChatIcon, call: CallIcon, studio: StudioIcon, payment: PaymentIcon, schedule: ScheduleIcon,
} as const;

function newSubmissionId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // crypto.randomUUID is unavailable outside secure contexts (a LAN IP over http).
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Picks the artists offered at step two: real artists only, chosen once per
 * journey so the list cannot reshuffle between renders.
 */
function selectArtists(anchorArtistId: string | null | undefined): Artist[] {
  const { min, max } = BOOKING_ARTIST_CHOICES;
  if (ARTISTS.length <= min) return ARTISTS.slice(0, max);
  const anchor = anchorArtistId ? ARTISTS.find(artist => artist.id === anchorArtistId) : undefined;
  const pool = ARTISTS.filter(artist => artist.id !== anchor?.id);
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return (anchor ? [anchor, ...pool] : pool).slice(0, Math.min(max, ARTISTS.length));
}

/** One selection treatment, shared by the location, type and price cards. */
function selectionStyle(selected: boolean) {
  return {
    background: selected ? 'rgba(244,243,239,0.07)' : 'rgba(8,8,8,0.35)',
    border: `1px solid ${selected ? 'rgba(244,243,239,0.72)' : '#3a3a3a'}`,
    boxShadow: selected ? '0 0 0 1px rgba(244,243,239,0.18), 0 6px 22px rgba(0,0,0,0.35)' : 'none',
  };
}

/**
 * Card surface shared by the location and artist cards.
 *
 * The same treatment the tattoo-type and price cards use, so all four steps
 * read as one system: transparent dark when unselected, an off-white border
 * and a lifted surface when chosen.
 */
function cardStyle(selected: boolean) {
  return {
    background: selected ? '#1a1a1a' : 'rgba(18,18,18,0.55)',
    border: `1px solid ${selected ? '#f4f3ef' : '#383838'}`,
    boxShadow: selected ? '0 0 0 1px rgba(244,243,239,0.16), 0 8px 26px rgba(0,0,0,0.40)' : 'none',
  };
}

/** The filled selection control used by both steps. */
function SelectionDot({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`w-[22px] h-[22px] rounded-full flex-shrink-0 grid place-items-center transition-all ${selected ? 'bg-[#f4f3ef]' : ''}`}
      style={{ border: `2px solid ${selected ? '#f4f3ef' : '#575757'}` }}
    >
      {selected && <span className="w-[9px] h-[9px] rounded-full bg-[#101010]" />}
    </span>
  );
}

/** Step label, large title and supporting copy, at one consistent rhythm. */
function StepHeading({ title, copy }: { title: ReactNode; copy: string }) {
  return (
    <>
      <h2 className="display-font text-[30px] md:text-[34px] font-black text-[#f4f3ef] uppercase leading-[0.92] tracking-wide mb-2">
        {title}
      </h2>
      <p className="text-[#858585] text-[13.5px] leading-relaxed mb-6 max-w-md">{copy}</p>
    </>
  );
}

/**
 * The artist's status line.
 *
 * No availability data exists in this project, so nothing claims a diary is
 * open unless someone has set `availableThisWeek` on that artist. Everyone
 * else shows the statement that is true of the whole active roster: they are
 * taking bookings. Nothing here is generated.
 */
function AvailabilityLine({ artist }: { artist: Artist }) {
  const confirmed = artist.availableThisWeek === true;
  return (
    <span className="flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: confirmed ? '#5fcb72' : '#575757' }}
      />
      <span className="text-[11.5px]" style={{ color: confirmed ? '#5fcb72' : '#858585' }}>
        {confirmed ? 'Available this week' : 'Accepting bookings'}
      </span>
    </span>
  );
}

/**
 * A premium mini artist profile.
 *
 * The whole card selects; "View work" expands a strip of that artist's real
 * gallery inside the sheet rather than navigating away, so booking state is
 * never lost to a detour.
 *
 * The slot the prototype gives a star rating holds the artist's real role
 * instead. No rating or review data exists anywhere in this project, and a
 * fabricated 4.9 would be a claim about customers who never left one.
 */
function ArtistCard({ artist, selected, onSelect, showSelectedLabel }: {
  artist: Artist;
  selected: boolean;
  onSelect: () => void;
  showSelectedLabel?: boolean;
}) {
  const [showWork, setShowWork] = useState(false);
  const preview = artist.gallery.slice(0, 4);

  return (
    <div className="rounded-2xl overflow-hidden transition-all" style={cardStyle(selected)}>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="feed-focusable w-full flex items-start gap-3.5 p-4 text-left"
      >
        <img
          src={artist.portrait}
          alt=""
          loading="lazy"
          className="w-[72px] h-[72px] md:w-20 md:h-20 rounded-xl object-cover object-top bg-[#383838] flex-shrink-0"
        />
        <span className="flex-1 min-w-0">
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0">
              <span className="display-font block text-[19px] md:text-[20px] font-bold text-[#f4f3ef] uppercase tracking-wide leading-tight truncate">
                {artist.name}
              </span>
              <span className="block text-[#858585] text-[11px] uppercase tracking-[0.16em] mt-0.5">{artist.role}</span>
            </span>
            {showSelectedLabel && selected ? (
              <span className="text-[8.5px] uppercase tracking-[0.18em] px-2 py-1 rounded bg-[#f4f3ef] text-[#101010] font-bold flex-shrink-0">
                Selected
              </span>
            ) : (
              <SelectionDot selected={selected} />
            )}
          </span>

          <span className="flex flex-wrap gap-1.5 mt-2.5">
            {artist.specialties.slice(0, 3).map(specialty => (
              <span
                key={specialty}
                className="text-[9.5px] uppercase tracking-[0.12em] px-2 py-1 rounded text-[#b5b5b2]"
                style={{ border: '1px solid #2e2e2e', background: 'rgba(255,255,255,0.02)' }}
              >
                {specialty}
              </span>
            ))}
          </span>

          <span className="block mt-2.5"><AvailabilityLine artist={artist} /></span>
        </span>
      </button>

      {preview.length > 0 && (
        <div className="px-4 pb-3 -mt-1">
          <button
            type="button"
            onClick={() => setShowWork(open => !open)}
            aria-expanded={showWork}
            className="feed-focusable text-[10px] uppercase tracking-[0.18em] text-[#858585] hover:text-[#f4f3ef] transition-colors py-2 min-h-11 flex items-center gap-1.5"
          >
            {showWork ? 'Hide work' : 'View work'} <ArrowRightIcon />
          </button>
          {showWork && (
            <div className="feed-scroll flex gap-2 overflow-x-auto pb-1 animate-feed-fade-in-up">
              {preview.map(image => (
                <img
                  key={image.url}
                  src={image.url}
                  alt={image.alt}
                  loading="lazy"
                  className="w-[72px] h-[92px] rounded-lg object-cover flex-shrink-0 bg-[#161616]"
                  style={{ border: '1px solid #2a2a2a' }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** One labelled cell in the step-four summary. */
function SummaryTile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[#626262] text-[9px] uppercase tracking-[0.26em] mb-1.5">{label}</p>
      {children}
    </div>
  );
}

export default function BookingFlowSheet({
  onClose, preselectedArtistId, preferredArtistId, source,
}: Props) {
  const preselectedArtist = useMemo(
    () => (preselectedArtistId ? ARTISTS.find(artist => artist.id === preselectedArtistId) ?? null : null),
    [preselectedArtistId],
  );

  const [step, setStep] = useState(1);
  const [selection, setSelection] = useState<BookingSelection>({
    ...EMPTY,
    artistId: preselectedArtist?.id ?? null,
  });
  const [changingArtist, setChangingArtist] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [handedOff, setHandedOff] = useState(false);

  const artists = useMemo(
    () => selectArtists(preselectedArtist?.id ?? preferredArtistId),
    [preselectedArtist, preferredArtistId],
  );
  const submissionId = useRef(newSubmissionId());
  const recorded = useRef(false);

  const set = <K extends keyof BookingSelection>(key: K, value: BookingSelection[K]) =>
    setSelection(current => ({ ...current, [key]: value }));

  const location = LOCATIONS.find(item => item.id === selection.locationId) ?? null;
  const artist = ARTISTS.find(item => item.id === selection.artistId) ?? null;
  const tattooType = TATTOO_TYPES.find(item => item.id === selection.tattooTypeId) ?? null;
  const priceRange = PRICE_RANGES.find(item => item.id === selection.priceRangeId) ?? null;

  const needsState = Boolean(location?.needsState);
  const resolvedLocation = needsState
    ? (selection.usState ? [selection.city.trim(), selection.usState.name].filter(Boolean).join(', ') : '')
    : location?.label ?? '';

  // Step one stays enabled once an option is picked even when the state is
  // still missing, so Continue can explain what is needed rather than sitting
  // inert for someone who typed a city that is not in the U.S.
  const canContinue = [
    Boolean(location),
    Boolean(selection.artistId),
    Boolean(selection.tattooTypeId && selection.priceRangeId),
    true,
  ][step - 1];

  const whatsappMessage = [
    'Hi BANG PRIVATE TATTOOS,',
    '',
    "I'd like to continue with my tattoo booking.",
    '',
    `Artist: ${artist?.name ?? ''}`,
    `Location: ${resolvedLocation}`,
    `Tattoo type: ${tattooType?.label ?? ''}`,
    `Price range: ${priceRange?.label ?? ''}`,
    '',
    "I'd like to discuss the consultation and available appointment times.",
  ].join('\n');

  const goToStep = (next: number) => {
    if (next === 2 && needsState && !selection.usState) {
      setLocationError('Please select a U.S. state.');
      return;
    }
    setLocationError('');
    setStep(next);
    if (next === 2) trackAnalytics('location_selected', { entityType: 'location', entityId: location?.id, metadata: { surface: source } });
    if (next === 3) {
      trackAnalytics('artist_selected', {
        entityType: 'artist', entityId: artist?.id,
        metadata: { ...(artist ? { artist_name: artist.name } : {}), surface: source },
      });
      trackAnalytics('artist_booking_selected', {
        entityType: 'artist', entityId: artist?.id,
        metadata: { ...(artist ? { artist_name: artist.name } : {}), surface: source },
      });
    }
    if (next === 4) {
      if (tattooType) trackAnalytics('tattoo_type_selected', { entityType: 'tattoo_type', entityId: tattooType.id, metadata: { tattoo_type: tattooType.label } });
      if (priceRange) trackAnalytics('price_range_selected', { entityType: 'price_range', entityId: priceRange.id, metadata: { price_range: priceRange.label } });
      trackAnalytics('consultation_acknowledgement_viewed', { entityType: 'booking', entityId: artist?.id ?? 'no-artist', metadata: { surface: source } });
    }
  };

  /**
   * Fires on the real click that opens WhatsApp. The link is a plain anchor so
   * the new tab is opened by the browser during the gesture and cannot be
   * blocked; the recording runs alongside it.
   */
  const handleContinue = () => {
    setHandedOff(true);
    if (recorded.current) return;
    recorded.current = true;

    trackAnalytics('whatsapp_continue', {
      entityType: 'booking_intent',
      entityId: artist?.id ?? 'no-artist',
      metadata: {
        ...(artist ? { artist_name: artist.name } : {}),
        ...(tattooType ? { tattoo_type: tattooType.label } : {}),
        ...(priceRange ? { price_range: priceRange.label } : {}),
        surface: source,
      },
    });
    trackAnalytics('whatsapp_handoff', { entityType: 'booking_intent', entityId: artist?.id ?? 'no-artist' });
    if (artist) {
      trackAnalytics('artist_whatsapp_continue', {
        entityType: 'artist', entityId: artist.id,
        metadata: { artist_name: artist.name, surface: source },
      });
    }

    void recordBookingIntent({
      submissionId: submissionId.current,
      location: resolvedLocation,
      artistId: artist?.id ?? null,
      artistName: artist?.name ?? null,
      tattooType: tattooType?.label ?? '',
      priceRange: priceRange?.label ?? '',
    }).then(result => {
      if (result) trackMetaLead(result.metaEventId);
    });
  };

  const TypeIcon = tattooType ? TATTOO_TYPE_ICONS[tattooType.id] : null;

  return (
    <Sheet onClose={onClose} label="Book an appointment" size="wide">
      {/* Progress */}
      <div className="px-5 md:px-7 pt-4 pb-0 flex-shrink-0">
        <ol className="flex items-center mb-3.5" aria-label={`Step ${step} of 4`}>
          {STEP_LABELS.map((label, index) => {
            const done = index + 1 < step;
            const current = index + 1 === step;
            return (
              <li key={label} className="flex items-center flex-1 min-w-0 last:flex-none">
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 transition-all ${done || current ? 'bg-[#f4f3ef] text-[#101010]' : 'text-[#575757]'}`}
                  style={{
                    border: done || current ? '1.5px solid #f4f3ef' : '1.5px solid #383838',
                    boxShadow: current ? '0 0 0 4px rgba(244,243,239,0.10)' : 'none',
                  }}
                  aria-current={current ? 'step' : undefined}
                >
                  {done ? <CheckIcon /> : index + 1}
                </span>
                {index < STEP_LABELS.length - 1 && (
                  <span aria-hidden="true" className={`flex-1 h-[1.5px] mx-1.5 rounded-full transition-all ${done ? 'bg-[#f4f3ef]' : 'bg-[#2a2a2a]'}`} />
                )}
              </li>
            );
          })}
        </ol>
        <p className="text-[#626262] text-[10px] uppercase tracking-[0.26em] mb-4">
          Step {step} of 4 — {STEP_LABELS[step - 1]}
        </p>
      </div>

      <div className="feed-scroll flex-1 overflow-y-auto px-5 md:px-7 pb-2">
        {/* ── Step 1 — Location ───────────────────────────────────────── */}
        {step === 1 && (
          <>
            <StepHeading title={<>Select your<br />location</>} copy="Choose your location so we can continue with your booking request." />

            <div className="space-y-2.5 md:grid md:grid-cols-2 md:gap-2.5 md:space-y-0 lg:grid-cols-3">
              {LOCATIONS.map(option => {
                const selected = selection.locationId === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => { set('locationId', option.id); setLocationError(''); }}
                    aria-pressed={selected}
                    className="feed-focusable w-full flex items-center gap-3 px-4 py-4 min-h-[72px] rounded-2xl transition-all text-left"
                    style={cardStyle(selected)}
                  >
                    <span
                      className="w-10 h-10 rounded-full grid place-items-center flex-shrink-0 transition-colors"
                      style={{
                        background: selected ? 'rgba(244,243,239,0.12)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${selected ? 'rgba(244,243,239,0.4)' : '#2e2e2e'}`,
                        color: selected ? '#f4f3ef' : '#858585',
                      }}
                    >
                      <LocationIcon />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className={`block text-[15px] font-medium leading-tight ${selected ? 'text-[#f4f3ef]' : 'text-[#b5b5b2]'}`}>
                        {option.label}
                      </span>
                      {option.detail && <span className="block text-[11.5px] text-[#626262] mt-0.5">{option.detail}</span>}
                    </span>
                    <SelectionDot selected={selected} />
                  </button>
                );
              })}
            </div>

            {needsState && (
              <div
                className="mt-4 p-4 rounded-2xl animate-feed-fade-in-up"
                style={{ background: 'rgba(244,243,239,0.03)', border: '1px solid rgba(244,243,239,0.10)' }}
              >
                <LocationAutocomplete
                  value={selection.usState}
                  onChange={state => { set('usState', state); if (state) setLocationError(''); }}
                  city={selection.city}
                  onCityChange={value => set('city', value)}
                  error={locationError}
                />
              </div>
            )}

            <p className="text-[#575757] text-[11px] leading-relaxed mt-5">
              Studio appointments are in New York. Home Call requests are accepted across the United States, subject to
              artist availability and location requirements.
            </p>
          </>
        )}

        {/* ── Step 2 — Artist ─────────────────────────────────────────── */}
        {step === 2 && (
          <>
            <StepHeading
              title={<>Choose your<br />artist</>}
              copy={preselectedArtist && !changingArtist
                ? `You came from ${preselectedArtist.name}'s gallery, so they are already selected.`
                : 'Choose an artist for your request.'}
            />

            {preselectedArtist && !changingArtist ? (
              <>
                <p className="text-[#626262] text-[9px] uppercase tracking-[0.26em] mb-2.5">Selected artist</p>
                <ArtistCard artist={preselectedArtist} selected onSelect={() => {}} showSelectedLabel />
                <button
                  type="button"
                  onClick={() => {
                    trackAnalytics('artist_changed_during_booking', {
                      entityType: 'artist', entityId: preselectedArtist.id,
                      metadata: { artist_name: preselectedArtist.name, surface: source },
                    });
                    setChangingArtist(true);
                  }}
                  className="feed-focusable w-full mt-3 py-3.5 min-h-11 rounded-xl text-[#b5b5b2] text-[12px] uppercase tracking-wider hover:text-[#f4f3ef] transition-colors"
                  style={{ border: '1px solid rgba(255,255,255,0.18)' }}
                >
                  Change artist
                </button>
              </>
            ) : (
              <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 lg:grid-cols-3">
                {artists.map(option => (
                  <ArtistCard
                    key={option.id}
                    artist={option}
                    selected={selection.artistId === option.id}
                    onSelect={() => set('artistId', option.id)}
                  />
                ))}
              </div>
            )}

            <p className="text-[#575757] text-[11px] leading-relaxed mt-5">
              Final availability and scheduling will be confirmed with you during your WhatsApp consultation.
            </p>
          </>
        )}


        {/* ── Step 3 — Tattoo type & price ────────────────────────────── */}
        {step === 3 && (
          <>
            <h2 className="display-font text-[28px] md:text-[32px] font-black text-[#f4f3ef] uppercase leading-none tracking-wide mb-1">
              Tattoo type &<br />price range
            </h2>
            <p className="text-[#858585] text-[13px] mb-5">Choose the closest match for your tattoo request.</p>

            <p className="text-[#626262] text-[9px] uppercase tracking-[0.26em] mb-2.5">Tattoo type</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-6">
              {TATTOO_TYPES.map(type => {
                const selected = selection.tattooTypeId === type.id;
                const Icon = TATTOO_TYPE_ICONS[type.id];
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => set('tattooTypeId', type.id)}
                    aria-pressed={selected}
                    className="feed-focusable relative flex flex-col items-start gap-2.5 px-3.5 py-3.5 min-h-[84px] rounded-xl transition-all text-left"
                    style={selectionStyle(selected)}
                  >
                    <span className={selected ? 'text-[#f4f3ef]' : 'text-[#858585]'}><Icon size={22} /></span>
                    <span className={`text-[12.5px] leading-tight ${selected ? 'text-[#f4f3ef] font-semibold' : 'text-[#b5b5b2]'}`}>
                      {type.label}
                    </span>
                    {selected && (
                      <span className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full grid place-items-center bg-[#f4f3ef] text-[#101010]">
                        <CheckIcon />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <p className="text-[#626262] text-[9px] uppercase tracking-[0.26em] mb-2.5">Price range</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {PRICE_RANGES.map(range => {
                const selected = selection.priceRangeId === range.id;
                return (
                  <button
                    key={range.id}
                    type="button"
                    onClick={() => set('priceRangeId', range.id)}
                    aria-pressed={selected}
                    className="feed-focusable relative flex items-center justify-center px-3 py-4 min-h-11 rounded-xl transition-all"
                    style={selectionStyle(selected)}
                  >
                    <span className={`text-[14px] tabular-nums ${selected ? 'text-[#f4f3ef] font-semibold' : 'text-[#b5b5b2]'}`}>
                      {range.label}
                    </span>
                    {selected && (
                      <span className="absolute top-2 right-2 w-4 h-4 rounded-full grid place-items-center bg-[#f4f3ef] text-[#101010]">
                        <CheckIcon />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-[#575757] text-[10px] mt-3 leading-relaxed">{PRICING_DISCLAIMER}</p>
          </>
        )}

        {/* ── Step 4 — Consultation acknowledgement ───────────────────── */}
        {step === 4 && !handedOff && (
          <>
            <h2 className="display-font text-[26px] md:text-[30px] font-black text-[#f4f3ef] uppercase leading-[0.95] tracking-wide mb-1">
              Consultation<br />acknowledgement
            </h2>
            <p className="text-[#858585] text-[13px] mb-4">Review your selections and continue to WhatsApp.</p>

            {/* Summary — rendered straight from the selection state. */}
            <div
              className="rounded-2xl p-4 md:p-5 mb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
              style={{ background: 'rgba(244,243,239,0.04)', border: '1px solid rgba(244,243,239,0.12)' }}
            >
              <SummaryTile label="Location">
                <span className="flex items-start gap-2">
                  <span className="text-[#b5b5b2] mt-0.5 flex-shrink-0"><LocationIcon /></span>
                  <span className="min-w-0">
                    <span className="block text-[#f4f3ef] text-[14px] font-medium leading-tight">
                      {selection.usState ? selection.usState.name : location?.label ?? '—'}
                    </span>
                    {selection.usState && selection.city.trim() && (
                      <span className="block text-[#858585] text-[12px]">{selection.city.trim()}</span>
                    )}
                  </span>
                </span>
              </SummaryTile>

              <SummaryTile label="Artist">
                {artist ? (
                  <span className="flex items-center gap-2.5 min-w-0">
                    <img src={artist.portrait} alt="" loading="lazy" className="w-9 h-9 rounded-full object-cover object-top bg-[#383838] flex-shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-[#f4f3ef] text-[14px] font-medium truncate leading-tight">{artist.name}</span>
                      <span className="block text-[#858585] text-[11px] truncate">{artist.specialties.slice(0, 2).join(' • ')}</span>
                    </span>
                  </span>
                ) : <span className="text-[#626262] text-[14px]">—</span>}
              </SummaryTile>

              <SummaryTile label="Tattoo type">
                <span className="flex items-center gap-2 min-w-0">
                  {TypeIcon && <span className="text-[#b5b5b2] flex-shrink-0"><TypeIcon size={20} /></span>}
                  <span className="text-[#f4f3ef] text-[14px] font-medium truncate">{tattooType?.label ?? '—'}</span>
                </span>
              </SummaryTile>

              <SummaryTile label="Price range">
                <span className="text-[#f4f3ef] text-[15px] font-semibold tabular-nums">{priceRange?.label ?? '—'}</span>
              </SummaryTile>
            </div>

            {/* The acknowledgement, as five short commitments rather than a wall. */}
            <p className="text-[#626262] text-[9px] uppercase tracking-[0.26em] mb-2.5">What happens next</p>
            <ul className="space-y-3 mb-2">
              {CONSULTATION_POINTS.map(point => {
                const Icon = CONSULTATION_ICONS[point.icon];
                return (
                  <li key={point.title} className="flex items-start gap-3">
                    <span
                      className="w-9 h-9 rounded-full grid place-items-center flex-shrink-0 text-[#b5b5b2]"
                      style={{ background: 'rgba(8,8,8,0.45)', border: '1px solid #2e2e2e' }}
                      aria-hidden="true"
                    >
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[#f4f3ef] text-[12px] font-semibold uppercase tracking-wider">{point.title}</span>
                      <span className="block text-[#b5b5b2] text-[12.5px] leading-relaxed mt-0.5">{point.body}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {handedOff && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-[#161616] flex items-center justify-center mb-5 text-[#f4f3ef]" style={{ border: '1px solid #383838' }}>
              <WhatsAppIcon size={28} />
            </div>
            <p className="display-font text-[24px] font-bold text-[#f4f3ef] uppercase tracking-wide mb-2">Message prepared</p>
            <p className="text-[#858585] text-[13px] leading-relaxed max-w-xs">
              Your WhatsApp conversation has been opened with your booking details. Our team will confirm availability with you shortly.
            </p>
          </div>
        )}
      </div>

      {/* Actions — always reachable, clear of the home indicator. */}
      <div
        className="px-5 md:px-7 pt-3 flex-shrink-0 space-y-2"
        style={{ paddingBottom: 'max(20px, calc(env(safe-area-inset-bottom) + 10px))' }}
      >
        {!handedOff && step < 4 && (
          <button
            type="button"
            onClick={() => goToStep(step + 1)}
            disabled={!canContinue}
            className="feed-focusable w-full flex items-center justify-center gap-2 py-4 min-h-11 rounded-xl bg-[#f4f3ef] text-[#101010] text-[13px] font-semibold uppercase tracking-wider transition-opacity disabled:opacity-25 disabled:cursor-not-allowed"
          >
            Continue <ArrowRightIcon />
          </button>
        )}

        {!handedOff && step === 4 && (
          <a
            href={whatsappUrl(whatsappMessage)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleContinue}
            className="feed-focusable w-full flex items-center justify-center gap-2.5 py-4 min-h-11 rounded-xl bg-[#f4f3ef] text-[#101010] text-[13px] font-semibold uppercase tracking-wider"
          >
            <WhatsAppIcon size={17} /> Continue to WhatsApp <ArrowRightIcon />
          </a>
        )}

        {handedOff && (
          <button
            type="button"
            onClick={onClose}
            className="feed-focusable w-full py-3.5 min-h-11 rounded-xl text-[#b5b5b2] text-[13px] uppercase tracking-wider"
            style={{ border: '1px solid rgba(255,255,255,0.14)' }}
          >
            Close
          </button>
        )}

        {/* Step one dismisses the sheet; later steps walk back through it,
            never through browser history. */}
        {!handedOff && (
          <button
            type="button"
            onClick={() => (step === 1 ? onClose() : setStep(step - 1))}
            className="feed-focusable w-full py-2.5 min-h-11 text-[#858585] text-[12px] uppercase tracking-wider text-center hover:text-[#b5b5b2] transition-colors"
          >
            {step === 1 ? 'Close' : '← Back'}
          </button>
        )}
      </div>
    </Sheet>
  );
}
