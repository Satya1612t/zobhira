import { SearchBar } from "@/components/SearchBar";
import { StreamsPanel } from "@/components/StreamsPanel";
import { recordSearch, getRecentSearches, type SearchParams } from "@/lib/jobQuery";

export const dynamic = "force-dynamic";

export default async function LiveOpeningPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { q, location, workplaceType, sort, experienceLevel } = searchParams;

  if (q) await recordSearch(q);

  const recentSearches = await getRecentSearches();

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
        Live Opening
      </h1>
      <SearchBar
        q={q}
        location={location}
        workplaceType={workplaceType}
        sort={sort}
        experienceLevel={experienceLevel}
        action="/live"
        showPostedWithin={false}
      />
      <div className="jobs-layout">
        <div />
        <div className="jobs-streams-panel">
          <StreamsPanel activeQuery={q} basePath="/live" recentSearches={recentSearches} />
        </div>
      </div>
    </main>
  );
}
