import Link from "next/link";

// Rewritten for the "Editorial Signal" homepage redesign — full-bleed dark
// section, no client JS needed (plain GET form to /login, same pattern as
// before). See /DESIGN.md.
export function HomeSignupCta({ jobsCount, contestsCount }: { jobsCount: number; contestsCount: number }) {
  return (
    <section className="section section--dark deco-grain" data-theme="dark" style={{ position: "relative", overflow: "hidden", textAlign: "center" }}>
      <div className="deco-blur-orb deco-blur-orb--accent" style={{ top: "-100px", left: "-100px" }} aria-hidden="true" />
      <div className="deco-blur-orb deco-blur-orb--signal" style={{ bottom: "-140px", right: "-100px" }} aria-hidden="true" />

      <div className="container" style={{ position: "relative", maxWidth: 720 }}>
        <h2 style={{ fontSize: "var(--text-4xl)", margin: "0 0 14px", color: "var(--color-text-onDark)" }}>
          Somebody gets hired for it this week. Make it you.
        </h2>
        <p style={{ fontSize: "var(--text-lg)", color: "var(--color-text-onDark-muted)", margin: "0 0 32px" }}>
          Free to search. No account needed. Takes ten seconds.
        </p>

        <div className="cluster" style={{ justifyContent: "center", marginBottom: 32 }}>
          <Link href="/jobs" className="btn btn-signal" style={{ textDecoration: "none" }}>
            Find jobs
          </Link>
          <Link
            href="/contest"
            className="btn"
            style={{ textDecoration: "none", border: "1px solid var(--color-divider-onDark)", color: "var(--color-text-onDark)" }}
          >
            Browse contests
          </Link>
        </div>

        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-onDark)", margin: "0 0 10px" }}>
          Get tomorrow&apos;s jobs in your inbox
        </p>
        <form
          method="get"
          action="/login"
          style={{ display: "flex", gap: 8, maxWidth: 420, margin: "0 auto 10px", flexWrap: "wrap", justifyContent: "center" }}
        >
          <input type="hidden" name="tab" value="signup" />
          <input
            className="input"
            type="email"
            name="email"
            placeholder="you@example.com"
            style={{ flex: "1 1 220px", borderRadius: "var(--radius-full)", background: "rgba(255,255,255,0.08)", border: "1px solid var(--color-divider-onDark)", color: "var(--color-text-onDark)" }}
          />
          <button type="submit" className="btn btn-primary" style={{ borderRadius: "var(--radius-full)", flexShrink: 0 }}>
            Get job alerts
          </button>
        </form>
        <p style={{ fontSize: 12, color: "var(--color-text-onDark-muted)", margin: "0 0 36px" }}>
          One email a week. Unsubscribe in one click.
        </p>

        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-onDark-muted)" }}>
          {jobsCount.toLocaleString()} jobs open &middot; {contestsCount.toLocaleString()} contests open
        </p>
      </div>
    </section>
  );
}
