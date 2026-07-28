"use client";

import { useState } from "react";
import Link from "next/link";
import { FloatingInput } from "./FloatingInput";
import { PasswordFieldV2 } from "./PasswordFieldV2";
import { ShieldCheckIcon, GoogleLogo, LinkedInLogo } from "@/components/LoginIcons";

function validateEmail(value: string): string | null {
  if (!value.trim()) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Enter a valid email address.";
  return null;
}
function validatePassword(value: string): string | null {
  if (!value) return "Password is required.";
  if (value.length < 8) return "Use at least 8 characters.";
  return null;
}
function validateRequired(value: string): string | null {
  return value.trim() ? null : "This field is required.";
}

// No /api/auth/* backend exists yet (see /DESIGN.md) — submission is
// cosmetic (a fake loading state, then nothing), but every other
// interaction here is real: blur validation, aria-live error announcement,
// the shake-on-failure micro-animation, password strength.
export function AuthForm({ tab, prefillEmail }: { tab: "signin" | "signup"; prefillEmail: string }) {
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const invalid = form.querySelector('[aria-invalid="true"]');
    if (invalid) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      (invalid as HTMLElement).focus();
      return;
    }
    setLoading(true);
    setTimeout(() => setLoading(false), 900);
  }

  return (
    <div
      key={tab}
      className={`auth-flip-card auth-card-v2${shake ? " auth-card-shake" : ""} ${tab === "signup" ? "auth-flip-from-right" : "auth-flip-from-left"}`}
    >
      <Link href="/" className="auth-card-logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/zobhira-logo-dark.png" alt="Zobhira" style={{ height: 30, width: "auto" }} />
      </Link>

      {tab === "signin" ? (
        <>
          <h1 className="auth-card-title">Welcome back</h1>
          <p className="auth-card-sub">
            New here?{" "}
            <Link href="/login-second?tab=signup" style={{ color: "var(--color-accent)", fontWeight: 600 }}>
              Create an account
            </Link>
          </p>
          <form className="auth-form-fields" onSubmit={handleSubmit} noValidate>
            <FloatingInput label="Email address" type="email" name="email" autoComplete="email" validate={validateEmail} />
            <PasswordFieldV2 label="Password" autoComplete="current-password" validate={validatePassword} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, margin: "-4px 0 4px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", color: "var(--color-text-muted)" }}>
                <input type="checkbox" defaultChecked style={{ accentColor: "var(--color-accent)" }} />
                Remember me
              </label>
              <a href="#" style={{ color: "var(--color-accent)", fontWeight: 600 }}>
                Forgot password?
              </a>
            </div>
            <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading}>
              <span className={loading ? "auth-submit-label--hidden" : undefined}>Sign in</span>
              {loading && <span className="auth-submit-spinner" aria-label="Signing in" />}
            </button>
          </form>
        </>
      ) : (
        <>
          <h1 className="auth-card-title">Create your account</h1>
          <p className="auth-card-sub">
            Already have one?{" "}
            <Link href="/login-second" style={{ color: "var(--color-accent)", fontWeight: 600 }}>
              Sign in
            </Link>
          </p>
          <form className="auth-form-fields" onSubmit={handleSubmit} noValidate>
            <div style={{ display: "flex", gap: 10 }}>
              <FloatingInput label="First name" type="text" name="firstName" autoComplete="given-name" validate={validateRequired} />
              <FloatingInput label="Last name" type="text" name="lastName" autoComplete="family-name" validate={validateRequired} />
            </div>
            <FloatingInput label="Email address" type="email" name="email" autoComplete="email" defaultValue={prefillEmail} validate={validateEmail} />
            <PasswordFieldV2 label="Create a password" autoComplete="new-password" showStrength validate={validatePassword} />
            <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading}>
              <span className={loading ? "auth-submit-label--hidden" : undefined}>Create account</span>
              {loading && <span className="auth-submit-spinner" aria-label="Creating account" />}
            </button>
          </form>
          <p style={{ marginTop: 10, fontSize: 11, lineHeight: 1.4, color: "var(--color-text-muted)", textAlign: "center" }}>
            By creating an account, you agree to our{" "}
            <Link href="/terms" style={{ color: "var(--color-accent)" }}>Terms</Link> and{" "}
            <Link href="/privacy" style={{ color: "var(--color-accent)" }}>Privacy Policy</Link>.
          </p>
        </>
      )}

      <div className="auth-divider">
        <span>Or continue with</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <button type="button" className="btn btn-secondary auth-social-btn">
          <GoogleLogo /> Google
        </button>
        <button type="button" className="btn btn-secondary auth-social-btn">
          <LinkedInLogo /> LinkedIn
        </button>
      </div>

      <p className="auth-card-footnote">
        <ShieldCheckIcon size={13} />
        You can search Zobhira without an account.{" "}
        <Link href="/jobs" style={{ color: "var(--color-accent)", fontWeight: 600 }}>Browse jobs &rarr;</Link>
      </p>
    </div>
  );
}
