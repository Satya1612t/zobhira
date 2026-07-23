import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SOURCE_LABELS } from "@/components/SourceBadge";
import { CompanyLogo } from "@/components/CompanyLogo";
import { SimilarJobsRail } from "@/components/SimilarJobsRail";
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
          take: 10,
          select: JOB_SELECT,
        })
      : [];

  return (
    <main style={{ maxWidth: 1040, margin: "0 auto", padding: "40px 10px 64px" }}>
      <Link
        href="/jobs"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: "var(--ink-muted)",
          fontSize: 13.5,
          textDecoration: "none",
          marginBottom: 20,
        }}
      >
        ← Back to listings
      </Link>

      <div className="detail-grid">
        <div className="card" style={{ padding: "28px 30px" }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <CompanyLogo logoUrl={job.logoUrl} company={job.company} size={56} />
            <div style={{ minWidth: 0 }}>
              <h1
                style={{
                  margin: 0,
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  fontSize: 26,
                  color: "var(--ink)",
                }}
              >
                {job.title}
              </h1>
              <p style={{ margin: "5px 0 0", color: "var(--ink-muted)", fontSize: 15.5 }}>{job.company}</p>
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              fontFamily: "var(--font-mono)",
              fontSize: 12.5,
              color: "var(--ink-faint)",
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <span>{job.location ?? "Location unknown"}</span>
            {job.workplaceType !== "unknown" && <span>· {job.workplaceType}</span>}
            {job.postedAt && <span>· posted {job.postedAt.toLocaleDateString("en-US")}</span>}
          </div>

          {job.tags.length > 0 && (
            <div style={{ marginTop: 18, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {job.tags.map((tag) => (
                <span key={tag} className="tag tag-accent">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {technologies.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--ink-faint)",
                  marginBottom: 7,
                }}
              >
                Tech stack mentioned
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {technologies.map((tech) => (
                  <span key={tech} className="tag tag-outline">
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}

          <FormattedJobDescription
            jobId={job.id}
            description={job.description}
            formattedDescription={job.formattedDescription}
            highlights={job.highlights}
          />
        </div>

        <div className="detail-apply-card">
          <div className="card" style={{ padding: 22 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-faint)" }}>
                  Location
                </div>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink)", marginTop: 2 }}>
                  {job.location ?? "Unknown"}
                </div>
              </div>

              {job.workplaceType !== "unknown" && (
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-faint)" }}>
                    Workplace
                  </div>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink)", marginTop: 2, textTransform: "capitalize" }}>
                    {job.workplaceType}
                  </div>
                </div>
              )}

              {job.postedAt && (
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-faint)" }}>
                    Posted
                  </div>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink)", marginTop: 2 }}>
                    {job.postedAt.toLocaleDateString("en-US")}
                  </div>
                </div>
              )}
            </div>

            {(salary || job.deadlineAt) && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 14 }}>
                {salary && (
                  <div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-faint)" }}>
                      Salary
                    </div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--ink)", marginTop: 2 }}>
                      {salary}
                    </div>
                  </div>
                )}

                {job.deadlineAt && (
                  <div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-faint)" }}>
                      Apply by
                    </div>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--warn)", marginTop: 2 }}>
                      {job.deadlineAt.toLocaleDateString("en-US")}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: 20 }}>
              <JobDetailActions jobTitle={job.title} company={job.company} />
            </div>

            <a
              href={job.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block",
                textAlign: "center",
                marginTop: 10,
                padding: "10px 0",
                color: "var(--color-accent)",
                textDecoration: "none",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              View original posting on {SOURCE_LABELS[job.source] ?? job.source} →
            </a>
          </div>
        </div>
      </div>

      {similarJobs.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 17,
              fontWeight: 600,
              color: "var(--ink)",
              margin: "0 0 12px",
            }}
          >
            Similar roles
          </h2>
          <SimilarJobsRail jobs={similarJobs} />
        </div>
      )}
    </main>
  );
}
