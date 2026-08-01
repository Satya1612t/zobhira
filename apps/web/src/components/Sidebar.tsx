"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { SHOW_UNRELEASED_NAV } from "@/lib/authNavFlags";

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
  { label: "Jobs", href: "/jobs", Icon: JobsIcon, countKey: "jobsCount" as const },
  ...(SHOW_UNRELEASED_NAV
    ? [{ label: "Contests", href: "/contest", Icon: ContestsIcon, countKey: "contestsCount" as const }]
    : []),
  ...(SHOW_UNRELEASED_NAV ? [{ label: "Today", href: "/today", Icon: LiveIcon }] : []),
];

export function Sidebar({
  open,
  onOpenChange,
  desktopExpanded,
  onDesktopExpandedChange,
  jobsCount,
  contestsCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  desktopExpanded: boolean;
  onDesktopExpandedChange: (expanded: boolean) => void;
  jobsCount?: number;
  contestsCount?: number;
}) {
  const pathname = usePathname();
  // Mobile's off-canvas drawer is always full-width/labeled regardless of
  // the desktop collapse state (see .sidebar's mobile media query) — so
  // labels/logo should render whenever EITHER "desktop expanded" OR "mobile
  // drawer open" is true. Only the desktop icon-only mode hides them.
  const showLabels = desktopExpanded || open;
  const counts: Record<string, number | undefined> = { jobsCount, contestsCount };

  // No manual collapse/expand toggle — clicking anywhere inside the
  // sidebar expands it, clicking anywhere outside collapses it back.
  const asideRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!desktopExpanded) return;
    function onDocClick(e: MouseEvent) {
      if (asideRef.current && !asideRef.current.contains(e.target as Node)) {
        onDesktopExpandedChange(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [desktopExpanded, onDesktopExpandedChange]);

  return (
    <>
      <div className={`sidebar-backdrop${open ? " sidebar-open" : ""}`} onClick={() => onOpenChange(false)} />
      <aside
        ref={asideRef}
        onClick={() => onDesktopExpandedChange(true)}
        className={`sidebar${open ? " sidebar-open" : ""}${desktopExpanded ? " sidebar-expanded" : ""}`}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: showLabels ? "flex-start" : "center",
            gap: 8,
            marginBottom: 26,
            minHeight: 28,
          }}
        >
          <Link href="/" onClick={() => onOpenChange(false)} style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.png" alt="Zobhira" style={{ height: 28, width: 28, objectFit: "contain", flexShrink: 0 }} />
            {showLabels && <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "var(--ink)" }}>Zobhira</span>}
          </Link>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {TABS.map(({ label, href, Icon, countKey }, i) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            const count = countKey ? counts[countKey] : undefined;
            return (
              <div key={href} className="sidebar-item-wrap">
                <Link
                  href={href}
                  onClick={() => {
                    onOpenChange(false);
                    onDesktopExpandedChange(true);
                  }}
                  aria-current={active ? "page" : undefined}
                  className="sidebar-item"
                  style={{ justifyContent: showLabels ? "flex-start" : "center" }}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-active-indicator"
                      className="sidebar-active-indicator"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span
                    className="sidebar-icon-tile"
                    style={{
                      background: active ? "var(--gradient-accent)" : "transparent",
                      color: active ? "#fff" : "var(--color-text-muted)",
                    }}
                  >
                    <Icon />
                  </span>
                  {showLabels && (
                    <span
                      className="sidebar-label"
                      style={{ transitionDelay: `${i * 30}ms`, color: active ? "var(--color-accent)" : "var(--color-text-muted)" }}
                    >
                      {label}
                    </span>
                  )}
                  {showLabels && typeof count === "number" && (
                    <span className="chip chip--accent" style={{ marginLeft: "auto", fontSize: 10.5 }}>
                      {count.toLocaleString()}
                    </span>
                  )}
                </Link>
                {!showLabels && (
                  <span className="sidebar-tooltip" role="tooltip">
                    {label}
                  </span>
                )}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          {SHOW_UNRELEASED_NAV && (
            <div className="sidebar-item-wrap">
              <Link
                href="/profile"
                onClick={() => onOpenChange(false)}
                aria-current={pathname.startsWith("/profile") ? "page" : undefined}
                className="sidebar-item"
                style={{ justifyContent: showLabels ? "flex-start" : "center" }}
              >
                <span
                  className="sidebar-icon-tile"
                  style={{
                    background: pathname.startsWith("/profile") ? "var(--gradient-accent)" : "transparent",
                    color: pathname.startsWith("/profile") ? "#fff" : "var(--color-text-muted)",
                  }}
                >
                  <ProfileIcon />
                </span>
                {showLabels && <span className="sidebar-label">Profile</span>}
              </Link>
              {!showLabels && <span className="sidebar-tooltip" role="tooltip">Profile</span>}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
