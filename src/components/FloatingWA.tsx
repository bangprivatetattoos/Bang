import { useState, type ReactNode } from 'react';
import { whatsappUrl } from '../data/siteContact';
import { trackAnalytics } from '../analytics/client';

interface Props {
  hidden?: boolean;
  /**
   * When provided, the button asks what the visitor needs instead of dropping
   * them straight into a generic WhatsApp chat. Used inside artist galleries,
   * where the context of whose work they are looking at would otherwise be
   * thrown away.
   */
  onAssist?: () => void;
  /** Accessible name, so the gallery variant does not claim to open WhatsApp. */
  label?: string;
}

const WhatsAppGlyph = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" fill="#25d366" />
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.554 4.122 1.524 5.859L.057 23.272a.5.5 0 00.67.625l5.571-1.845A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.823 9.823 0 01-5.016-1.377l-.36-.213-3.726 1.235 1.251-3.628-.234-.373A9.818 9.818 0 012.182 12C2.182 6.567 6.567 2.182 12 2.182S21.818 6.567 21.818 12 17.433 21.818 12 21.818z" fill="#25d366" opacity="0.3" />
  </svg>
);

export default function FloatingWA({ hidden, onAssist, label }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const href = whatsappUrl('Hi, I have a question about BANG PRIVATE TATTOOS.');

  if (hidden) return null;

  const interaction = {
    onMouseEnter: () => { setIsHovered(true); setExpanded(true); },
    onMouseLeave: () => { setIsHovered(false); setExpanded(false); },
    onFocus: () => { setIsFocused(true); setExpanded(true); },
    onBlur: () => { setIsFocused(false); setExpanded(false); },
    onPointerDown: () => setIsPressed(true),
    onPointerUp: () => setIsPressed(false),
    onPointerCancel: () => setIsPressed(false),
    'aria-label': label ?? 'Chat with BANG PRIVATE TATTOOS on WhatsApp',
    className: 'floating-wa-button relative flex items-center gap-2.5 bg-[#171717] border border-white/10 hover:border-white/25 transition-all duration-300 rounded-full shadow-lg shadow-black/60 h-11',
    style: { paddingLeft: '10px', paddingRight: expanded ? '16px' : '10px', width: expanded ? 'auto' : '44px' },
  };

  const inner: ReactNode = (
    <>
      <WhatsAppGlyph />
      <span
        className="text-[11px] tracking-[0.15em] uppercase font-body font-500 text-[#f5f5f2] whitespace-nowrap overflow-hidden transition-all duration-300"
        style={{ maxWidth: expanded ? '140px' : '0', opacity: expanded ? 1 : 0 }}
      >
        {onAssist ? 'How can we help?' : 'Chat with us'}
      </span>
    </>
  );

  return (
    <div
      className={`floating-wa fixed z-[150] ${isHovered || isFocused || isPressed ? 'floating-wa--interacting' : ''}`}
      style={{
        bottom: 'max(18px, calc(env(safe-area-inset-bottom) + 12px))',
        left: 'max(16px, calc(env(safe-area-inset-left) + 12px))',
      }}
    >
      {onAssist ? (
        <button
          type="button"
          onClick={() => { trackAnalytics('whatsapp_click', { entityType: 'whatsapp', metadata: { surface: 'artist_gallery' } }); onAssist(); }}
          {...interaction}
        >
          {inner}
        </button>
      ) : (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackAnalytics('whatsapp_click', { entityType: 'whatsapp' })}
          {...interaction}
        >
          {inner}
        </a>
      )}
    </div>
  );
}
