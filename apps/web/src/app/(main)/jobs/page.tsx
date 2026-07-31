import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { JobFeed } from "@/components/JobFeed";
import { JobsFilterLayout } from "@/components/JobsFilterLayout";
import { StreamsPanel } from "@/components/StreamsPanel";
import Image from "next/image";
import { AspectBox } from "@/components/ui/AspectBox";
import {
  buildJobsWhere,
  suggestCorrection,
  recordSearch,
  getRecentSearches,
  jobOrderBy,
  JOB_SELECT,
  type SearchParams,
} from "@/lib/jobQuery";
import { recordSkillMisses } from "@/lib/skillVocab";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { q, location } = searchParams;
  const activeFilterCount = Object.values(searchParams).filter(Boolean).length;
  const parts = [q ? `${q} jobs` : "Technical jobs"];
  if (location) parts.push(`in ${location}`);
  const title = parts.join(" ");

  const { where } = await buildJobsWhere(searchParams);
  const matchCount = await prisma.job.count({ where });

  return {
    title,
    description: `${title} on Zobhira, updated every morning. Free to search, no account needed.`,
    // Deep filter combinations canonicalize to the plain listing rather than
    // each getting its own indexable URL — thin near-duplicate pages are the
    // fastest way for an aggregator to get a quality penalty.
    alternates: { canonical: activeFilterCount > 2 ? "/jobs" : undefined },
    robots: matchCount === 0 && activeFilterCount > 0 ? { index: false, follow: true } : undefined,
  };
}

const BROADER_SEARCHES = ["Frontend", "Backend", "Remote", "Internship"];

export default async function JobsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const {
    q, location, workplaceType, postedWithin, sort, experienceLevel,
    company, tags, employmentType, source, hasSalary, salaryMin, hideIncomplete,
  } = searchParams;
  const { where, isDefaultIndiaScope } = await buildJobsWhere(searchParams);
  const orderBy = jobOrderBy(sort);

  const [, filteredJobs, recentSearches, totalActiveJobs] = await Promise.all([
    q ? recordSearch(q) : Promise.resolve(),
    prisma.job.findMany({ where, orderBy, take: 50, select: JOB_SELECT }),
    getRecentSearches(),
    prisma.job.count({ where: { isActive: true } }),
  ]);

  // No matches at all for the active filters — fall back to a general
  // (unfiltered) listing right away instead of a dead-end empty page, same
  // "filtered exhausted -> show general" behavior the infinite-scroll feed
  // uses further down the list.
  let jobs = filteredJobs;
  let initialMode: "filtered" | "general" = "filtered";
  if (jobs.length === 0) {
    jobs = await prisma.job.findMany({
      where: { isActive: true },
      orderBy,
      take: 50,
      select: JOB_SELECT,
    });
    initialMode = "general";
  }

  const suggestion = q && filteredJobs.length === 0 ? await suggestCorrection(q) : null;
  const zeroFilteredResults = filteredJobs.length === 0;

  // Fire-and-forget — a zero-result skill search is the strongest signal the
  // vocabulary miner gets about what it's missing (see
  // scripts/mine_skills.py). Never awaited into the response path.
  if (tags && zeroFilteredResults) void recordSkillMisses(tags);

  const jsonLd = jobs.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: jobs.slice(0, 10).map((job, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://zobhira.com/jobs/${job.id}`,
      name: job.title,
    })),
  } : null;

  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "22px 24px 40px" }}>
      {jsonLd && (
        // eslint-disable-next-line react/no-danger
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-3xl)",
          fontWeight: 700,
          margin: 0,
          color: "var(--color-text)",
        }}
      >
        {q ? `"${q}"` : "Jobs open right now"}
      </h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: 5, marginBottom: 4, fontSize: 13.5 }}>
        {totalActiveJobs.toLocaleString()} openings, updated today. Filter down to what fits you.
        {isDefaultIndiaScope && (
          <span style={{ color: "var(--ink-faint)" }}>
            {" "}
            &middot; Showing India-based and remote roles, pick &quot;Any location (worldwide)&quot; below to
            broaden
          </span>
        )}
      </p>

      <div className="jobs-status-strip" data-theme="dark">
        <span className="footer-pulse-dot" aria-hidden="true" />
        {totalActiveJobs.toLocaleString()} roles open right now &middot; checked every morning
      </div>

      <JobsFilterLayout
        q={q}
        location={location}
        workplaceType={workplaceType}
        postedWithin={postedWithin}
        sort={sort}
        experienceLevel={experienceLevel}
        company={company}
        tags={tags}
        employmentType={employmentType}
        hasSalary={hasSalary}
        salaryMin={salaryMin}
        action="/jobs"
        streamsPanel={<StreamsPanel activeQuery={q} recentSearches={recentSearches} basePath="/jobs" compact />}
      >
        {zeroFilteredResults ? (
          <div className="jobs-empty-state">
            <AspectBox ratio="16/10" style={{ maxWidth: 380, margin: "0 auto 20px" }}>
              <Image src="/illustrations/no-jobs-found.png" alt="No jobs found" fill style={{ objectFit: "contain" }} sizes="380px" />
            </AspectBox>
            <p style={{ textAlign: "center", fontWeight: 600, marginBottom: 12 }}>Nothing matches that yet.</p>
            <p style={{ textAlign: "center", color: "var(--color-text-muted)", fontSize: 13.5, marginBottom: 16 }}>
              Try fewer filters, or check one of these.
            </p>
            {suggestion && (
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <Link href={`/jobs?q=${encodeURIComponent(suggestion)}`} className="btn btn-secondary" style={{ textDecoration: "none" }}>
                  Did you mean &quot;{suggestion}&quot;?
                </Link>
              </div>
            )}
            <div className="cluster" style={{ justifyContent: "center" }}>
              <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>Try instead:</span>
              {BROADER_SEARCHES.map((term) => (
                <Link key={term} href={`/jobs?q=${encodeURIComponent(term)}`} className="chip chip--accent" style={{ textDecoration: "none" }}>
                  {term}
                </Link>
              ))}
            </div>
            <p style={{ color: "var(--color-text-muted)", fontSize: 13, textAlign: "center", marginTop: 24 }}>
              Showing {jobs.length} other recent listings below instead.
            </p>
          </div>
        ) : null}
        <JobFeed
          key={`${q ?? ""}|${location ?? ""}|${workplaceType ?? ""}|${postedWithin ?? ""}|${sort ?? ""}|${experienceLevel ?? ""}|${company ?? ""}|${tags ?? ""}|${employmentType ?? ""}|${JSON.stringify(source ?? "")}|${hasSalary ?? ""}|${salaryMin ?? ""}|${hideIncomplete ?? ""}`}
          initialJobs={jobs}
          initialMode={initialMode}
          filters={{
            q, location, workplaceType, postedWithin, sort, experienceLevel,
            company, tags, employmentType, source, hasSalary, salaryMin, hideIncomplete,
          }}
        />
      </JobsFilterLayout>
    </main>
  );
}
