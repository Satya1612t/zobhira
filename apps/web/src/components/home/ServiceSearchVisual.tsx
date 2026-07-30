"use client";

import { DotLottieReact } from "@lottiefiles/dotlottie-react";

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
  const dpr = typeof window !== "undefined" ? Math.min(4, window.devicePixelRatio || 1) : 2;
  return (
    <div
      style={{ position: "absolute", inset: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}
      aria-hidden="true"
    >
      <div style={{ width: `${scale * 100}%`, height: `${scale * 100}%`, flexShrink: 0 }}>
        <DotLottieReact
          src={src}
          loop
          autoplay
          renderConfig={{ autoResize: true, devicePixelRatio: dpr }}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </div>
  );
}
