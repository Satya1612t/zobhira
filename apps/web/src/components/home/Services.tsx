import Link from "next/link";
import { AspectBox } from "@/components/ui/AspectBox";
import { Figure } from "@/components/ui/Figure";
import { Reveal } from "@/components/ui/Reveal";
import { ServiceLottieVisual } from "@/components/home/ServiceSearchVisual";
import { SHOW_UNRELEASED_NAV } from "@/lib/authNavFlags";

// Its visual is a Lottie animation (ServiceLottieVisual), not a stock
// image, so it has no `image` field.
const BIG_CARD = {
  title: "Search once, see everything",
  body: "Type what you want. Filter by city, remote or office, how new it is, and how much experience it needs.",
  href: "/jobs",
  cta: "Find jobs",
  lottieSrc: "https://lottie.host/8506e694-051a-4b54-851a-432f2de27ad7/mS6RHMzTow.lottie",
  lottieScale: 1.3,
};

type SmallCard = {
  title: string;
  body: string;
  href: string;
  cta: string;
  lottieSrc: string;
};

const SMALL_CARDS: SmallCard[] = [
  // Contests aren't ready for production yet — same gate as the nav links
  // that point at /contest (see authNavFlags.ts).
  ...(SHOW_UNRELEASED_NAV
    ? [
        {
          title: "Contests worth entering",
          body: "Hackathons and coding contests that are still open, with the deadline, prize, and who can join shown up front.",
          lottieSrc: "https://lottie.host/b0510d17-19c1-4344-9acf-28c8e41b3a5f/zPwA7LJgts.lottie",
          href: "/contest",
          cta: "See contests",
        },
      ]
    : []),
  {
    title: "Job posts you can actually read",
    body: "Long job posts get cleaned up. Salary, experience, and requirements sit right at the top so you know in ten seconds if it's for you.",
    lottieSrc: "https://lottie.host/8f011dc6-d631-474e-af88-9a1e494bd3d6/isg7JqyXS7.lottie",
    href: "/jobs",
    cta: "Try it",
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
  const big = BIG_CARD;
  const rest = SMALL_CARDS;
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
              <AspectBox ratio="1/1">
                <ServiceLottieVisual src={big.lottieSrc} scale={big.lottieScale} />
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
                  <div style={{ width: 108, flexShrink: 0 }}>
                    <AspectBox ratio="1/1" className="shape-squircle">
                      <ServiceLottieVisual src={card.lottieSrc} scale={0.9} />
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

            {/* Fills the leftover vertical space below the stacked small
                cards — the right column's natural height (two compact
                horizontal cards) falls short of the big card's, leaving a
                visible gap in the grid row otherwise. */}
            <Reveal delay={0.08 * (rest.length + 1)} style={{ flex: 1, minHeight: 160 }}>
              <Link
                href="/jobs"
                className="shape-blob services-card"
                style={{ display: "block", position: "relative", height: "100%", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}
              >
                <Figure src="/images/service-team-results.png" alt="" shape="none" />
              </Link>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
