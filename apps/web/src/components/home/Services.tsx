import Link from "next/link";
import { AspectBox } from "@/components/ui/AspectBox";
import { Figure } from "@/components/ui/Figure";
import { Reveal } from "@/components/ui/Reveal";

const CARDS = [
  {
    title: "Search once, see everything",
    body: "Type what you want. Filter by city, remote or office, how new it is, and how much experience it needs.",
    image: "/images/service-search.png",
    href: "/jobs",
    cta: "Find jobs",
    large: true,
  },
  {
    title: "Contests worth entering",
    body: "Hackathons and coding contests that are still open, with the deadline, prize, and who can join shown up front.",
    image: "/images/service-contests.png",
    href: "/contest",
    cta: "See contests",
    large: false,
  },
  {
    title: "Job posts you can actually read",
    body: "Long job posts get cleaned up. Salary, experience, and requirements sit right at the top so you know in ten seconds if it's for you.",
    image: "/images/service-parse.png",
    href: "/jobs",
    cta: "Try it",
    large: false,
  },
];

// A <span>, not a nested <Link> — the whole card is already an <a> (see
// below), and an <a> inside an <a> is invalid HTML. Browsers silently
// "correct" that during parsing, which is exactly what was causing a
// server/client hydration mismatch here. Purely visual affordance; the
// parent link already goes to the same href.
function ArrowAffordance({ children }: { children: React.ReactNode }) {
  return (
    <span className="services-arrow-link" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--color-accent)", fontWeight: 600, fontSize: 14 }}>
      {children}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="services-arrow-icon" style={{ transition: "transform .15s ease" }}>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </span>
  );
}

export function Services() {
  const [big, ...rest] = CARDS;
  return (
    <section className="section">
      <div className="container">
        <Reveal>
          <div className="deco-dotgrid" style={{ position: "absolute", width: 120, height: 60, marginTop: -20 }} aria-hidden="true" />
          <span className="kicker">WHAT YOU GET</span>
          <h2 style={{ fontSize: "var(--text-3xl)", margin: "10px 0 8px" }}>Everything in one place</h2>
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-base)", lineHeight: 1.6, margin: "0 0 24px", maxWidth: "48ch" }}>
            Jobs, internships and contests on one page. Search once instead of checking ten sites.
          </p>
        </Reveal>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "5fr 7fr",
            gap: 20,
          }}
          className="services-grid"
        >
          <Reveal>
            <Link
              href={big.href}
              className="shape-blob services-card services-card--large"
              style={{
                display: "flex",
                flexDirection: "column",
                background: "var(--color-surface)",
                boxShadow: "var(--shadow-sm)",
                textDecoration: "none",
                color: "inherit",
                height: "100%",
                overflow: "hidden",
              }}
            >
              <AspectBox ratio="4/3">
                <Figure src={big.image} alt="" shape="none" />
              </AspectBox>
              <div style={{ padding: 24 }}>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-xl)", margin: "0 0 8px" }}>{big.title}</h3>
                <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-base)", lineHeight: 1.6, margin: "0 0 14px" }}>{big.body}</p>
                <ArrowAffordance>{big.cta}</ArrowAffordance>
              </div>
            </Link>
          </Reveal>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {rest.map((card, i) => (
              <Reveal key={card.title} delay={0.08 * (i + 1)}>
                <Link
                  href={card.href}
                  className="shape-blob services-card"
                  style={{
                    display: "flex",
                    gap: 20,
                    alignItems: "center",
                    background: "var(--color-surface)",
                    boxShadow: "var(--shadow-sm)",
                    textDecoration: "none",
                    color: "inherit",
                    padding: 20,
                  }}
                >
                  <div style={{ width: 140, flexShrink: 0 }}>
                    <AspectBox ratio="4/3" className="shape-arch">
                      <Figure src={card.image} alt="" shape="arch" />
                    </AspectBox>
                  </div>
                  <div>
                    <h3 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", margin: "0 0 6px" }}>{card.title}</h3>
                    <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", lineHeight: 1.55, margin: "0 0 10px" }}>{card.body}</p>
                    <ArrowAffordance>{card.cta}</ArrowAffordance>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
