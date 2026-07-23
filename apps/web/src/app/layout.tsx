import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// "HireAuthority" institutional design language: a single Inter family
// across headings and body (see /DESIGN.md and the fetched mood-board).
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-inter",
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
    default: "Zobhira — Technical jobs & contests, aggregated daily",
    template: "%s | Zobhira",
  },
  description:
    "Zobhira aggregates technical job listings and hackathons from LinkedIn, Y Combinator, RemoteOK, Talentd, and DEV Community into one searchable board, refreshed around the clock.",
};

// No app-shell here — the sidebar/navbar/footer chrome lives in
// app/(main)/layout.tsx so /login (outside that group) can render as a
// full-bleed page. This root layout only owns <html>/<body>, fonts, and
// site-wide metadata.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
