import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AuthForm } from "@/components/auth/AuthForm";

// Preview candidate for a redesigned /login — deliberately NOT linked from
// anywhere in the site (no nav, no button, no redirect). Reached only by
// typing the URL directly. Placed outside the (main) route group so it
// skips AppShell entirely — no navbar/sidebar/footer, truly full-bleed,
// matching what 08-auth-and-profile.md actually specifies (the existing
// /login keeps Navbar+Footer; this is the fuller "immersive auth screen"
// version for comparison before deciding whether to replace /login).
// globals.css/shapes.css are already loaded by the root app/layout.tsx,
// which every route (including this one, outside the (main) group) still
// goes through — no need to re-import them here.
export const metadata: Metadata = {
  title: "Sign in or create an account (preview)",
  robots: { index: false, follow: false },
};

const BENEFITS = [
  "Save roles and come back to them",
  "Weekly alerts for searches you care about",
  "Contest deadlines before they close",
];

export default async function LoginSecondPage({
  searchParams,
}: {
  searchParams: { tab?: string; email?: string };
}) {
  const tab = searchParams.tab === "signup" ? "signup" : "signin";
  const prefillEmail = searchParams.email ?? "";

  const [jobsCount, contestsCount] = await Promise.all([
    prisma.job.count({ where: { isActive: true } }),
    prisma.contest.count({ where: { isActive: true } }),
  ]);

  return (
    <div className="auth-split-screen">
      <div className="auth-brand-panel section--dark deco-grain" data-theme="dark">
        <div className="deco-blur-orb deco-blur-orb--accent" style={{ top: "-100px", left: "-100px" }} aria-hidden="true" />
        <div className="deco-blur-orb deco-blur-orb--signal" style={{ bottom: "-120px", right: "-80px" }} aria-hidden="true" />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%" }}>
          <Link href="/" style={{ display: "inline-block" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/zobhira-logo-light.png" alt="Zobhira" style={{ height: 30, width: "auto" }} />
          </Link>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 420 }}>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", fontWeight: 700, lineHeight: 1.1, color: "#fff", margin: "0 0 28px" }}>
              One board. Every open role.
            </h1>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {BENEFITS.map((benefit) => (
                <div key={benefit} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 22, height: 22, borderRadius: "var(--radius-full)", background: "rgba(15,123,83,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.88)", fontSize: 14.5 }}>{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "rgba(255,255,255,0.6)", margin: 0 }}>
            {jobsCount.toLocaleString()} roles &middot; {contestsCount.toLocaleString()} contests &middot; updated daily
          </p>
        </div>
      </div>

      <div className="auth-form-panel">
        <div style={{ width: "100%", maxWidth: 420, perspective: 1400 }}>
          <AuthForm tab={tab} prefillEmail={prefillEmail} />
        </div>
      </div>
    </div>
  );
}
