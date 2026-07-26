import Link from "next/link";
import type { JobListItem } from "@/lib/jobQuery";
import { CompanyLogo } from "./CompanyLogo";

// New promotional section ported from the Stitch "Mood Board: Institutional
// Reliability" (768px variant) screen — added below the existing home page
// sections per the guardrail: additive only, nothing above this component
// was touched. Two image slots (hero backdrop, "Work in Startups" banner)
// are placeholder blocks pending real generated assets (see chat for the
// image-generation prompts) — swap the background-image URL in once
// available. Company logos in the mockup (Apple/Google/Amazon/Meta/SAP/
// Verizon) were real trademarks; "Fresh This Week" instead uses real
// scraped jobs (same data already fetched for "Featured roles" above), and
// "Connect with Top Employers" uses generic text wordmarks, not real brand
// logos — consistent with the no-third-party-branding stance elsewhere.

const EMPLOYER_WORDMARKS = ["Northwind", "Vertex", "Meridian", "Solstice", "Orbital", "Lumen", "Cobalt", "Anchorpoint"];

const SALARY_BANDS = [
  { label: "Entry", value: 6 },
  { label: "Junior", value: 10 },
  { label: "Mid", value: 16 },
  { label: "Senior", value: 24 },
  { label: "Staff", value: 34 },
  { label: "Lead", value: 44 },
  { label: "Principal", value: 58 },
];

function BookOpenIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5c3-1.3 6-1.3 9 0 3-1.3 6-1.3 9 0v14c-3-1.3-6-1.3-9 0-3-1.3-6-1.3-9 0V5Z" />
      <path d="M12 5v14" />
    </svg>
  );
}
function LayersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </svg>
  );
}
function CloudIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 18a4.5 4.5 0 0 1-.5-8.98A5.5 5.5 0 0 1 17.3 8.1 4 4 0 0 1 17 18H7Z" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

const LEARNING_PATHS = [
  { Icon: BookOpenIcon, title: "React Developer", subtitle: "Tech Certification", q: "react" },
  { Icon: LayersIcon, title: "Python Data Science", subtitle: "Python Certification", q: "python" },
  { Icon: CloudIcon, title: "Cloud Solutions Architect", subtitle: "Tech Certification", q: "cloud" },
];

const AVATAR_SEED_NAMES = ["Priya", "Daniel", "Wei", "Fatima", "Marcus", "Anna"];
const AVATAR_COLORS = ["#003366", "#1f477b", "#4a4a4a", "#001e40", "#3a5f94", "#5e5e5e"];

