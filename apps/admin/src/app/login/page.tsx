"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";

export default function AdminLoginPage() {
  const { user, loading, signInWithGoogle, rejectUnauthorizedUser } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  // Already signed in with an allowed account (e.g. back button, or a
  // second tab) — skip straight past the login form.
  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  async function handleGoogleSignIn() {
    setPending(true);
    try {
      await signInWithGoogle();
      const idToken = await (await import("@/lib/firebase")).auth.currentUser?.getIdToken();
      const res = await fetch("/api/auth/check", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        router.replace("/");
      } else {
        // Not just signOut — this account isn't allowlisted, so remove the
        // Firebase Auth record entirely rather than leaving it behind.
        await rejectUnauthorizedUser();
        showToast("This Google account isn't authorized for admin access.", "error");
      }
    } catch {
      showToast("Sign-in failed or was cancelled. Please try again.", "error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        {/* Standard admin-panel layout: logo mark, product name, a plain
            "Admin Panel" eyebrow (not a repeat of the wordmark), single
            sign-in card, restricted-access footnote below it. */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/zobhira-logo-dark.png" alt="Zobhira" style={{ height: 30, width: "auto" }} />
        </div>

        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-card)",
            padding: "36px 32px 32px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: "0 0 6px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--accent)",
            }}
          >
            Admin Panel
          </p>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 20,
              fontWeight: 600,
              margin: "0 0 6px",
              color: "var(--ink)",
            }}
          >
            Sign in to continue
          </h1>
          <p style={{ margin: "0 0 28px", fontSize: 13, color: "var(--ink-muted)" }}>
            Restricted to authorized team accounts only.
          </p>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={pending}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              height: 46,
              fontSize: 14,
              fontWeight: 600,
              color: "var(--ink)",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-sm)",
              cursor: pending ? "not-allowed" : "pointer",
              opacity: pending ? 0.6 : 1,
              transition: "background 0.15s ease",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.4 0 6.4 1.2 8.8 3.5l6.5-6.5C35.3 2.5 30 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.6 5.9C12 13 17.5 9.5 24 9.5Z" />
              <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-4 6.8-9.9 6.8-17.4Z" />
              <path fill="#FBBC05" d="M10.2 19.1a14.5 14.5 0 0 0 0 9.8l-7.6 5.9a24 24 0 0 1 0-21.6l7.6 5.9Z" />
              <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.7 2.2-8.6 2.2-6.5 0-12-4.4-14-10.3l-7.6 5.9C6.5 42.6 14.6 48 24 48Z" />
            </svg>
            {pending ? "Signing in…" : "Sign in with Google"}
          </button>
        </div>

        <p style={{ marginTop: 18, textAlign: "center", fontSize: 12, color: "var(--ink-faint)" }}>
          Not an admin?{" "}
          <a href="https://zobhira.com" style={{ color: "var(--ink-muted)" }}>
            Back to zobhira.com
          </a>
        </p>
      </div>
    </div>
  );
}
