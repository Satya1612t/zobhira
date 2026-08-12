"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";

// /login has no primary-nav destinations of its own (Home/Jobs/Contests/...),
// so the Sidebar is dropped there while Navbar/Footer stay — the page still
// needs to feel like part of the site, just without a nav that doesn't apply.
export function AppShell({
  children,
  footer,
  jobsCount,
  contestsCount,
  isSignedIn = false,
}: {
  children: ReactNode;
  footer: ReactNode;
  jobsCount?: number;
  contestsCount?: number;
  isSignedIn?: boolean;
}) {
  const pathname = usePathname();
  const hideSidebar = pathname === "/login";

  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Desktop-only: sidebar defaults to icon-only (see .sidebar's default
  // width in globals.css) and expands to the full labeled width on click.
  // Separate from sidebarOpen (mobile's show/hide) — on mobile this is
  // ignored entirely, the drawer is always full-width when open.
  const [desktopExpanded, setDesktopExpanded] = useState(false);

  // The page itself never scrolls (see globals.css) — only this div does —
  // so Navbar's "shrink on scroll" state has to come from watching this
  // element's scrollTop, not window.scrollY.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 40);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile drawer on route change.
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="app-shell">
      {/* First focusable element on every page — invisible until focused,
          jumps straight past the sidebar/navbar to real content. */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      {!hideSidebar && (
        <Sidebar
          open={sidebarOpen}
          onOpenChange={setSidebarOpen}
          desktopExpanded={desktopExpanded}
          onDesktopExpandedChange={setDesktopExpanded}
          jobsCount={jobsCount}
          contestsCount={contestsCount}
          isSignedIn={isSignedIn}
        />
      )}
      <div
        className={`main-content${!hideSidebar && desktopExpanded ? " main-content-expanded" : ""}`}
        style={hideSidebar ? { marginLeft: 0 } : undefined}
      >
        <Navbar scrolled={scrolled} sidebarOpen={sidebarOpen} onOpenSidebar={() => setSidebarOpen((v) => !v)} isSignedIn={isSignedIn} />
        <div className="main-scroll-area" ref={scrollRef}>
          <div id="main-content">{children}</div>
          {footer}
        </div>
      </div>
    </div>
  );
}
