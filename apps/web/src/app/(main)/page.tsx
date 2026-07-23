import { prisma } from "@/lib/prisma";
import { JobCard } from "@/components/JobCard";
import { JobGridCard } from "@/components/JobGridCard";
import { ContestCard } from "@/components/ContestCard";
import { HomeSignupCta } from "@/components/HomeSignupCta";
import { JOB_SELECT } from "@/lib/jobQuery";
import { CONTEST_SELECT, CONTEST_ORDER_BY } from "@/lib/contestQuery";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [jobsCount, contestsCount, companies, spotlightJob, featuredJobs, featuredContests] =
    await Promise.all([
      prisma.job.count({ where: { isActive: true } }),
      prisma.contest.count({ where: { isActive: true } }),
      prisma.job.groupBy({ by: ["company"], where: { isActive: true } }),
      prisma.job.findFirst({
        where: { isActive: true },
        orderBy: [{ postedAt: "desc" }, { id: "desc" }],
        select: JOB_SELECT,
      }),
      prisma.job.findMany({
        where: { isActive: true },
        orderBy: [{ postedAt: "desc" }, { id: "desc" }],
        take: 8,
        select: JOB_SELECT,
      }),
      prisma.contest.findMany({
        where: { isActive: true },
        orderBy: CONTEST_ORDER_BY,
        take: 4,
        select: CONTEST_SELECT,
      }),
    ]);

  const boardStats = [
    { label: "Live roles", value: jobsCount.toLocaleString() },
    { label: "Live contests", value: contestsCount.toLocaleString() },
    { label: "Companies hiring", value: companies.length.toLocaleString() },
    { label: "Sources aggregated", value: "5" },
  ];

  const kickerStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    fontWeight: 700,
    color: "var(--color-accent)",
    marginBottom: 10,
  };

  return (
    <div>
      {/* Hero */}
      <section
        style={{
          maxWidth: 1160,
          margin: "0 auto",
          padding: "56px 24px 40px",
          display: "flex",
          flexWrap: "wrap",
          gap: 32,
          alignItems: "center",
        }}
      >
        <div style={{ flex: "1 1 420px", minWidth: 260 }}>
          <span style={kickerStyle}>Live roles &amp; contests, aggregated daily</span>
          <h1
            style={{
              fontSize: "clamp(36px,5vw,48px)",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              margin: "0 0 18px",
            }}
          >
            Every open role. Every live contest. One board.
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: "var(--color-text-muted)", maxWidth: "46ch", margin: "0 0 26px" }}>
            Zobhira pulls technical roles and hackathons from across the web into one searchable
            board — refreshed by scrapers around the clock, so what you see is what&apos;s
            actually open right now.
          </p>
          <form
            method="get"
            action="/jobs"
            className="card"
            style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 8, marginBottom: 18 }}
          >
            <input
              className="input"
              type="text"
              name="q"
              placeholder="Job title, keywords, or company"
              style={{ flex: "2 1 200px", minWidth: 160, background: "var(--color-bg)" }}
            />
            <input
              className="input"
              type="text"
              name="location"
              placeholder="City or remote"
              style={{ flex: "1 1 150px", minWidth: 140, background: "var(--color-bg)" }}
            />
            <button type="submit" className="btn btn-primary" style={{ flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              Search
            </button>
          </form>
          <p style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--color-text-muted)", margin: "0 0 22px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            {jobsCount.toLocaleString()}+ live roles tracked right now
          </p>
          <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 24, color: "var(--color-accent)" }}>{jobsCount}</div>
              <div style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>Live roles</div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 24, color: "var(--color-accent)" }}>{contestsCount}</div>
              <div style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>Live contests</div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 24, color: "var(--color-accent)" }}>{companies.length}</div>
              <div style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>Companies hiring</div>
            </div>
          </div>
        </div>
        <div style={{ flex: "1 1 320px", minWidth: 260, maxWidth: 440 }}>
          {spotlightJob ? (
            <>
              <span style={{ ...kickerStyle, marginBottom: 6 }}>Spotlight role</span>
              <JobCard job={spotlightJob} />
            </>
          ) : null}
        </div>
      </section>

      {/* Board status */}
      <section style={{ maxWidth: 1160, margin: "0 auto", padding: "10px 24px 10px" }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <header style={{ padding: "14px 20px", borderBottom: "1px solid var(--color-divider)" }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Zobhira &mdash; board status</span>
          </header>
          <table className="table" style={{ width: "100%", tableLayout: "fixed" }}>
            <tbody>
              {boardStats.map((row) => (
                <tr key={row.label}>
                  <td style={{ padding: "10px 20px" }}>{row.label}</td>
                  <td style={{ padding: "10px 20px", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 20, color: "var(--color-accent)", textAlign: "right", whiteSpace: "nowrap" }}>
                    {row.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Featured jobs */}
      {featuredJobs.length > 0 && (
        <section style={{ maxWidth: 1160, margin: "0 auto", padding: "48px 24px 8px" }}>
          <span style={kickerStyle}>Featured roles</span>
          <h2 style={{ margin: "0 0 16px", fontSize: 24 }}>Fresh this week</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {featuredJobs.map((job) => (
              <JobGridCard key={job.id} job={job} />
            ))}
          </div>
        </section>
      )}

      {/* How it stays current */}
      <section
        style={{
          maxWidth: 1160,
          margin: "0 auto",
          padding: "24px 24px 0",
          display: "flex",
          flexWrap: "wrap",
          gap: "clamp(24px,5vw,72px)",
          alignItems: "center",
        }}
      >
        <div
          style={{
            flex: "1 1 320px",
            minWidth: 260,
            aspectRatio: "4/3",
            borderRadius: "var(--radius-md)",
            background: "var(--color-surface-muted)",
            border: "1px solid var(--color-divider)",
          }}
        />
        <div style={{ flex: "1 1 380px", minWidth: 280 }}>
          <span style={kickerStyle}>How it stays current</span>
          <h2 style={{ margin: "0 0 12px", fontSize: 26 }}>No stale listings, no dead links</h2>
          <p style={{ fontSize: 15, lineHeight: 1.65, color: "var(--color-text-muted)", maxWidth: "48ch", margin: 0 }}>
            Background scrapers sweep every source on their own cadence and reap anything past
            its deadline. What&apos;s on the board is what&apos;s actually still open — not a
            snapshot from three weeks ago.
          </p>
        </div>
      </section>

      {/* Featured contests */}
      {featuredContests.length > 0 && (
        <section style={{ maxWidth: 1160, margin: "0 auto", padding: "48px 24px 8px" }}>
          <span style={kickerStyle}>Featured contests</span>
          <h2 style={{ margin: "0 0 16px", fontSize: 24 }}>Hackathons closing soon</h2>
          <div style={{ display: "flex", gap: 16, overflowX: "auto", padding: "6px 2px 20px" }}>
            {featuredContests.map((contest) => (
              <div key={contest.id} style={{ flex: "0 0 300px" }}>
                <ContestCard contest={contest} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sign-up desk */}
      <section style={{ maxWidth: 1160, margin: "0 auto", padding: "56px 24px 64px" }}>
        <HomeSignupCta />
      </section>
    </div>
  );
}
