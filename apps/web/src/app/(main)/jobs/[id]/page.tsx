import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CompanyLogo } from "@/components/CompanyLogo";
import { FormattedJobDescription } from "@/components/FormattedJobDescription";
import { JobDetailActions } from "@/components/JobDetailActions";
import { JobGridCard } from "@/components/JobGridCard";
import { humanizeHighlight } from "@/lib/jobInsights";
import { JOB_SELECT, relatedJobsWhere } from "@/lib/jobQuery";
import { isJobId, parseListingSlug, MIN_LISTINGS_TO_INDEX } from "@/lib/designationCities";
import { DesignationCityLanding } from "@/components/DesignationCityLanding";

// Was force-dynamic — this page only changes when a listing gets updated or
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

function relativeDate(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Posted today";
  if (days === 1) return "Posted 1 day ago";
  if (days < 30) return `Posted ${days} days ago`;
  const months = Math.floor(days / 30);
  return `Posted ${months} month${months === 1 ? "" : "s"} ago`;
}

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

// This route also serves the designation x city SEO landing pages (Prompt
// 13 §1) at the same URL depth as a job ID — Next.js doesn't allow two
// differently-named dynamic segments at one level, so both cases are
// dispatched from this single [id] route based on what the slug looks like.
async function generateListingMetadata(designation: string, city: string, slug: string): Promise<Metadata> {
  const count = await prisma.job.count({
    where: { isActive: true, tags: { has: designation }, location: { contains: city, mode: "insensitive" } },
  });
  const title = `${designation} jobs in ${city}`;
  return {
    title,
    description: `${count} open ${designation} roles in ${city} on Zobhira, updated every morning.`,
    alternates: { canonical: `/jobs/${slug}` },
    robots: count < MIN_LISTINGS_TO_INDEX ? { index: false, follow: true } : undefined,
  };
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  if (!isJobId(params.id)) {
    const pair = parseListingSlug(params.id);
    if (pair) return generateListingMetadata(pair.designation, pair.city, params.id);
    return { title: "Not found" };
  }

  const job = await prisma.job.findUnique({
    where: { id: params.id },
    select: { title: true, company: true, location: true, description: true, formattedDescription: true },
  });
  // Unformatted jobs aren't publicly visible yet (see the matching
  // notFound() below and jobQuery.ts's formattedDescription filter) —
  // treat the same as "job not found" for metadata purposes too.
  if (!job || !job.formattedDescription) return { title: "Job not found" };
  const title = `${job.title} at ${job.company}${job.location ? ` in ${job.location}` : ""}`;
  return {
    title,
    description: job.description ? job.description.slice(0, 155) : `${title}, via Zobhira.`,
    alternates: { canonical: `/jobs/${params.id}` },
  };
}

