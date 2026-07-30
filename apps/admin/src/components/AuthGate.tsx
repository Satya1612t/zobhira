"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { useToast } from "./Toast";

type Status = "checking" | "allowed" | "denied";

// Auto-logout after this many minutes with no mouse/keyboard/touch/scroll
// activity — an admin panel that can delete data shouldn't stay signed in
// forever on an unattended machine. Shared across tabs via localStorage so
// activity in one tab resets the clock for all of them.
const IDLE_TIMEOUT_MINUTES = 30;
const IDLE_TIMEOUT_MS = IDLE_TIMEOUT_MINUTES * 60 * 1000;
const LAST_ACTIVITY_KEY = "admin_last_activity";
const ACTIVITY_EVENTS = ["mousemove", "keydown", "mousedown", "touchstart", "scroll", "wheel"] as const;

// Wraps every page except /login. Firebase Auth alone only proves *who*
// signed in; ADMIN_ALLOWED_EMAILS (checked server-side via /api/auth/check,
// see requireAdmin in lib/firebase-admin.ts) decides whether that person is
// actually let in — this component gates the UI on that same check so a
// signed-in-but-not-allowlisted account can't just view pages client-side.
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, rejectUnauthorizedUser, signOutUser } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const handledDenial = useRef(false);
  const handledIdle = useRef(false);

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

  // Idle auto-logout — only runs once fully signed in and allowlisted.
  // localStorage (not a ref) holds the last-activity timestamp so multiple
  // admin tabs share one idle clock instead of each racing independently.
  useEffect(() => {
    if (status !== "allowed") return;

    const markActive = () => localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    markActive();

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, markActive, { passive: true }));

    const interval = setInterval(() => {
      if (handledIdle.current) return;
      const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) ?? Date.now());
      if (Date.now() - last < IDLE_TIMEOUT_MS) return;
      handledIdle.current = true;
      signOutUser().then(() => {
        showToast(`Signed out after ${IDLE_TIMEOUT_MINUTES} minutes of inactivity.`, "error");
        router.replace("/login");
      });
    }, 15_000);

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, markActive));
      clearInterval(interval);
    };
  }, [status, signOutUser, router, showToast]);

  if (loading || status === "checking" || status === "denied") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-muted)", fontSize: 14 }}>
        {status === "denied" ? "Signing you out…" : "Checking access…"}
      </div>
    );
  }

  return <>{children}</>;
}
