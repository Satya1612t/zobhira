import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Today on Zobhira",
  description: "New roles added today, contests closing this week, and the cities hiring most right now.",
  robots: { index: false, follow: true },
};

// Cached, not force-dynamic — a 60s revalidate is fresh enough for daily
// stats without hitting Postgres on every single view.
export const revalidate = 60;

export default async function TodayOnZobhiraPage() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [jobsCount, contestsCount, newRolesToday, contestsClosingThisWeek, cityGroups] = await Promise.all([
    prisma.job.count({ where: { isActive: true } }),
    prisma.contest.count({ where: { isActive: true } }),
    prisma.job.count({ where: { isActive: true, firstSeenAt: { gte: since } } }),
    prisma.contest.count({ where: { isActive: true, deadlineAt: { gte: new Date(), lte: weekFromNow } } }),
    prisma.job.groupBy({
      by: ["location"],
      where: { isActive: true, location: { not: null } },
      _count: { location: true },
      orderBy: { _count: { location: "desc" } },
      take: 5,
    }),
  ]);

  const topCities = cityGroups
    .filter((c) => c.location)
    .map((c) => ({ city: c.location as string, count: c._count.location }));

  return (
    <main className="container" style={{ paddingBlock: 32, maxWidth: 900 }}>
      <span className="kicker">TODAY ON ZOBHIRA</span>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", fontWeight: 700, margin: "10px 0 8px" }}>
        Today on Zobhira
      </h1>
      <p style={{ color: "var(--color-text-muted)", fontSize: 14.5, margin: "0 0 24px", maxWidth: "60ch" }}>
        A quick look at what&apos;s moving right now.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div className="job-card" style={{ padding: 22 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 6 }}>New roles today</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-2xl)", color: "var(--color-accent)", fontVariantNumeric: "tabular-nums" }}>{newRolesToday.toLocaleString()}</div>
        </div>
        <div className="job-card" style={{ padding: 22 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 6 }}>Contests closing this week</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-2xl)", color: "var(--color-accent)", fontVariantNumeric: "tabular-nums" }}>{contestsClosingThisWeek.toLocaleString()}</div>
        </div>
        <div className="job-card" style={{ padding: 22 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 6 }}>Jobs open right now</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-2xl)", color: "var(--color-accent)", fontVariantNumeric: "tabular-nums" }}>{jobsCount.toLocaleString()}</div>
        </div>
        <div className="job-card" style={{ padding: 22 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 6 }}>Contests open right now</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-2xl)", color: "var(--color-accent)", fontVariantNumeric: "tabular-nums" }}>{contestsCount.toLocaleString()}</div>
        </div>
      </div>

      {topCities.length > 0 && (
        <>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-xl)", margin: "0 0 14px" }}>
            Cities hiring most right now
          </h2>
          <div className="job-card" style={{ padding: "6px 20px", marginBottom: 24 }}>
            {topCities.map((c, i) => (
              <div
                key={c.city}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 0",
                  borderTop: i === 0 ? "none" : "1px solid var(--color-divider)",
                  fontSize: 14,
                }}
              >
                <span>{c.city}</span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-muted)", fontVariantNumeric: "tabular-nums" }}>
                  {c.count.toLocaleString()} open
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
