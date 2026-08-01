"use client";

import { useCallback, useEffect, useRef } from "react";
import { DotLottieReact, type DotLottie } from "@lottiefiles/dotlottie-react";

// Shared by the service cards that use a Lottie animation instead of a
// static <Figure> image — fills the parent <AspectBox> exactly like the
// image it stands in for.
//
// `scale` used to be applied via a CSS transform on the player — but a CSS
// transform enlarges the *already-rasterized* canvas after dotlottie has
// finished rendering it, like stretching a photo, which is what was
// causing the blur (a devicePixelRatio compensation hack was tried first
// and still wasn't reliably sharp — the player only measures its own DOM
// box via ResizeObserver, so a transform on it never factors in). Sizing
// the inner box itself by percentage instead means autoResize measures and
// renders at that exact real box size — the canvas is never stretched
// after the fact, so it stays crisp for both scale > 1 (crops in, via the
// outer overflow:hidden) and scale < 1 (shrinks with no zoom).
export function ServiceLottieVisual({ src, scale = 1 }: { src: string; scale?: number }) {
  // Capped at 2, not 4 — dotlottie rasters its canvas at this resolution on
  // every single frame, so 4x on a high-DPI screen means up to 4x the
  // per-frame cost for a gain that isn't visible at these card sizes.
  const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 2;
  const containerRef = useRef<HTMLDivElement>(null);
  const dotLottieRef = useRef<DotLottie | null>(null);

  const handleDotLottieRef = useCallback((instance: DotLottie | null) => {
    dotLottieRef.current = instance;
  }, []);

  // Three of these run on the homepage at once (Services x2, Trustability
  // x1), all looping forever regardless of scroll position by default —
  // continuous off-screen canvas rastering was the main source of the
  // scroll jank reported near those sections. Pause/resume based on actual
  // viewport visibility instead of leaving every instance running always.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const instance = dotLottieRef.current;
        if (!instance) return;
        if (entry.isIntersecting) instance.play();
        else instance.pause();
      },
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}
      aria-hidden="true"
    >
      <div style={{ width: `${scale * 100}%`, height: `${scale * 100}%`, flexShrink: 0 }}>
        <DotLottieReact
          src={src}
          loop
          autoplay
          dotLottieRefCallback={handleDotLottieRef}
          renderConfig={{ autoResize: true, devicePixelRatio: dpr }}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </div>
  );
}
