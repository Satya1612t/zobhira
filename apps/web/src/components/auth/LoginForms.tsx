"use client";

import { useState } from "react";
import Link from "next/link";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { MailIcon, ShieldCheckIcon, GoogleLogo, LinkedInLogo } from "@/components/LoginIcons";

// The interactive half of /login. The page stays a Server Component for the
// layout; this owns the two forms + social buttons and talks to Firebase, then
// exchanges the ID token for the httpOnly zb_auth cookie via /api/auth/session.
function friendlyError(code: string): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "That email or password doesn't match. Try again.";
    case "auth/email-already-in-use":
      return "An account with this email already exists — sign in instead.";
    case "auth/weak-password":
      return "Pick a password with at least 6 characters.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "";
    case "auth/invalid-email":
      return "That doesn't look like a valid email.";
    default:
      return "Something went wrong. Please try again.";
  }
}

function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>Password</label>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)", display: "flex" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        </span>
        <input
          className="input"
          id={id}
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ paddingLeft: 36, paddingRight: 36, height: 40 }}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", display: "flex", padding: 2 }}
        >
          {visible ? (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a13.9 13.9 0 0 1-3.2 4M6.5 6.6C3.7 8.3 2 12 2 12s3.5 7 10 7a10 10 0 0 0 3.4-.6" /></svg>
          )}
        </button>
      </div>
    </div>
  );
}

export function LoginForms({ tab, prefillEmail }: { tab: "signin" | "signup"; prefillEmail: string }) {
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // After any successful Firebase sign-in, swap the ID token for the session
  // cookie and do a FULL navigation so the Server Component reads the new
  // cookie (a client router.push wouldn't carry the just-set cookie server-side).
  async function completeSession() {
    const user = auth.currentUser;
    if (!user) throw new Error("no-user");
    const idToken = await user.getIdToken();
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) throw new Error("session");
    window.location.assign("/profile");
  }

  function run(fn: () => Promise<void>) {
    return async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (busy) return;
      setBusy(true);
      setError(null);
      try {
        await fn();
      } catch (err) {
        const code = (err as { code?: string }).code ?? "";
        const msg = friendlyError(code);
        setError(msg || null);
        setBusy(false);
      }
    };
  }

  const handleSignin = run(async () => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
    await completeSession();
  });

  const handleSignup = run(async () => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const name = `${firstName} ${lastName}`.trim();
    if (name) await updateProfile(cred.user, { displayName: name });
    await completeSession();
  });

  const handleGoogle = run(async () => {
    await signInWithPopup(auth, googleProvider);
    await completeSession();
  });

  return (
    <>
      {tab === "signin" ? (
        <>
          <h2 style={{ margin: "0 0 2px", fontSize: 21 }}>Welcome Back</h2>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--color-text-muted)" }}>Sign in to continue your journey.</p>
          <form className="notched-form" onSubmit={handleSignin} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="field">
              <label htmlFor="signin-email">Email address</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)", display: "flex" }}><MailIcon /></span>
                <input className="input" id="signin-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ paddingLeft: 36, height: 40 }} />
              </div>
            </div>
            <PasswordInput id="signin-password" value={password} onChange={setPassword} placeholder="••••••••" />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
                <input type="checkbox" defaultChecked style={{ accentColor: "var(--color-accent)" }} />
                Remember me
              </label>
              <Link href="/login?tab=signup" style={{ color: "var(--color-accent)", fontWeight: 600 }}>New here?</Link>
            </div>
            {error && <p style={{ margin: 0, fontSize: 12.5, color: "var(--color-error)" }}>{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={busy} style={{ width: "100%", height: 40, marginTop: 2 }}>
              {busy ? "Signing in…" : "Sign In"}
            </button>
            <Link href="/login?tab=signup" className="btn btn-secondary" style={{ width: "100%", height: 40, textDecoration: "none" }}>Create Account</Link>
          </form>
        </>
      ) : (
        <>
          <h2 style={{ margin: "0 0 2px", fontSize: 21 }}>Create an account</h2>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--color-text-muted)" }}>Join Zobhira to save roles, apply, and track your applications.</p>
          <form className="notched-form" onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="signup-fname">First name</label>
                <input className="input" id="signup-fname" type="text" placeholder="Jane" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={{ height: 40 }} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="signup-lname">Last name</label>
                <input className="input" id="signup-lname" type="text" placeholder="Doe" value={lastName} onChange={(e) => setLastName(e.target.value)} style={{ height: 40 }} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="signup-email">Email address</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)", display: "flex" }}><MailIcon /></span>
                <input className="input" id="signup-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ paddingLeft: 36, height: 40 }} />
              </div>
            </div>
            <PasswordInput id="signup-password" value={password} onChange={setPassword} placeholder="Create a secure password" />
            {error && <p style={{ margin: 0, fontSize: 12.5, color: "var(--color-error)" }}>{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={busy} style={{ width: "100%", height: 40, marginTop: 2 }}>
              {busy ? "Creating…" : "Create Account"}
            </button>
          </form>
          <p style={{ marginTop: 4, fontSize: 10, lineHeight: 1.3, color: "var(--color-text-muted)", textAlign: "center" }}>
            By creating an account, you agree to our{" "}
            <Link href="/terms" style={{ color: "var(--color-accent)" }}>Terms</Link> and{" "}
            <Link href="/privacy" style={{ color: "var(--color-accent)" }}>Privacy Policy</Link>.
          </p>
        </>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "14px 0" }}>
        <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
        <span style={{ fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>Or continue with</span>
        <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <button type="button" className="btn btn-secondary" onClick={handleGoogle} disabled={busy} style={{ height: 40 }}>
          <GoogleLogo /> Google
        </button>
        {/* LinkedIn is not a native Firebase provider — leave it visibly
            disabled rather than ship a button that errors (build spec §4). */}
        <button type="button" className="btn btn-secondary" disabled title="LinkedIn sign-in coming soon" style={{ height: 40, opacity: 0.5, cursor: "not-allowed" }}>
          <LinkedInLogo /> LinkedIn
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 11, color: "var(--color-text-muted)" }}>
        <ShieldCheckIcon size={13} />
        Secure login &bull; Reliable platform &bull; Career-focused
      </div>
      <p style={{ marginTop: 10, fontSize: 11, color: "var(--color-text-muted)", textAlign: "center" }}>
        You can search Zobhira without an account.
      </p>
    </>
  );
}
