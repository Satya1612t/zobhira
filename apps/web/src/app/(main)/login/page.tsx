import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheckIcon, IconBadge, StarIcon } from "@/components/LoginIcons";
import { LoginForms } from "@/components/auth/LoginForms";

// A real, crawlable /login route (not a modal), rendered inside the normal
// app shell. The interactive auth (Firebase sign-in + session cookie) lives in
// the LoginForms client component; this page owns the static layout only.
//
// Tab state is a query param (?tab=signin|signup) — both states are real,
// distinct, linkable URLs. `email` prefills the signup form so a "you already
// have an account" redirect can hand the address across without retyping.
export const metadata: Metadata = {
  title: "Sign in or create an account",
  description: "Sign in to Zobhira or create a free account to save roles, apply, and track applications.",
  robots: { index: false, follow: true },
};

const FEATURES = [
  { title: "Students", desc: "Build skills", icon: "/icons/graduation-cap.png" },
  { title: "Working Professionals", desc: "Advance your career", icon: "/icons/briefcase.png" },
  { title: "Learning", desc: "Explore courses or skills", icon: "/icons/open-book.png" },
  { title: "Hackathons", desc: "Solve, innovate and excel", icon: "/icons/code.png" },
  { title: "Prizes", desc: "Win exciting rewards", icon: "/icons/trophy.png" },
  { title: "Placements", desc: "Find placements", icon: "/icons/institution.png" },
];

export default function LoginPage({
  searchParams,
}: {
  searchParams: { tab?: string; email?: string };
}) {
  const tab: "signin" | "signup" = searchParams.tab === "signup" ? "signup" : "signin";
  const prefillEmail = searchParams.email ?? "";

  return (
    <main style={{ maxWidth: 1600, margin: "0 auto", padding: "10px 0px 0px", display: "flex", alignItems: "center", minHeight: "calc(100vh - 65px)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 40, width: "100%" }}>
        <div className="login-illustration-col" style={{ flex: "1 1 820px", maxWidth: 820 }}>
          <div style={{ position: "relative", marginBottom: 14, height: 480, borderRadius: "var(--radius-md)", overflow: "hidden" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/illustrations/career-journey.png"
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }}
            />
            <div style={{ position: "absolute", top: "6%", left: "6%", right: "40%" }}>
              <h1 style={{ fontSize: 38, lineHeight: 1.15, margin: "0 0 8px" }}>
                One page. <span style={{ color: "var(--color-accent)" }}>Every opening.</span>
              </h1>
              <p style={{ fontSize: 14, lineHeight: 1.45, color: "var(--color-text-)", margin: "0 0 10px" }}>
                Save jobs for later, get an email when something new matches, <br></br> and never
                miss a contest deadline.
              </p>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ color: "var(--color-accent)", flexShrink: 0, marginTop: 1 }}>
                  <ShieldCheckIcon size={28} />
                </span>
                <span style={{ fontSize: 11.5, lineHeight: 1.45, color: "var(--color-text-dark)", fontWeight: 200 }}>
                  Built to help you grow with clarity, <br /> credibility, and real opportunities.
                </span>
              </div>
            </div>
          </div>

          <div className="login-feature-grid" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
            {FEATURES.map(({ title, desc, icon }) => (
              <div key={title} className="card" style={{ padding: "10px 7px", textAlign: "center", gap: 4 }}>
                <IconBadge size={40}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={icon} alt="" width={40} height={40} />
                </IconBadge>
                <div style={{ fontSize: 10.5, fontWeight: 700, marginTop: 3 }}>{title}</div>
                <div style={{ fontSize: 9, color: "var(--color-text-muted)", lineHeight: 1.25 }}>{desc}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 6, lineHeight: 1, display: "flex", justifyContent: "center" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "5px 20px", fontSize: 12, color: "var(--color-text-dark)", fontWeight: 600, background: "#fff", borderRadius: "var(--radius-full)", boxShadow: "var(--shadow-md)" }}>
              <StarIcon /> Live Opportunities
            </span>
          </div>
        </div>

        <div style={{ flex: "1 1 260px", maxWidth: 420, display: "flex", flexDirection: "column", perspective: 1400 }}>
          <div
            key={tab}
            className={`card auth-flip-card ${tab === "signup" ? "auth-flip-from-right" : "auth-flip-from-left"}`}
            style={{ padding: 28, height: "100%", justifyContent: "center" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/zobhira-logo-light.png" alt="Zobhira" style={{ height: 32, width: "auto" }} />
              {tab === "signup" && (
                <Link href="/login" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "var(--color-accent)", textDecoration: "underline" }}>
                  &larr; Back to Sign In
                </Link>
              )}
            </div>

            <LoginForms tab={tab} prefillEmail={prefillEmail} />
          </div>
        </div>
      </div>
    </main>
  );
}
