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
        <a className="skip-link" href="#admin-main">Skip to main content</a>
        <AdminSidebar />
        <div className="main-content">
          <div className="admin-topbar">
            <div className="admin-topbar__context"><span>Admin console</span><strong>{pageTitle(pathname)}</strong></div>
            <SignedInAs />
          </div>
          <div className="main-scroll-area">
            <main className="admin-main" id="admin-main" tabIndex={-1}>
              {children}
            </main>
          </div>
        </div>
      </div>
    </AuthGate>
  );
}

function pageTitle(pathname: string) {
  const segment = pathname.split("/").filter(Boolean)[0] ?? "dashboard";
  return segment.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function SignedInAs() {
  const { user, signOutUser } = useAuth();
  const router = useRouter();
  if (!user) return null;
  return (
    <div className="signed-in">
      <span className="signed-in__avatar" aria-hidden="true">{user.email?.charAt(0).toUpperCase() ?? "A"}</span>
      <span className="signed-in__email">{user.email}</span>
      <button
        type="button"
        onClick={() => signOutUser().then(() => router.replace("/login"))}
        className="sign-out-button"
      >
        Sign out
      </button>
    </div>
  );
}
