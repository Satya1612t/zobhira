"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

// /login has no primary-nav destinations of its own (Home/Jobs/Contests/...),
// so the Sidebar is dropped there while Navbar/Footer stay — the page still
// needs to feel like part of the site, just without a nav that doesn't apply.
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideSidebar = pathname === "/login";

  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Desktop-only: sidebar defaults to icon-only (see .sidebar's default
  // width in globals.css) and expands to the full labeled width on click.
  // Separate from sidebarOpen (mobile's show/hide) — on mobile this is
  // ignored entirely, the drawer is always full-width when open.
  const [desktopExpanded, setDesktopExpanded] = useState(false);

  return (
    <div className="app-shell">
      {!hideSidebar && (
        <Sidebar
          open={sidebarOpen}
          onOpenChange={setSidebarOpen}
          desktopExpanded={desktopExpanded}
          onDesktopExpandedChange={setDesktopExpanded}
        />
      )}
      <div
        className={`main-content${!hideSidebar && desktopExpanded ? " main-content-expanded" : ""}`}
        style={hideSidebar ? { marginLeft: 0 } : undefined}
      >
        <Navbar />
        <div className="main-scroll-area">
          {children}
          <Footer />
        </div>
      </div>
    </div>
  );
}
