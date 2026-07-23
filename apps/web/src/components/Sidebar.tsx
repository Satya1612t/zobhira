"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Inline SVGs (no icon-library dependency, matching the rest of the app) —
// stand-ins for the Material Symbols glyphs in the Stitch mood-board
// ("home", "work", "emoji_events", "sensors", "person").
function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}
function JobsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 12h18" />
    </svg>
  );
}
function ContestsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M17 5h2a2 2 0 0 1 2 2 4 4 0 0 1-4 4" />
      <path d="M7 5H5a2 2 0 0 0-2 2 4 4 0 0 0 4 4" />
    </svg>
  );
}
function LiveIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 16.2a6 6 0 0 0 0-8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 19.1a10 10 0 0 0 0-14.2" />
    </svg>
  );
}
function ProfileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1.6-3.6 5-5.5 8-5.5s6.4 1.9 8 5.5" />
    </svg>
  );
}

const TABS = [
  { label: "Home", href: "/", Icon: HomeIcon },
  { label: "Jobs", href: "/jobs", Icon: JobsIcon },
  { label: "Contests", href: "/contest", Icon: ContestsIcon },
  { label: "Live Opening", href: "/live", Icon: LiveIcon },
  { label: "Profile", href: "/profile", Icon: ProfileIcon },
];

export function Sidebar({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const pathname = usePathname();

  return (
    <>
      <button
        className="sidebar-toggle"
        onClick={() => onOpenChange(true)}
        aria-label="Open menu"
        style={{
          position: "fixed",
          top: 14,
          left: 14,
          zIndex: 20,
          width: 38,
          height: 38,
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--line)",
          background: "var(--surface)",
          color: "var(--ink)",
          cursor: "pointer",
          fontFamily: "var(--font-mono)",
          fontSize: 16,
        }}
      >
        ☰
      </button>
      <div
        className={`sidebar-backdrop${open ? " sidebar-open" : ""}`}
        onClick={() => onOpenChange(false)}
      />
      <aside className={`sidebar${open ? " sidebar-open" : ""}`}>
        <Link
          href="/"
          onClick={() => onOpenChange(false)}
          style={{
            display: "flex",
            alignItems: "center",
            textDecoration: "none",
            marginBottom: 26,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/zobhira-logo-light.png" alt="Zobhira" style={{ height: 28, width: "auto" }} />
        </Link>

        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {TABS.map(({ label, href, Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => onOpenChange(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 10px",
                  borderRadius: "var(--radius-sm)",
                  textDecoration: "none",
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: active ? "var(--accent)" : "var(--ink-muted)",
                  background: active ? "var(--accent-soft)" : "transparent",
                }}
              >
                <Icon />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
