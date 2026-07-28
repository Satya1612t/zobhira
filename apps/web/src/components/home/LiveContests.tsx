import Link from "next/link";
import type { ContestListItem } from "@/lib/contestQuery";
import { ContestCard } from "@/components/ContestCard";
import { Reveal } from "@/components/ui/Reveal";

export function LiveContests({ contests }: { contests: ContestListItem[] }) {
  if (contests.length === 0) return null;

  return (
    <section className="section section--sunken">
      <div className="container">
        <Reveal>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
            <div>
              <span className="kicker">CLOSING SOON</span>
              <h2 style={{ fontSize: "var(--text-3xl)", margin: "10px 0 6px" }}>Contests still open for entry</h2>
              <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-base)", margin: 0, maxWidth: "48ch" }}>
                Every contest here is still accepting entries. Closed ones come off the same day.
              </p>
            </div>
            <Link href="/contest" style={{ color: "var(--color-accent)", fontWeight: 600, fontSize: 14, textDecoration: "none", whiteSpace: "nowrap" }}>
              See all contests &rarr;
            </Link>
          </div>
        </Reveal>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
          {contests.map((contest, i) => (
            <Reveal key={contest.id} delay={0.06 * i}>
              <ContestCard contest={contest} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
