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

  // Lifted here (rather than living inside Sidebar) so Navbar can react to
  // it too — see the sidebarOpen note in Navbar.tsx.
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-shell">
      {!hideSidebar && <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />}
      <div className="main-content" style={hideSidebar ? { marginLeft: 0 } : undefined}>
        <Navbar sidebarOpen={!hideSidebar && sidebarOpen} />
        <div className="main-scroll-area">
          {children}
          <Footer />
        </div>
      </div>
    </div>
  );
}
