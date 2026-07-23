// Small inline-SVG icon set for the /login page — flat stroke style
// matching every other icon in the app (Sidebar, ApplyModal), no icon-
// library dependency. See /DESIGN.md.

import type { ReactNode } from "react";

export function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

export function ShieldCheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3Z" fill="currentColor" />
      <path d="m9 12 2 2 4-4" stroke="#fff" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Filled/two-tone glyphs below (rather than the thin outline style above) —
// these mirror the four floating badge icons baked into
// /illustrations/career-journey.png (grad cap, briefcase, trophy, code
// brackets), so the feature-card row below the image reads as the same
// icon set as the one shown floating above it in the illustration.

export function GradCapIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3 2 8l10 5 10-5-10-5Z" />
      <path d="M6 11.2V16c0 1.66 2.69 3 6 3s6-1.34 6-3v-4.8l-6 3-6-3Z" />
    </svg>
  );
}

export function BriefcaseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 4a2 2 0 0 0-2 2v1H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3V6a2 2 0 0 0-2-2H9Zm0 3V6h6v1H9Z" />
      <rect x="10" y="12" width="4" height="2.4" rx="0.6" fill="var(--color-surface, #fff)" />
    </svg>
  );
}

export function OpenBookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 5.5A2.5 2.5 0 0 1 4.5 3H11v16H4.5A2.5 2.5 0 0 1 2 16.5v-11Z" />
      <path d="M22 5.5A2.5 2.5 0 0 0 19.5 3H13v16h6.5a2.5 2.5 0 0 0 2.5-2.5v-11Z" />
    </svg>
  );
}

export function CodeBracketsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 9.2h18" />
      <path d="m9.5 12.3-1.8 1.8 1.8 1.8" />
      <path d="m14.5 12.3 1.8 1.8-1.8 1.8" />
    </svg>
  );
}

export function TrophyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 4h10v4.5a5 5 0 0 1-10 0V4Z" />
      <path d="M17 5h1.5a2 2 0 0 1 2 2 4 4 0 0 1-4 4 4 4 0 0 0 .5-2V5Z" fillOpacity="0.75" />
      <path d="M7 5H5.5a2 2 0 0 0-2 2 4 4 0 0 0 4 4 4 4 0 0 1-.5-2V5Z" fillOpacity="0.75" />
      <path d="M9.5 15.5h5l1 2h-7l1-2Z" />
      <path d="M8 21h8v-1.5H8V21Z" />
    </svg>
  );
}

export function BuildingIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1" />
      <path d="M9 21v-3h6v3" />
    </svg>
  );
}

// White circular badge, matching the floating-icon style baked into the
// hero illustration (a soft-blue-bordered white circle behind each glyph).
export function IconBadge({ color, size = 34, children }: { color?: string; size?: number; children: ReactNode }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        background: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color,
        margin: "0 auto",
      }}
    >
      {children}
    </div>
  );
}

export function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round">
      <path d="m12 2 2.9 6.6 7.1.7-5.4 4.7 1.6 7-6.2-3.7L5.8 21l1.6-7-5.4-4.7 7.1-.7L12 2Z" />
    </svg>
  );
}

export function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.4 0 6.4 1.2 8.8 3.5l6.5-6.5C35.3 2.5 30 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.6 5.9C12 13 17.5 9.5 24 9.5Z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-4 6.8-9.9 6.8-17.4Z" />
      <path fill="#FBBC05" d="M10.2 19.1a14.5 14.5 0 0 0 0 9.8l-7.6 5.9a24 24 0 0 1 0-21.6l7.6 5.9Z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.7 2.2-8.6 2.2-6.5 0-12-4.4-14-10.3l-7.6 5.9C6.5 42.6 14.6 48 24 48Z" />
    </svg>
  );
}

export function LinkedInLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#0A66C2">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z" />
    </svg>
  );
}
