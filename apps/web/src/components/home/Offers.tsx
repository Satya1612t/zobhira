import Link from "next/link";
import { Reveal } from "@/components/ui/Reveal";

const SEGMENTS = [
  {
    kicker: "Students & freshers",
    title: "First job? Start here.",
    body: "Filter to fresher and internship roles in one tap. Enter a contest, build something real, and give recruiters a reason to say yes.",
    cta: "See fresher jobs",
    href: "/jobs?experienceLevel=fresher",
    tint: "var(--color-accent-tint)",
  },
  {
    kicker: "Working professionals",
    title: "Ready to move?",
    body: "Filter by experience and remote policy. Hide anything older than a week so you only see what's actually open.",
    cta: "See senior roles",
    href: "/jobs?experienceLevel=senior",
    tint: "var(--color-signal-soft)",
  },
  {
    kicker: "Switching fields",
    title: "Changing tracks?",
    body: "Browse 58 different roles across 15 areas. See what's hiring and what it pays before you commit.",
    cta: "Explore roles",
    href: "/jobs",
    tint: "var(--color-success-soft)",
  },
];

export function Offers() {
  return (
    <section className="section section--sunken">
      <div className="container">
        <Reveal>
          <span className="kicker">WHO IT'S FOR</span>
          <h2 style={{ fontSize: "var(--text-3xl)", margin: "10px 0 32px" }}>Find your starting point</h2>
        </Reveal>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, marginBottom: 24 }}>
          {SEGMENTS.map((s, i) => (
            <Reveal key={s.kicker} delay={0.08 * i}>
              <div
                className="shape-blob"
                style={{
                  background: s.tint,
                  padding: 28,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  transform: i % 2 === 1 ? "scaleX(-1)" : undefined,
                }}
              >
                <div style={{ transform: i % 2 === 1 ? "scaleX(-1)" : undefined }}>
                  <span className="kicker" style={{ color: "var(--color-accent)" }}>{s.kicker}</span>
                  <h3 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", margin: "8px 0 8px" }}>{s.title}</h3>
                  <p style={{ color: "var(--color-text-muted)", fontSize: 13.5, lineHeight: 1.6, margin: "0 0 16px" }}>{s.body}</p>
                  <Link href={s.href} style={{ color: "var(--color-accent)", fontWeight: 600, fontSize: 13.5, textDecoration: "none" }}>
                    {s.cta} &rarr;
                  </Link>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.24}>
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              background: "var(--gradient-signal)",
              color: "var(--color-ink-900)",
              borderRadius: "var(--radius-2xl)",
              padding: "36px 40px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div className="deco-ring" style={{ width: 140, height: 140, right: -40, top: -50, borderColor: "rgba(11,20,32,0.25)" }} aria-hidden="true" />
            <div>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-xl)", margin: "0 0 6px" }}>Free. All of it.</h3>
              <p style={{ fontSize: 14, lineHeight: 1.55, margin: 0, maxWidth: "50ch" }}>
                No fee, no paywall, no account needed to search. Sign in only if you want alerts
                and saved jobs.
              </p>
            </div>
            <Link href="/jobs" className="btn" style={{ background: "var(--color-ink-900)", color: "#fff", textDecoration: "none", flexShrink: 0 }}>
              Start searching
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
