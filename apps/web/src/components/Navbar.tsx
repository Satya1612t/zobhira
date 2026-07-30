"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Modal } from "@/components/ui/Modal";
import { SHOW_UNRELEASED_NAV } from "@/lib/authNavFlags";

const NAV_LINKS = [
  { label: "Jobs", href: "/jobs" },
  { label: "Contests", href: "/contest" },
  { label: "Today", href: "/today" },
  { label: "About", href: "/about" },
];

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

// Floating pill navbar — complements the left Sidebar's primary section nav
// rather than duplicating it. `scrolled` and the mobile hamburger are
// controlled by AppShell (which owns the scroll container and sidebar
// state), since Navbar itself isn't inside the element that actually
// scrolls (see /DESIGN.md's scroll-architecture note).
export function Navbar({
  scrolled,
  onOpenSidebar,
  sidebarOpen,
}: {
  scrolled: boolean;
  onOpenSidebar: () => void;
  sidebarOpen: boolean;
}) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <header className={`navbar-float${scrolled ? " navbar-float--scrolled" : ""}`}>
        <button
          type="button"
          className="navbar-hamburger"
          onClick={onOpenSidebar}
          aria-label={sidebarOpen ? "Close menu" : "Open menu"}
          aria-expanded={sidebarOpen}
        >
          <span className={`navbar-hamburger-bar${sidebarOpen ? " navbar-hamburger-bar--open-1" : ""}`} />
          <span className={`navbar-hamburger-bar${sidebarOpen ? " navbar-hamburger-bar--open-2" : ""}`} />
        </button>

        <Link href="/" className="navbar-brand" style={{ transform: scrolled ? "scale(0.92)" : undefined }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.png" alt="" width={28} height={28} style={{ objectFit: "contain" }} />
          <span className="navbar-wordmark">Zobhira</span>
        </Link>

        <nav className="navbar-center-nav" aria-label="Primary">
          {NAV_LINKS.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link key={link.href} href={link.href} className="navbar-nav-link">
                {active && (
                  <motion.span
                    layoutId="navbar-active-pill"
                    className="navbar-active-pill"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span style={{ position: "relative", zIndex: 1, color: active ? "var(--color-accent)" : "var(--color-text-muted)" }}>
                  {link.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button type="button" className="navbar-icon-btn" aria-label="Search" onClick={() => setSearchOpen(true)}>
            <SearchIcon />
          </button>
          {SHOW_UNRELEASED_NAV && (
            <>
              <Link href="/login" className="btn btn-ghost navbar-signin-desktop">
                Log in
              </Link>
              <Link href="/login?tab=signup" className="btn btn-primary" style={{ borderRadius: "var(--radius-full)", boxShadow: "var(--shadow-accent)" }}>
                Sign up
              </Link>
            </>
          )}
        </div>
      </header>

      <Modal open={searchOpen} onClose={() => setSearchOpen(false)} labelledBy="navbar-search-title">
        <form method="get" action="/jobs" style={{ padding: 24 }}>
          <h2 id="navbar-search-title" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-xl)", margin: "0 0 16px" }}>
            Search jobs
          </h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <input
              className="input"
              type="text"
              name="q"
              autoFocus
              placeholder="Job title, keywords, or company"
              style={{ flex: "2 1 200px" }}
            />
            <input className="input" type="text" name="location" placeholder="City or remote" style={{ flex: "1 1 140px" }} />
            <button type="submit" className="btn btn-primary" style={{ flexShrink: 0 }}>
              Search
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
