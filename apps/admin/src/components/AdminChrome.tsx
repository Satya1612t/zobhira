"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthGate } from "./AuthGate";
import { AdminSidebar } from "./AdminSidebar";
import { useAuth } from "./AuthProvider";

// /login renders full-screen with none of this chrome (no sidebar, no auth
// gate — gating the login page itself would just redirect back to itself).
export function AdminChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") return <>{children}</>;

  return (
    <AuthGate>
      <div className="app-shell">
        <AdminSidebar />
        <div className="main-content">
          <div
            className="admin-topbar"
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              padding: "12px 24px",
              borderBottom: "1px solid var(--line)",
              background: "var(--surface)",
            }}
          >
            <SignedInAs />
          </div>
          <div className="main-scroll-area">
            <main style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 24px 40px" }}>
              {children}
            </main>
          </div>
        </div>
      </div>
    </AuthGate>
  );
}

function SignedInAs() {
  const { user, signOutUser } = useAuth();
  const router = useRouter();
  if (!user) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>{user.email}</span>
      <button
        type="button"
        onClick={() => signOutUser().then(() => router.replace("/login"))}
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          color: "var(--ink-muted)",
          background: "transparent",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-sm)",
          padding: "5px 10px",
          cursor: "pointer",
        }}
      >
        Sign out
      </button>
    </div>
  );
}
