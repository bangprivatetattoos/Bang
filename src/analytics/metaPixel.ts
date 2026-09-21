type Fbq = ((...arguments_: unknown[]) => void) & {
  callMethod?: (...arguments_: unknown[]) => void;
  loaded?: boolean;
  push?: Fbq;
  queue?: unknown[][];
  version?: string;
};

declare global {
  interface Window {
    _fbq?: Fbq;
    fbq?: Fbq;
    __bptMetaPixelId?: string;
  }
}

const pixelId = import.meta.env.VITE_META_PIXEL_ID?.trim();
const sentLeadEventIds = new Set<string>();

function validPixelId(value: string | undefined): value is string {
  return Boolean(value && /^\d+$/.test(value));
}

function getFbq(): Fbq | null {
  if (typeof window === "undefined" || !validPixelId(pixelId)) return null;

  let fbq = window.fbq;
  if (!fbq) {
    fbq = function (...arguments_: unknown[]) {
      if (fbq?.callMethod) fbq.callMethod(...arguments_);
      else fbq?.queue?.push(arguments_);
    } as Fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    window.fbq = fbq;
    window._fbq = fbq;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    script.dataset.bptMetaPixel = "true";
    document.head.appendChild(script);
  }

  // The app is mounted in React Strict Mode during development. This marker
  // also protects against HMR or another app mount initializing the same Pixel.
  if (!window.__bptMetaPixelId) {
    fbq("init", pixelId);
    window.__bptMetaPixelId = pixelId;
  }

  return fbq;
}

export function trackMetaPageView() {
  const fbq = getFbq();
  if (fbq) fbq("track", "PageView");
}

export function trackMetaLead(eventId: string) {
  if (!/^bpt_lead_BP[TI]-\d{2}-\d{6,}$/.test(eventId) || sentLeadEventIds.has(eventId)) return;
  const fbq = getFbq();
  if (!fbq) return;

  // Keep browser parameters intentionally empty: neither form contents nor
  // customer contact details belong in a browser-side Pixel event.
  fbq("track", "Lead", {}, { eventID: eventId });
  sentLeadEventIds.add(eventId);
}