function MetaIcon({ d }: { d: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export default async function JobDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;

  if (!isJobId(id)) {
    const pair = parseListingSlug(id);
    if (!pair) notFound();
    return <DesignationCityLanding designation={pair.designation} city={pair.city} />;
  }

  const job = await prisma.job.findUnique({
    where: { id },
    select: { ...JOB_SELECT, tagsNorm: true },
  });

  if (!job) notFound();
  // A job isn't publicly viewable until scrape-time LLM formatting has run
  // on it (see services/scraper/utils/job_formatter.py) — same invariant
  // jobQuery.ts's listing filter enforces, so a direct/shared link can't
  // reach a job the listing would never have surfaced.
  if (!job.formattedDescription) notFound();

  const salary = formatSalary(job);
  const isFresh = job.postedAt ? Date.now() - job.postedAt.getTime() < 48 * 60 * 60 * 1000 : false;
  const daysLeft = job.deadlineAt ? daysUntil(job.deadlineAt) : null;
  const showUrgency = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;

  // "Similar" = shares at least one normalized tag (designation/skill) with
  // this job, same recency ordering as everywhere else. No tags at all means
  // no similarity signal to go on, so the section is simply skipped rather
  // than falling back to an arbitrary "recent jobs" list that wouldn't
  // actually be similar. Routed through tagsNorm (not the case-sensitive
  // `tags`) so e.g. "Machine learning" and "Machine Learning" match.
  const similarJobs =
    job.tagsNorm.length > 0
      ? await prisma.job.findMany({
          where: relatedJobsWhere(job),
          orderBy: { postedAt: "desc" },
          take: 4,
          select: JOB_SELECT,
        })
      : [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "JobPosting",
        title: job.title,
        description: job.description ?? job.title,
        // Anchor both dates on firstSeenAt (every row has it) when the
        // source gave no postedAt — many feed jobs don't. datePosted is a
        // required JobPosting field, so falling back to render time / null
        // is wrong; firstSeenAt is a real, stable timestamp. It also fixes
        // validThrough below: computing it from `new Date()` when postedAt
        // is null re-pushed the expiry 30 days out on *every* crawl, so
        // those listings never expired in Google's eyes.
        datePosted: (job.postedAt ?? job.firstSeenAt).toISOString(),
        // Google drops job postings without validThrough after ~30 days —
        // fall back to (postedAt|firstSeenAt) + 30 days (the same window
        // listings get deactivated on) when there's no real deadline, so
        // this matches actual behavior rather than staying open forever.
        validThrough: (
          job.deadlineAt ?? new Date((job.postedAt ?? job.firstSeenAt).getTime() + 30 * 24 * 60 * 60 * 1000)
        ).toISOString(),
        hiringOrganization: {
          "@type": "Organization",
          name: job.company,
          ...(job.logoUrl ? { logo: job.logoUrl } : {}),
        },
        ...(job.location
          ? {
              jobLocation: {
                "@type": "Place",
                address: { "@type": "PostalAddress", addressLocality: job.location, addressCountry: "IN" },
              },
            }
          : {}),
        ...(job.workplaceType === "remote" ? { jobLocationType: "TELECOMMUTE" } : {}),
        ...(job.employmentType ? { employmentType: job.employmentType.toUpperCase() } : {}),
        ...(salary && job.salaryCurrency
          ? {
              baseSalary: {
                "@type": "MonetaryAmount",
                currency: job.salaryCurrency,
                value: {
                  "@type": "QuantitativeValue",
                  ...(job.salaryMin ? { minValue: Number(job.salaryMin) } : {}),
                  ...(job.salaryMax ? { maxValue: Number(job.salaryMax) } : {}),
                  unitText: "YEAR",
                },
              },
            }
          : {}),
        identifier: { "@type": "PropertyValue", name: "Zobhira", value: job.id },
        directApply: false,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://zobhira.com" },
          { "@type": "ListItem", position: 2, name: "Jobs", item: "https://zobhira.com/jobs" },
          { "@type": "ListItem", position: 3, name: job.company },
        ],
      },
    ],
  };

  return (
    <main>
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="job-detail-header-band edge-arc-bottom deco-grain">
        <div className="container" style={{ position: "relative", paddingBlock: "20px 44px" }}>
          <nav aria-label="Breadcrumb" style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginBottom: 14 }}>
            <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>Home</Link>
            {" / "}
            <Link href="/jobs" style={{ color: "inherit", textDecoration: "none" }}>Jobs</Link>
            {" / "}
            <span style={{ color: "var(--color-text)" }}>{job.company}</span>
          </nav>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start", justifyContent: "space-between" }}>
            <div style={{ minWidth: 0 }}>
              {isFresh && (
                <span className="chip chip--success" style={{ marginBottom: 10 }}>
                  <span className="footer-pulse-dot" aria-hidden="true" style={{ marginRight: 2 }} />
                  Posted today &middot; be early
                </span>
              )}
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", fontWeight: 700, margin: "0 0 6px", color: "var(--color-text)" }}>
                {job.title}
              </h1>
              <p style={{ margin: "0 0 12px", color: "var(--color-accent)", fontSize: "var(--text-lg)", fontWeight: 600 }}>{job.company}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 18px", color: "var(--color-text-muted)", fontSize: 13.5 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <MetaIcon d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  {job.location ?? "Location unknown"}
                </span>
                {job.workplaceType !== "unknown" && (
                  <span style={{ textTransform: "capitalize" }}>{job.workplaceType}</span>
                )}
                {job.postedAt && (
                  <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>{relativeDate(job.postedAt)}</span>
                )}
              </div>
            </div>
            <div className="job-detail-logo-overlap">
              <CompanyLogo logoUrl={job.logoUrl} company={job.company} size={56} />
            </div>
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingBottom: 40 }}>
        <div className="job-detail-layout">
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {job.tags.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
                <div className="job-card" style={{ padding: 24 }}>
                  <h3 style={{ margin: "0 0 12px", fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-faint)" }}>
                    Skill Required
                  </h3>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {job.tags.map((tag) => (
                      <span key={tag} className="tag tag-accent">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {job.highlights.length > 0 && (
              <div className="job-card" style={{ padding: 28 }}>
                <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "var(--text-xl)", color: "var(--color-text)" }}>
                  Key highlights
                </h2>
                <ul className="job-desc-highlight-list" style={{ marginTop: 26, paddingTop: 22, borderTop: "1px solid var(--line)" }}>
                  {job.highlights.map((highlight) => (
                    <li key={highlight}>{humanizeHighlight(highlight)}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="job-card" style={{ padding: 28 }}>
              <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "var(--text-xl)", color: "var(--color-text)" }}>
                Role overview
              </h2>
              <FormattedJobDescription
                jobId={job.id}
                description={job.description}
                formattedDescription={job.formattedDescription}
              />
            </div>

            {similarJobs.length > 0 && (
              <div>
                <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-xl)", margin: "8px 0 16px" }}>
                  Similar jobs open now
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
                  {similarJobs.map((similar) => (
                    <JobGridCard key={similar.id} job={similar} />
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="job-detail-sidebar">
            <div className="job-apply-card">
              {showUrgency && (
                <div className="job-deadline-strip">
                  Closes in {daysLeft === 0 ? "today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"}`}
                </div>
              )}
              <JobDetailActions jobId={job.id} sourceUrl={job.sourceUrl} title={job.title} />
              <div className="job-facts-table">
                <div>
                  <span>Location</span>
                  <span>{job.location ?? "Unknown"}</span>
                </div>
                <div>
                  <span>Type</span>
                  <span>{job.employmentType ?? "Not specified"}</span>
                </div>
                {salary && (
                  <div>
                    <span>Salary</span>
                    <span>{salary}</span>
                  </div>
                )}
                {job.postedAt && (
                  <div>
                    <span>Posted</span>
                    <span>{job.postedAt.toLocaleDateString("en-US", { timeZone: "Asia/Kolkata" })}</span>
                  </div>
                )}
                <div>
                  <span>Apply by</span>
                  <span>{job.deadlineAt ? job.deadlineAt.toLocaleDateString("en-US", { timeZone: "Asia/Kolkata" }) : "Open"}</span>
                </div>
              </div>
              <p style={{ fontSize: 11.5, color: "var(--color-text-muted)", textAlign: "center", margin: "12px 0 0", lineHeight: 1.5 }}>
                Links are checked every day. If this one stops working, tell us and we&apos;ll pull it.
              </p>
            </div>

            {similarJobs.length > 0 && (
              <div className="job-card" style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--ink)" }}>
                    More like this
                  </h3>
                  <Link href="/jobs" style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}>
                    View all
                  </Link>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {similarJobs.slice(0, 3).map((similar) => (
                    <Link
                      key={similar.id}
                      href={`/jobs/${similar.id}`}
                      style={{ display: "flex", gap: 10, alignItems: "center", padding: 10, borderRadius: "var(--radius-sm)", textDecoration: "none", color: "inherit", border: "1px solid var(--line)" }}
                    >
                      <CompanyLogo logoUrl={similar.logoUrl} company={similar.company} size={36} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {similar.title}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {similar.company}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      <div className="job-mobile-apply-bar">
        <JobDetailActions jobId={job.id} sourceUrl={job.sourceUrl} />
      </div>
    </main>
  );
}
