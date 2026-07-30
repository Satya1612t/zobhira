"use client";

import Link from "next/link";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

// Outside the (main) route group (like /login-second) so it renders
// full-bleed, no navbar/sidebar/footer chrome — matches how Next.js
// resolves not-found.tsx for a totally unmatched URL: no segment layouts
// are in the matched tree, so only this root-level file is used.
export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: 24,
        textAlign: "center",
      }}
    >
      <div style={{ width: 320, maxWidth: "100%" }}>
        <DotLottieReact
          src="https://lottie.host/99267fb5-89fb-4ae0-b7db-7311e516aa23/rG37nW9v7j.lottie"
          loop
          autoplay
        />
      </div>
      <Link href="/" className="btn btn-primary" style={{ marginTop: 4 }}>
        Back to home
      </Link>
    </div>
  );
}
