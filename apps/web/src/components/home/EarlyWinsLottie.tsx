"use client";

import { ServiceLottieVisual } from "@/components/home/ServiceSearchVisual";

// Replaces the static applications-bar-chart illustration in the "Why
// being early wins" section. Reuses ServiceLottieVisual — the same
// percentage-inner-box crop technique already proven to reliably enlarge
// a dotlottie animation without blur (a plain style={width/height} on the
// player itself doesn't reliably grow the visible artwork, since its own
// composition has empty margins baked in).
export function EarlyWinsLottie() {
  return (
    <div style={{ position: "relative", width: "100%", height: 650 }} className="early-wins-lottie">
      <ServiceLottieVisual src="https://lottie.host/c95da436-7e2e-4d11-9e66-54183f7635ba/hXXim8M0KY.lottie" scale={1} />
    </div>
  );
}
