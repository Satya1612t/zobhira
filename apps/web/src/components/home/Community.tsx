import Link from "next/link";
import { AspectBox } from "@/components/ui/AspectBox";
import { Figure } from "@/components/ui/Figure";
import { Reveal } from "@/components/ui/Reveal";
import { CountUp } from "@/components/ui/CountUp";

// The three photo frames use generic stock-style photography, not named
// individuals or fabricated testimonials — no invented "N people online
// right now" claims; the one stat shown is a real total from SearchQuery.
export function Community({ popularSearches, totalSearches }: { popularSearches: string[]; totalSearches: number }) {
  return (
    <section className="section">
      <div className="container" style={{ display: "grid", gridTemplateColumns: "5fr 7fr", gap: "clamp(24px, 4vw, 48px)", alignItems: "end" }} id="community-grid">
        <Reveal>
          <span className="kicker">YOU&apos;RE NOT ALONE</span>
          <h2 style={{ fontSize: "var(--text-3xl)", margin: "10px 0 12px" }}>Thousands are searching the same roles today</h2>
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-base)", lineHeight: 1.6, margin: "0 0 20px", maxWidth: "42ch" }}>
            See what everyone is looking for right now. Popular searches update through the day,
            so you can tell which skills are actually in demand this week.
          </p>
          {popularSearches.length > 0 && (
            <div className="cluster" style={{ marginBottom: 24 }}>
              <span style={{ width: "100%", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.06em", color: "var(--color-text-muted)", marginBottom: 4 }}>
                TRENDING SEARCHES TODAY
              </span>
              {popularSearches.map((term) => (
                <Link key={term} href={`/jobs?q=${encodeURIComponent(term)}`} className="chip chip--accent" style={{ textDecoration: "none" }}>
                  {term}
                </Link>
              ))}
            </div>
          )}
          <Link href="/login" className="btn btn-primary" style={{ textDecoration: "none" }}>
            Join them &rarr;
          </Link>
        </Reveal>

        <div style={{ position: "relative" }}>
          <div style={{ width: "calc((100% - 10px) / 3)" }}>
            <AspectBox ratio="4/7.5" style={{ visibility: "hidden" }}>{null}</AspectBox>
          </div>

          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: "-30%", display: "flex", alignItems: "flex-end", gap: 5 }} className="community-collage">
            <div style={{ flex: 1, position: "relative" }}>
              <AspectBox ratio="4/5" style={{ visibility: "hidden" }}>{null}</AspectBox>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
                <AspectBox ratio="4/9" className="shape-arch" style={{ boxShadow: "var(--shadow-lg)" }}>
                  <Figure src="/images/community-1.png" alt="" shape="arch" />
                </AspectBox>
              </div>
            </div>
            <div style={{ flex: 1, position: "relative" }}>
              <AspectBox ratio="4/5" style={{ visibility: "hidden" }}>{null}</AspectBox>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
                <AspectBox ratio="4/7" className="shape-arch" style={{ boxShadow: "var(--shadow-lg)" }}>
                  <Figure src="/images/community-3.png" alt="" shape="arch" />
                </AspectBox>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <AspectBox ratio="4/5" className="shape-arch" style={{ boxShadow: "var(--shadow-lg)" }}>
                <Figure src="/images/community-2.png" alt="" shape="arch" />
              </AspectBox>
            </div>

            {totalSearches > 0 && (
              <div
                style={{
                  position: "absolute",
                  bottom: 12,
                  right: "2%",
                  background: "var(--color-surface)",
                  borderRadius: "var(--radius-md)",
                  boxShadow: "var(--shadow-lg)",
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  zIndex: 2,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "var(--radius-full)", background: "var(--color-success)", flexShrink: 0 }} />
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>
                    <CountUp value={totalSearches} suffix="+" />
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-text-muted)" }}>searches run on Zobhira</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
