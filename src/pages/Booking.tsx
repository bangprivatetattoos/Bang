import { useState, useEffect } from 'react';
import { ARTISTS } from '../data/artists';

type ServiceType = 'studio' | 'home-call';
type FormState = 'idle' | 'loading' | 'success';

interface BookingProps {
  preselectedArtistId?: string | null;
  onNavigate: (page: string, id?: string) => void;
}

const WA_NUMBER = '12125550147';

function generateRef() {
  return 'TAT-' + String(Math.floor(Math.random() * 9000) + 1000);
}

export default function Booking({ preselectedArtistId, onNavigate }: BookingProps) {
  const artist = preselectedArtistId ? ARTISTS.find(a => a.id === preselectedArtistId) : null;
  const [formState, setFormState] = useState<FormState>('idle');
  const [ref, setRef] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType>('studio');
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [k]: e.target.value }));
    setErrors(er => { const n = { ...er }; delete n[k]; return n; });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.email.trim() || !form.email.includes('@')) e.email = 'Valid email required';
    if (!form.whatsapp.trim()) e.whatsapp = 'Required';
    if (!form.idea.trim()) e.idea = 'Tell us a little about your idea';
    if (serviceType === 'home-call' && !form.city.trim()) e.city = 'Required for Home Call';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setFormState('loading');
    await new Promise(r => setTimeout(r, 1800));
    const newRef = generateRef();
    setRef(newRef);
    setFormState('success');
  };

  const openWhatsApp = () => {
    const msg = encodeURIComponent(`Hi, I just submitted tattoo consultation ${ref} through the NOIR Studio website.`);
    window.open(`https://wa.me/${WA_NUMBER}?text=${msg}`, '_blank');
  };

  if (formState === 'success') {
    return (
      <div className="min-h-screen bg-[#111111] flex flex-col items-center justify-center px-5 py-20 text-center" style={{ paddingTop: 'calc(max(80px, env(safe-area-inset-top)) + 40px)' }}>
        <p className="text-[10px] tracking-[0.3em] uppercase text-[#858582] font-body mb-6">Consultation Received</p>
        <h1 className="font-display font-900 text-[18vw] md:text-[10vw] lg:text-[7vw] uppercase leading-none tracking-tight text-[#f5f5f2] mb-6">
          REQUEST<br />RECEIVED.
        </h1>
        <div className="inline-block border border-white/10 px-6 py-3 mb-8">
          <p className="text-[10px] tracking-[0.25em] uppercase text-[#858582] font-body mb-1">Reference</p>
          <p className="font-display font-700 text-2xl tracking-widest text-[#f5f5f2]">{ref}</p>
        </div>
        <p className="font-body text-[#b7b7b2] text-sm max-w-md leading-relaxed mb-10">
          Your consultation request has been saved. Continue with our booking team on WhatsApp to discuss your tattoo, artist availability, scheduling, pricing, placement, and references.
        </p>
        <button
          onClick={openWhatsApp}
          className="bg-[#f5f5f2] text-[#111111] font-body font-600 text-[11px] tracking-[0.2em] uppercase px-8 py-4 hover:bg-white transition-colors mb-4"
        >
          Continue to WhatsApp →
        </button>
        <button
          onClick={() => onNavigate('home')}
          className="text-[11px] tracking-[0.15em] uppercase font-body text-[#858582] hover:text-[#f5f5f2] transition-colors"
        >
          Back to Studio
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111111]" style={{ paddingTop: 'calc(max(80px, env(safe-area-inset-top)) + 40px)' }}>
      <div className="max-w-[680px] mx-auto px-5 md:px-8 pb-24">

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

        <form onSubmit={handleSubmit} noValidate>
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
              <input value={form.name} onChange={set('name')} placeholder="Your full name" className="w-full px-4 py-3.5 text-sm" />
            </Field>
            <Field label="Email" error={errors.email}>
              <input type="email" value={form.email} onChange={set('email')} placeholder="your@email.com" className="w-full px-4 py-3.5 text-sm" />
            </Field>
            <Field label="WhatsApp / Phone" error={errors.whatsapp}>
              <input type="tel" value={form.whatsapp} onChange={set('whatsapp')} placeholder="+1 (555) 000-0000" className="w-full px-4 py-3.5 text-sm" />
            </Field>

            {serviceType === 'home-call' && (
              <Field label="City / Location" error={errors.city}>
                <input value={form.city} onChange={set('city')} placeholder="City, State" className="w-full px-4 py-3.5 text-sm" />
              </Field>
            )}

            {!artist && (
              <Field label="Preferred Artist (optional)">
                <select value={form.artistId} onChange={set('artistId')} className="w-full px-4 py-3.5 text-sm cursor-pointer">
                  <option value="">No preference / Help me choose</option>
                  {ARTISTS.map(a => (
                    <option key={a.id} value={a.id}>{a.name} — {a.specialties[0]}</option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="Tell Us About Your Tattoo Idea" error={errors.idea}>
              <textarea value={form.idea} onChange={set('idea')} placeholder="Describe the concept, style, references, or anything that helps us understand your vision..." rows={5} className="w-full px-4 py-3.5 text-sm resize-none" />
            </Field>

            <div className="grid grid-cols-2 gap-5">
              <Field label="Placement (optional)">
                <input value={form.placement} onChange={set('placement')} placeholder="e.g. forearm, back" className="w-full px-4 py-3.5 text-sm" />
              </Field>
              <Field label="Approximate Size (optional)">
                <input value={form.size} onChange={set('size')} placeholder="e.g. palm-sized" className="w-full px-4 py-3.5 text-sm" />
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
            <p className="text-[10px] text-[#858582] font-body text-center mt-4">
              Your information will be kept confidential and used only for booking purposes.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] tracking-[0.2em] uppercase text-[#858582] font-body mb-1.5">{label}</label>
      {children}
      {error && <p className="text-[11px] text-red-400 font-body mt-1">{error}</p>}
    </div>
  );
}
