import Link from "next/link";
import type { JobListItem } from "@/lib/jobQuery";
import { JobGridCard } from "@/components/JobGridCard";
import { CompanyLogo } from "@/components/CompanyLogo";
import { Reveal } from "@/components/ui/Reveal";

const FILTERS = [
  { label: "Remote", href: "/jobs?workplaceType=remote" },
  { label: "Fresher", href: "/jobs?experienceLevel=fresher" },
  { label: "Bangalore", href: "/jobs?location=Bangalore" },
  { label: "Full-time", href: "/jobs?workplaceType=onsite" },
];

export function FeaturedRoles({ jobs, jobsCount }: { jobs: JobListItem[]; jobsCount: number }) {
  if (jobs.length === 0) return null;
  const [featured, ...rest] = jobs;

  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="container">
        <Reveal>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 10 }}>
            <div>
              <span className="kicker">POSTED TODAY</span>
              <h2 style={{ fontSize: "var(--text-3xl)", margin: "10px 0 6px" }}>Fresh openings, first look</h2>
              <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-base)", margin: 0, maxWidth: "48ch" }}>
                These went live in the last few days. Not many people have seen them yet.
              </p>
            </div>
            <Link href="/jobs" style={{ color: "var(--color-accent)", fontWeight: 600, fontSize: 14, textDecoration: "none", whiteSpace: "nowrap" }}>
              See all {jobsCount.toLocaleString()} jobs &rarr;
            </Link>
          </div>
          <div className="cluster" style={{ marginBottom: 28 }}>
            {FILTERS.map((f) => (
              <Link key={f.label} href={f.href} className="chip" style={{ background: "var(--color-surface-muted)", color: "var(--color-text-muted)", textDecoration: "none" }}>
                {f.label}
              </Link>
            ))}
          </div>
        </Reveal>

        <div className="featured-roles-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
          <Reveal className="featured-roles-card--large">
            <div style={{ position: "relative", height: "100%" }}>
              <span className="chip chip--signal" style={{ position: "absolute", top: 14, left: 14, zIndex: 1 }}>
                Top pick
              </span>
              <div style={{ display: "flex", gap: 16, alignItems: "center", padding: 24, height: "100%", background: "var(--color-surface)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)" }}>
                <CompanyLogo logoUrl={featured.logoUrl} company={featured.company} size={56} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-lg)" }}>{featured.title}</div>
                  <div style={{ color: "var(--color-accent)", fontSize: 13.5, fontWeight: 600, margin: "2px 0 8px" }}>{featured.company}</div>
                  {featured.description && (
                    <p style={{ color: "var(--color-text-muted)", fontSize: 13, lineHeight: 1.5, margin: 0, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                      {featured.description}
                    </p>
                  )}
                  <Link href={`/jobs/${featured.id}`} className="btn btn-secondary" style={{ marginTop: 12, textDecoration: "none" }}>
                    View role
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
          {rest.map((job, i) => (
            <Reveal key={job.id} delay={0.06 * (i + 1)}>
              <JobGridCard job={job} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
