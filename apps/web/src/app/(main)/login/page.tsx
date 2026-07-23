import type { Metadata } from "next";
import Link from "next/link";
import { PasswordField } from "@/components/PasswordField";
import {
  MailIcon,
  ShieldCheckIcon,
  IconBadge,
  StarIcon,
  GoogleLogo,
  LinkedInLogo,
} from "@/components/LoginIcons";

// A real, crawlable /login route (not a modal), rendered inside the normal
// sidebar/navbar/footer app shell like every other page. Design-only (see
// /DESIGN.md): no /api/auth/* backend exists yet, so both forms are static.
//
// Tab state is a query param (?tab=signin|signup), not client state — that
// makes both "Sign in" and "Create account" real, distinct, linkable URLs
// rather than JS-only toggle states, and needs zero client JS to work.
export const metadata: Metadata = {
  title: "Sign in or create an account",
  description: "Sign in to Zobhira or create a free account to save roles, apply, and track applications.",
  robots: { index: false, follow: true }, // auth forms have no search value of their own
};

// Exact icon PNGs supplied for this mockup (apps/web/public/icons/), not
// inline SVG — see /DESIGN.md for why this is a deliberate exception to the
// no-icon-library/binary-asset pattern used everywhere else in the app.
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
  const tab = searchParams.tab === "signup" ? "signup" : "signin";
  const prefillEmail = searchParams.email ?? "";

  return (
    <main style={{ maxWidth: 1600, margin: "0 auto", padding: "10px 0px 0px", display: "flex", alignItems: "center", minHeight: "calc(100vh - 65px)" }}>
      {/* justifyContent: center (not width: 100% + flex-start) — once both
          columns hit their own maxWidth, leftover row space would otherwise
          sit entirely on the right, making the left/right margins uneven.
          No forced height here — the row sizes to its tallest column's
          actual content (the left column, ending at the Live Opportunities
          badge), and align-items: stretch (the flex default) makes the
          right auth card match that natural height rather than the full
          viewport. */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 40, width: "100%" }}>
        {/* Left: illustration + copy — desktop only. Width is capped (rather
            than letting flex stretch it) so the image scales down as a
            whole — no cropping, just smaller. */}
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
                Your Career Journey <span style={{ color: "var(--color-accent)" }}>Starts Here</span>
              </h1>
              <p style={{ fontSize: 14, lineHeight: 1.45, color: "var(--color-text-)", margin: "0 0 10px" }}>
                Discover jobs, hackathons, learning opportunities, <br></br> prizes, and placements — all
                in one trusted <br></br> platform for students and professionals.
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

          <div
            className="login-feature-grid"
            style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}
          >
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
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "5px 20px",
                fontSize: 12,
                color: "var(--color-text-dark)",
                fontWeight: 600,
                background: "#fff",
                borderRadius: "var(--radius-full)",
                boxShadow: "var(--shadow-md)",
              }}
            >
              <StarIcon /> Live Opportunities
            </span>
          </div>
        </div>

        {/* Right: auth form — wrapped in its own card (light shadow, rounded
            corners via .card) so it reads as a distinct panel; the perspective
            lives on this static outer wrapper while the actual flip animation
            plays on the inner card below, which remounts (key={tab}) each time
            the tab changes. Direction differs by destination tab: going to
            "Create Account" flips in from the right, going back to "Log In"
            flips in from the left — a consistent, stateless way to alternate
            direction without tracking the previous tab. */}
        <div
          style={{
            flex: "1 1 260px",
            maxWidth: 420,
            display: "flex",
            flexDirection: "column",
            perspective: 1400,
          }}
        >
          <div
            key={tab}
            className={`card auth-flip-card ${tab === "signup" ? "auth-flip-from-right" : "auth-flip-from-left"}`}
            style={{ padding: 28, height: "100%", justifyContent: "center" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/zobhira-logo-light.png" alt="Zobhira" style={{ height: 32, width: "auto", borderRadius: "" }} />
              {tab === "signup" && (
                <Link
                  href="/login"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--color-accent)",
                    textDecoration: "underline",
                  }}
                >
                  &larr; Back to Sign In
                </Link>
              )}
            </div>
            {tab === "signin" ? (
              <>
                <h2 style={{ margin: "0 0 2px", fontSize: 21 }}>Welcome Back</h2>
                <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--color-text-muted)" }}>
                  Sign in to continue your journey.
                </p>
                <form className="notched-form" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="field">
                    <label htmlFor="signin-email">Email address</label>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)", display: "flex" }}>
                        <MailIcon />
                      </span>
                      <input className="input" id="signin-email" type="email" placeholder="you@example.com" style={{ paddingLeft: 36, height: 40 }} />
                    </div>
                  </div>
                  <PasswordField label="Password" placeholder="••••••••" />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
                      <input type="checkbox" defaultChecked style={{ accentColor: "var(--color-accent)" }} />
                      Remember me
                    </label>
                    <a href="#" style={{ color: "var(--color-accent)", fontWeight: 600 }}>
                      Forgot password?
                    </a>
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: "100%", height: 40, marginTop: 2 }}>
                    Sign In
                  </button>
                  <Link href="/login?tab=signup" className="btn btn-secondary" style={{ width: "100%", height: 40, textDecoration: "none" }}>
                    Create Account
                  </Link>
                </form>
              </>
            ) : (
              <>
                <h2 style={{ margin: "0 0 2px", fontSize: 21 }}>Create an account</h2>
                <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--color-text-muted)" }}>
                  Join Zobhira to save roles, apply, and track your applications.
                </p>
                <form className="notched-form" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 10 }}>
                    <div className="field" style={{ flex: 1 }}>
                      <label htmlFor="signup-fname">First name</label>
                      <input className="input" id="signup-fname" type="text" placeholder="Jane" style={{ height: 40 }} />
                    </div>
                    <div className="field" style={{ flex: 1 }}>
                      <label htmlFor="signup-lname">Last name</label>
                      <input className="input" id="signup-lname" type="text" placeholder="Doe" style={{ height: 40 }} />
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="signup-email">Email address</label>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)", display: "flex" }}>
                        <MailIcon />
                      </span>
                      <input
                        className="input"
                        id="signup-email"
                        type="email"
                        placeholder="you@example.com"
                        defaultValue={prefillEmail}
                        style={{ paddingLeft: 36, height: 40 }}
                      />
                    </div>
                  </div>
                  <PasswordField label="Password" placeholder="Create a secure password" />
                  <button type="submit" className="btn btn-primary" style={{ width: "100%", height: 40, marginTop: 2 }}>
                    Create Account
                  </button>
                </form>
                <p style={{ marginTop: 4, fontSize: 10, lineHeight: 1.3, color: "var(--color-text-muted)", textAlign: "center" }}>
                  By creating an account, you agree to our{" "}
                  <Link href="/privacy" style={{ color: "var(--color-accent)" }}>Terms</Link> and{" "}
                  <Link href="/privacy" style={{ color: "var(--color-accent)" }}>Privacy Policy</Link>.
                </p>
              </>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "14px 0" }}>
              <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
              <span style={{ fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>
                Or continue with
              </span>
              <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <button type="button" className="btn btn-secondary" style={{ height: 40 }}>
                <GoogleLogo /> Google
              </button>
              <button type="button" className="btn btn-secondary" style={{ height: 40 }}>
                <LinkedInLogo /> LinkedIn
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 11, color: "var(--color-text-muted)" }}>
              <ShieldCheckIcon size={13} />
              Secure login &bull; Reliable platform &bull; Career-focused
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
