"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { useToast } from "./Toast";

type Status = "checking" | "allowed" | "denied";

// Wraps every page except /login. Firebase Auth alone only proves *who*
// signed in; ADMIN_ALLOWED_EMAILS (checked server-side via /api/auth/check,
// see requireAdmin in lib/firebase-admin.ts) decides whether that person is
// actually let in — this component gates the UI on that same check so a
// signed-in-but-not-allowlisted account can't just view pages client-side.
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, rejectUnauthorizedUser } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const handledDenial = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    user.getIdToken().then((idToken) =>
      fetch("/api/auth/check", { headers: { Authorization: `Bearer ${idToken}` } }).then((res) => {
        if (!cancelled) setStatus(res.ok ? "allowed" : "denied");
      })
    );
    return () => {
      cancelled = true;
    };
  }, [loading, user, router]);

  // Same cleanup as the login page: don't just sign this account out, remove
  // its Firebase Auth record — it was never supposed to have one.
  useEffect(() => {
    if (status !== "denied" || handledDenial.current) return;
    handledDenial.current = true;
    showToast("This account isn't authorized for admin access.", "error");
    rejectUnauthorizedUser().then(() => router.replace("/login"));
  }, [status, rejectUnauthorizedUser, router, showToast]);

  if (loading || status === "checking" || status === "denied") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-muted)", fontSize: 14 }}>
        {status === "denied" ? "Signing you out…" : "Checking access…"}
      </div>
    );
  }

  return <>{children}</>;
}
