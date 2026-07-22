"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Jobs", href: "/" },
  { label: "Contest", href: "/contest" },
  { label: "Live Opening", href: "/live" },
  { label: "Progress", href: "/progress" },
];

export function Sidebar() {
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
        onClick={() => setOpen(false)}
      />
      <aside className={`sidebar${open ? " sidebar-open" : ""}`}>
        <Link
          href="/"
          onClick={() => setOpen(false)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
            marginBottom: 26,
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: "var(--accent)",
              color: "var(--accent-ink)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            J
          </span>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 17, color: "var(--ink)" }}>
            Job Portal
          </span>
        </Link>

        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={() => setOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 10px",
                  borderRadius: "var(--radius-sm)",
                  textDecoration: "none",
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: active ? "var(--accent-ink)" : "var(--ink)",
                  background: active ? "var(--accent)" : "transparent",
                }}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
