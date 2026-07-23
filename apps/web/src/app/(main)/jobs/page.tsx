import { prisma } from "@/lib/prisma";
import { JobFeed } from "@/components/JobFeed";
import { SearchBar } from "@/components/SearchBar";
import { StreamsPanel } from "@/components/StreamsPanel";
import {
  buildJobsWhere,
  suggestCorrection,
  recordSearch,
  getRecentSearches,
  JOB_SELECT,
  type SearchParams,
} from "@/lib/jobQuery";

export const dynamic = "force-dynamic";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q, location, workplaceType, postedWithin, sort, experienceLevel } = searchParams;
  const { where, isDefaultIndiaScope } = await buildJobsWhere(searchParams);
  const orderBy = [
    { postedAt: sort === "oldest" ? ("asc" as const) : ("desc" as const) },
    { id: "desc" as const },
  ];

  const [, filteredJobs, recentSearches] = await Promise.all([
    q ? recordSearch(q) : Promise.resolve(),
    prisma.job.findMany({ where, orderBy, take: 50, select: JOB_SELECT }),
    getRecentSearches(),
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

  return (
    <main style={{ maxWidth: 1040, margin: "0 auto", padding: "22px 10px 40px" }}>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 26,
          fontWeight: 600,
          margin: 0,
          color: "var(--ink)",
        }}
      >
        {q ? `“${q}”` : "Latest technical roles"}
      </h1>
      <p style={{ color: "var(--ink-muted)", marginTop: 5, marginBottom: 16, fontSize: 13.5 }}>
        {jobs.length} listing{jobs.length === 1 ? "" : "s"} aggregated from LinkedIn, Y
        Combinator, RemoteOK &amp; Talentd
        {isDefaultIndiaScope && (
          <span style={{ color: "var(--ink-faint)" }}>
            {" "}
            · Showing India-based and remote roles — pick "Any location (worldwide)" below to
            broaden
          </span>
        )}
      </p>
      <SearchBar
        q={q}
        location={location}
        workplaceType={workplaceType}
        postedWithin={postedWithin}
        sort={sort}
        experienceLevel={experienceLevel}
        action="/jobs"
      />
      <div className="jobs-layout">
        <div>
          {jobs.length === 0 ? (
            <p
              style={{
                color: "var(--ink-muted)",
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                padding: 20,
              }}
            >
              No jobs found in the database yet for this search. Try different keywords/filters,
              or check back after the next scheduled scrape.
              {suggestion && (
                <>
                  {" "}
                  Did you mean{" "}
                  <a
                    href={`/jobs?q=${encodeURIComponent(suggestion)}`}
                    style={{ color: "var(--accent)", fontWeight: 600 }}
                  >
                    {suggestion}
                  </a>
                  ?
                </>
              )}
            </p>
          ) : (
            <JobFeed
              key={`${q ?? ""}|${location ?? ""}|${workplaceType ?? ""}|${postedWithin ?? ""}|${sort ?? ""}|${experienceLevel ?? ""}`}
              initialJobs={jobs}
              initialMode={initialMode}
              filters={{ q, location, workplaceType, postedWithin, sort, experienceLevel }}
            />
          )}
        </div>
        <div className="jobs-streams-panel">
          <StreamsPanel activeQuery={q} recentSearches={recentSearches} basePath="/jobs" />
        </div>
      </div>
    </main>
  );
}
