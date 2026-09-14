import { useEffect, useState } from "react";

const SHOW_AFTER_SCROLL_Y = 800;

export default function BackToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let frameId = 0;

    const updateVisibility = () => {
      frameId = 0;
      const shouldShow = window.scrollY >= SHOW_AFTER_SCROLL_Y;
      setIsVisible(previous => previous === shouldShow ? previous : shouldShow);
    };

    const onScroll = () => {
      if (!frameId) frameId = window.requestAnimationFrame(updateVisibility);
    };

    updateVisibility();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, []);

  const scrollToTop = () => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  };

  return (
    <div
      className={`fixed z-[80] transition-all duration-300 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0 pointer-events-none"}`}
      style={{
        bottom: "max(18px, calc(env(safe-area-inset-bottom) + 12px))",
        right: "max(16px, calc(env(safe-area-inset-right) + 12px))",
      }}
    >
      <button
        type="button"
        onClick={scrollToTop}
        aria-label="Back to top"
        className="group flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[#171717] text-[#f5f5f2] shadow-lg shadow-black/60 transition-all duration-300 hover:scale-105 hover:border-white/30 hover:bg-[#1c1c1c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f5f5f2]"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 19V5M6.5 10.5 12 5l5.5 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="sr-only">Back to top</span>
      </button>
    </div>
  );
}
