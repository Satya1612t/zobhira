import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CompanyLogo } from "@/components/CompanyLogo";
import { FormattedJobDescription } from "@/components/FormattedJobDescription";
import { JobDetailActions } from "@/components/JobDetailActions";
import { extractTechnologies } from "@/lib/jobInsights";
import { JOB_SELECT } from "@/lib/jobQuery";

// Was force-dynamic — this page only changes when a scrape cycle runs or
// the on-demand LLM description-formatting call completes, not on every
// request, so ISR (revalidate every 60s) lets Next.js cache and serve it
// instead of hitting Postgres on every single view.
export const revalidate = 60;

function formatSalary(job: {
  salaryMin: unknown;
  salaryMax: unknown;
  salaryCurrency: string | null;
}): string | null {
  if (!job.salaryMin && !job.salaryMax) return null;
  const currency = job.salaryCurrency ?? "";
  const min = job.salaryMin?.toString();
  const max = job.salaryMax?.toString();
  if (min && max) return `${currency} ${min} - ${max}`;
  return `${currency} ${min ?? max}`;
}

// "Posted 2 days ago" reads better than a bare date for a recency-driven
// board — real data (postedAt), just formatted relatively instead of
// absolutely. No new dependency: the ranges here comfortably cover this
// app's actual freshness window (jobs older than ~15 days are filtered out
// well before this page ever renders them, see scripts/run_scrape.py).
function relativeDate(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Posted today";
  if (days === 1) return "Posted 1 day ago";
  if (days < 30) return `Posted ${days} days ago`;
  const months = Math.floor(days / 30);
  return `Posted ${months} month${months === 1 ? "" : "s"} ago`;
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--ink-faint)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink)" }}>{value}</div>
    </div>
  );
}

export default async function JobDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const job = await prisma.job.findUnique({ where: { id }, select: JOB_SELECT });

  if (!job) notFound();

  const salary = formatSalary(job);
  const technologies = extractTechnologies(job.description);

  // "Similar" = shares at least one tag (designation/skill) with this job,
  // same recency ordering as everywhere else. No tags at all means no
  // similarity signal to go on, so the section is simply skipped rather
  // than falling back to an arbitrary "recent jobs" list that wouldn't
  // actually be similar.
  const similarJobs =
    job.tags.length > 0
      ? await prisma.job.findMany({
          where: { isActive: true, id: { not: job.id }, tags: { hasSome: job.tags } },
          orderBy: { postedAt: "desc" },
          take: 5,
          select: JOB_SELECT,
        })
      : [];

  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "22px 24px 40px" }}>
      <Link
        href="/jobs"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: "var(--ink-muted)",
          fontSize: 13.5,
          textDecoration: "none",
          marginBottom: 16,
        }}
      >
        ← Back to listings
      </Link>

      <div className="job-detail-layout">
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Header card — title/company/location/actions, then a real-data
              stats row (salary, workplace type, employment type, posted date) */}
          <div className="card" style={{ padding: 28 }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 20, alignItems: "flex-start" }}>
              <div style={{ display: "flex", gap: 16, alignItems: "center", minWidth: 0 }}>
                <CompanyLogo logoUrl={job.logoUrl} company={job.company} size={56} />
                <div style={{ minWidth: 0 }}>
                  {job.postedAt && (
                    <div style={{ fontSize: 12, color: "var(--ink-faint)", marginBottom: 4 }}>
                      {relativeDate(job.postedAt)}
                    </div>
                  )}
                  <h1
                    style={{
                      margin: 0,
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      fontSize: 26,
                      color: "var(--ink)",
                    }}
                  >
                    {job.title}
                  </h1>
                  <p style={{ margin: "5px 0 0", color: "var(--ink-muted)", fontSize: 15.5, fontWeight: 600 }}>
                    {job.company}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, color: "var(--ink-muted)", fontSize: 13.5 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    {job.location ?? "Location unknown"}
                  </div>
                </div>
              </div>
              <div style={{ minWidth: 220, flexShrink: 0 }}>
                <JobDetailActions sourceUrl={job.sourceUrl} />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 18,
                marginTop: 24,
                paddingTop: 20,
                borderTop: "1px solid var(--line)",
              }}
            >
              <StatCell label="Salary" value={salary ?? "Not disclosed"} />
              <StatCell
                label="Workplace"
                value={job.workplaceType !== "unknown" ? job.workplaceType[0].toUpperCase() + job.workplaceType.slice(1) : "Unknown"}
              />
              <StatCell label="Employment type" value={job.employmentType ?? "Not specified"} />
              <StatCell label="Apply by" value={job.deadlineAt ? job.deadlineAt.toLocaleDateString("en-US") : "Open"} />
            </div>
          </div>

          {/* Real tags + tech-stack-mentioned, side by side — same visual
              shape as the mockup's two-column card grid, but built from
              this job's actual tags/description instead of invented
              "responsibilities"/"requirements" copy we have no data for. */}
          {(job.tags.length > 0 || technologies.length > 0) && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              {job.tags.length > 0 && (
                <div className="card" style={{ padding: 24 }}>
                  <h3
                    style={{
                      margin: "0 0 12px",
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "var(--ink-faint)",
                    }}
                  >
                    Role tags
                  </h3>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {job.tags.map((tag) => (
                      <span key={tag} className="tag tag-accent">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {technologies.length > 0 && (
                <div className="card" style={{ padding: 24 }}>
                  <h3
                    style={{
                      margin: "0 0 12px",
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "var(--ink-faint)",
                    }}
                  >
                    Tech stack mentioned
                  </h3>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {technologies.map((tech) => (
                      <span key={tech} className="tag tag-outline">
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Role overview — real description, AI-formatted + highlights
              (FormattedJobDescription already handles both, unchanged). */}
          <div className="card" style={{ padding: 28 }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 19, color: "var(--ink)" }}>
              Role overview
            </h2>
            <FormattedJobDescription
              jobId={job.id}
              description={job.description}
              formattedDescription={job.formattedDescription}
              highlights={job.highlights}
            />
          </div>
        </div>

        {/* Sidebar — real similar-jobs only (tag-overlap based, same query
            as before). The mockup's second "Similar Opportunities" panel
            and the photo/culture card had no real per-job data behind
            them, so they're not reproduced here. */}
        <aside className="job-detail-sidebar">
          {similarJobs.length > 0 && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--ink)" }}>
                  Similar roles
                </h3>
                <Link href="/jobs" style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}>
                  View all
                </Link>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {similarJobs.map((similar) => (
                  <Link
                    key={similar.id}
                    href={`/jobs/${similar.id}`}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      padding: "10px 10px",
                      borderRadius: "var(--radius-sm)",
                      textDecoration: "none",
                      color: "inherit",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <CompanyLogo logoUrl={similar.logoUrl} company={similar.company} size={36} />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: "var(--ink)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {similar.title}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--ink-faint)",
                          marginTop: 2,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {similar.company}
                        {similar.location ? ` · ${similar.location}` : ""}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
