// Plain data + types, deliberately NOT in ProfileTabs.tsx (which is a
// "use client" file) — every export from a "use client" module becomes a
// client-only reference when imported into a Server Component, so
// profile/page.tsx (a Server Component) couldn't call .find() on TABS when
// it lived there. Shared constants used by both server and client code
// need their own plain module.
export const TABS = [
  { key: "saved", label: "Saved roles" },
  { key: "applications", label: "Applications" },
  { key: "contests", label: "Contests" },
  { key: "alerts", label: "Alerts" },
  { key: "settings", label: "Settings" },
] as const;

export type ProfileTabKey = (typeof TABS)[number]["key"];
