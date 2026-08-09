"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Inline SVGs (no icon-library dependency), matching apps/web's Sidebar.
function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="11" width="8" height="10" rx="1.5" />
      <rect x="3" y="14" width="8" height="7" rx="1.5" />
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
function SchedulerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}
function SourcesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5.5" rx="8" ry="2.8" />
      <path d="M4 5.5V12c0 1.5 3.5 2.8 8 2.8s8-1.3 8-2.8V5.5" />
      <path d="M4 12v6.5c0 1.5 3.5 2.8 8 2.8s8-1.3 8-2.8V12" />
    </svg>
  );
}
function CompaniesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01" />
    </svg>
  );
}
function ProgressIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17V9M9 17V5m6 12v-6m6 6V3" />
    </svg>
  );
}
function AuditLogIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12h6M9 16h6M9 8h6" />
      <path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
    </svg>
  );
}
function LlmIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <path d="M12 8V4M9 4h6" />
      <path d="M8 13v2M16 13v2" />
      <path d="M2 13h2M20 13h2" />
    </svg>
  );
}
function AnalyticsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 15l4-5 3 3 5-7" />
    </svg>
  );
}

const TABS = [
  { label: "Dashboard", href: "/dashboard", Icon: DashboardIcon },
  { label: "Jobs", href: "/jobs", Icon: JobsIcon },
  { label: "Contests", href: "/contests", Icon: ContestsIcon },
  { label: "Scheduler", href: "/scheduler", Icon: SchedulerIcon },
  { label: "Companies", href: "/companies", Icon: CompaniesIcon },
  { label: "Sources", href: "/sources", Icon: SourcesIcon },
  { label: "LLM", href: "/llm", Icon: LlmIcon },
  { label: "Analytics", href: "/analytics", Icon: AnalyticsIcon },
  { label: "Audit Log", href: "/audit-log", Icon: AuditLogIcon },
  { label: "Progress", href: "/progress", Icon: ProgressIcon, comingSoon: true },
];

export function AdminSidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <button
        className="sidebar-toggle"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        style={{
          position: "fixed",
          top: 14,
          left: 14,
          zIndex: 20,
          width: 44,
          height: 44,
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--line)",
          background: "var(--surface)",
          color: "var(--ink)",
          cursor: "pointer",
          fontFamily: "var(--font-mono)",
          fontSize: 15,
        }}
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      <div
        className={`sidebar-backdrop${open ? " sidebar-open" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <aside className={`sidebar${open ? " sidebar-open" : ""}`} aria-label="Admin navigation">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", marginBottom: 24 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.png" alt="Zobhira" style={{ height: 28, width: 28, objectFit: "contain", flexShrink: 0 }} />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "var(--ink)" }}>Zobhira</span>
        </Link>

        <p
          style={{
            margin: "0 0 10px",
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--ink-faint)",
          }}
        >
          Workspace
        </p>

        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {TABS.map(({ label, href, Icon, comingSoon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  minHeight: 42,
                  borderRadius: "var(--radius-sm)",
                  textDecoration: "none",
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: active ? "var(--accent)" : "var(--ink-muted)",
                  background: active ? "var(--accent-soft)" : "transparent",
                }}
              >
                <Icon />
                <span style={{ flex: 1 }}>{label}</span>
                {comingSoon && (
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: active ? "var(--accent)" : "var(--ink-faint)",
                      background: active ? "rgba(0,51,102,0.12)" : "var(--surface-hover)",
                      padding: "2px 6px",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    Soon
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