export function CareerExcellenceSection({ jobs }: { jobs: JobListItem[] }) {
  const freshJobs = jobs.slice(0, 6);
  const maxSalary = Math.max(...SALARY_BANDS.map((b) => b.value));

  return (
    <section style={{ maxWidth: 1280, margin: "0 auto", padding: "8px 24px 0" }}>
      {/* Hero banner */}
      <div
        style={{
          position: "relative",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
          minHeight: 320,
          display: "flex",
          alignItems: "center",
          padding: "40px 40px",
          // Placeholder gradient standing in for the generated hero photo —
          // swap to backgroundImage: `url(...)` once the asset exists.
          background: "linear-gradient(120deg, var(--color-accent-dark) 0%, var(--color-accent) 55%, #1f477b 100%)",
        }}
      >
        <div style={{ position: "relative", maxWidth: 480 }}>
          <h2 style={{ margin: "0 0 18px", fontSize: "clamp(26px,4vw,36px)", lineHeight: 1.15, color: "#fff" }}>
            The Future of Professional Excellence
          </h2>
          <form
            method="get"
            action="/jobs"
            style={{ display: "flex", gap: 8, background: "#fff", padding: 6, borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-md)" }}
          >
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "0 10px", color: "var(--ink-faint)" }}>
              <SearchIcon />
              <input
                type="text"
                name="q"
                placeholder="Search jobs, skills, or companies"
                style={{ flex: 1, border: "none", outline: "none", fontSize: 14, padding: "10px 0", background: "transparent", color: "var(--ink)" }}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ flexShrink: 0 }}>
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Fresh This Week */}
      <div style={{ marginTop: 40 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 22 }}>Fresh This Week</h3>
        <div style={{ display: "flex", gap: 14, overflowX: "auto", padding: "2px 2px 14px" }}>
          {freshJobs.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="card"
              style={{ flex: "0 0 220px", textDecoration: "none", color: "inherit" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <CompanyLogo logoUrl={job.logoUrl} company={job.company} size={36} />
                <span className="tag tag-accent">New</span>
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)", marginTop: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {job.title}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2 }}>
                {job.company} · {job.location ?? "Remote"}
              </div>
              {job.workplaceType !== "unknown" && (
                <span className="tag tag-outline" style={{ marginTop: 8, textTransform: "capitalize" }}>
                  {job.workplaceType}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* Connect with Top Employers */}
      <div style={{ marginTop: 40, display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h3 style={{ margin: "0 0 16px", fontSize: 22 }}>Connect with Top Employers</h3>
          <Link href="/jobs" className="btn btn-primary" style={{ textDecoration: "none" }}>
            Join the Network
          </Link>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 28px", maxWidth: 560 }}>
          {EMPLOYER_WORDMARKS.map((name) => (
            <span key={name} style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-faint)", fontFamily: "var(--font-display)" }}>
              {name}
            </span>
          ))}
        </div>
      </div>

      {/* Work in Startups */}
      <div style={{ marginTop: 40 }}>
        <h3 style={{ margin: "0 0 2px", fontSize: 22 }}>Work in Startups</h3>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--ink-muted)" }}>Creative in emerging tech</p>
        <div
          style={{
            position: "relative",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            minHeight: 220,
            // Placeholder diagonal pattern standing in for the generated
            // team-photo banner — swap to backgroundImage once available.
            background:
              "repeating-linear-gradient(115deg, var(--color-surface-muted) 0 34px, var(--color-divider) 34px 40px, var(--color-accent-soft) 40px 74px)",
            display: "flex",
            alignItems: "flex-end",
            padding: 20,
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {["AI Research Scientist", "Fintech Product Manager", "Cloud Architect"].map((role) => (
              <span
                key={role}
                style={{
                  padding: "8px 14px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-accent-dark)",
                  color: "#fff",
                  fontSize: 12.5,
                  fontWeight: 600,
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                {role}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Earning Power + Earning & Learning */}
      <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
        <div className="card">
          <h3 style={{ margin: "0 0 2px", fontSize: 18 }}>Earning Power</h3>
          <p style={{ margin: "0 0 18px", fontSize: 12.5, color: "var(--ink-muted)" }}>Interactive salary trajectories</p>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 160 }}>
            {SALARY_BANDS.map((band) => (
              <div key={band.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink-muted)" }}>${band.value}L</span>
                <div
                  style={{
                    width: "100%",
                    height: `${(band.value / maxSalary) * 100}%`,
                    borderRadius: "var(--radius-sm) var(--radius-sm) 0 0",
                    background: band.label === "Principal" ? "var(--accent)" : "var(--color-surface-muted)",
                  }}
                />
                <span style={{ fontSize: 10.5, color: "var(--ink-faint)" }}>{band.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 style={{ margin: "0 0 14px", fontSize: 18 }}>Earning &amp; Learning</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {LEARNING_PATHS.map(({ Icon, title, subtitle, q }) => (
              <Link
                key={title}
                href={`/jobs?q=${encodeURIComponent(q)}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-surface-muted)",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <span style={{ color: "var(--accent)", flexShrink: 0 }}>
                  <Icon />
                </span>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>{title}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-muted)" }}>{subtitle}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Join Our Community */}
      <div style={{ marginTop: 56, marginBottom: 8, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          {AVATAR_SEED_NAMES.map((name, i) => (
            <div
              key={name}
              title={name}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                marginLeft: i === 0 ? 0 : -10,
                border: "2px solid var(--surface)",
                background: AVATAR_COLORS[i % AVATAR_COLORS.length],
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              {name[0]}
            </div>
          ))}
        </div>
        <h3 style={{ margin: "18px 0 18px", fontSize: 24 }}>Join Our Community</h3>
        <Link href="/login?tab=signup" className="btn btn-primary" style={{ textDecoration: "none" }}>
          Join Our Community
        </Link>
      </div>
    </section>
  );
}
