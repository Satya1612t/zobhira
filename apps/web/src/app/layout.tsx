import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { Fraunces, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "../styles/shapes.css";
import { ToastProvider } from "@/components/ui/Toast";
import { Analytics } from "@/components/Analytics";

// "Editorial Signal" design language (see /DESIGN.md) — Fraunces (optical
// serif) for display/headings, Plus Jakarta Sans for body/UI, JetBrains Mono
// unchanged for kickers/timestamps. Replaces the single-Inter setup; keeping
// the same --font-inter-shaped variable names would be misleading, so this
// introduces --font-fraunces / --font-jakarta and globals.css's
// --font-display / --font-body point at them instead.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["600", "700", "900"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

// metadataBase + a title template so every page (set via its own
// `export const metadata`) gets a consistent "<Page> | Zobhira" <title>
// and correctly-resolved absolute URLs for social/share previews.
export const metadata: Metadata = {
  metadataBase: new URL("https://zobhira.com"),
  title: {
    default: "Zobhira — Every technical job and contest on one board",
    template: "%s | Zobhira",
  },
  description:
    "Search technical roles and hackathons updated every morning. Dead listings removed automatically. Free, no account needed.",
};

// No app-shell here — the sidebar/navbar/footer chrome lives in
// app/(main)/layout.tsx so /login (outside that group) can render as a
// full-bleed page. This root layout only owns <html>/<body>, fonts, and
// site-wide metadata.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${jakarta.variable} ${jetbrainsMono.variable}`}>
      <body>
        <ToastProvider>{children}</ToastProvider>
        {/* Portal target for every <Modal> — see components/ui/Modal.tsx.
            Sits at the very end of <body> so its stacking context is never
            trapped under an ancestor's transform/overflow. */}
        <div id="modal-root" />
        {/* Portal target for <ToastProvider> — see components/ui/Toast.tsx.
            A stable, server-rendered (empty) container, not document.body
            directly: portaling straight into document.body inserts a live
            extra child mid-hydration and trips a hydration mismatch. */}
        <div id="toast-root" />
        {/* First-party page-view tracking (see db/migrations/0021). In
            Suspense because useSearchParams would otherwise de-opt this
            layout from static rendering site-wide. */}
        <Suspense fallback={null}>
          <Analytics />
        </Suspense>
      </body>
    </html>
  );
}
