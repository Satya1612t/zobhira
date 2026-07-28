import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Every job list/detail query in the app uses this same select — it's every
// column except `raw` (the full scraped-page payload, which no frontend
// component ever reads but which was otherwise shipped over the wire on
// every single job row, list or detail). `dedupKey`/`extractionMethod`/
// `firstSeenAt`/`lastScrapedAt` are internal bookkeeping the UI never
// renders either, so they're left out too.
export const JOB_SELECT = {
  id: true,
  title: true,
  company: true,
  location: true,
  workplaceType: true,
  salaryMin: true,
  salaryMax: true,
  salaryCurrency: true,
  source: true,
  sourceUrl: true,
  description: true,
  formattedDescription: true,
  highlights: true,
  tags: true,
  postedAt: true,
  deadlineAt: true,
  logoUrl: true,
  isActive: true,
  employmentType: true,
} satisfies Prisma.JobSelect;

export type JobListItem = Prisma.JobGetPayload<{ select: typeof JOB_SELECT }>;

// Default listing order: best-quality first (see the Postgres-computed
// qualityScore column, db/migrations/0014_add_job_quality_score.sql), then
// newest, then a stable id tiebreak. `sort=oldest` is an explicit user
// choice to see the chronologically oldest first — qualityScore doesn't
// override that, since the whole point of picking "oldest" is chronology,
// not quality.
export function jobOrderBy(sort?: string): Prisma.JobOrderByWithRelationInput[] {
  if (sort === "oldest") {
    return [{ postedAt: "asc" }, { id: "desc" }];
  }
  return [{ qualityScore: "desc" }, { postedAt: "desc" }, { id: "desc" }];
}

export type SearchParams = {
  q?: string;
  location?: string;
  workplaceType?: string;
  postedWithin?: string;
  sort?: string;
  experienceLevel?: string;
  company?: string;
  tags?: string;
  employmentType?: string;
  source?: string | string[];
  hasSalary?: string;
  salaryMin?: string;
  hideIncomplete?: string;
};

// Sentinel value for the explicit worldwide opt-out — kept distinct from ""
// (the default/unset state) so callers can tell "user hasn't touched this"
// (defaults to India) apart from "user explicitly wants everywhere".
export const ANY_LOCATION = "__any__";

// Same sentinel pattern as ANY_LOCATION — the freshness filter now defaults
// to "past week" when untouched (see postedWithinCutoff), so an explicit
// value is needed to distinguish "user hasn't touched this" from "user
// deliberately wants every posting regardless of age".
export const ALL_TIME = "__all_time__";

// Canonical employment-type tag values — normalized by the scraper itself
// (services/scraper/scrapers/{linkedin,talentd}.py's
// `.replace("-", "").replace(" ", "").capitalize()` on the source's raw
// "full-time"/"part-time"/etc.) before ever reaching the DB, so an exact
// (case-sensitive) Prisma `tags: { has: ... }` match against these is
// reliable — unlike the free-text skills filter below, which can't assume
// its input matches stored casing.
const EMPLOYMENT_TYPE_TAGS = ["Fulltime", "Parttime", "Contract", "Internship", "Intern"];

// Defaults to "past week" per the review's own reasoning ("this week" beats
// "all" as a default) — ALL_TIME is the explicit opt-out. Unlike the other
// filters here, this one has a non-empty default, so "not present at all"
// and "present with an empty value" are treated the same (both -> week).
function postedWithinCutoff(postedWithin?: string): Date | null {
  if (postedWithin === ALL_TIME) return null;
  const days = { "24h": 1, week: 7, month: 30 }[postedWithin || "week"] ?? 7;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// Used for the default "India" scope only — a single `contains: "India"`
// would miss most real India rows, since job postings usually list just
// the city ("Bangalore") without the country name. Also includes "Remote"
// per the original requirement (India cities OR a given place OR remote).
const INDIA_LOCATION_TERMS = [
  "india", "bangalore", "bengaluru", "mumbai", "delhi", "ncr", "pune",
  "hyderabad", "chennai", "kolkata", "gurugram", "gurgaon", "noida", "remote",
];

function indiaScopeFilter(): Prisma.JobWhereInput {
  return {
    OR: INDIA_LOCATION_TERMS.map((term) => ({
      location: { contains: term, mode: "insensitive" as const },
    })),
  };
}

// Match each word of the query independently (in any order, anywhere
// across title/company/tags) rather than requiring the whole phrase as one
// literal substring — so "data engineer" matches a title like "Senior Data
// Platform Engineer", and "nodejs developer" matches "Node.js Developer"
// once punctuation is stripped from both sides. Every term must match
// *somewhere* (title OR company OR a tag), same AND-of-ORs semantics as
// before — just with tags now included in each term's OR.
//
// Raw SQL, not a Prisma typed filter, because tags need a case-insensitive
// match (tags are stored mixed-case, e.g. "Machine learning") and Prisma's
// array `has`/`hasSome` are exact-match/case-sensitive only — same reason
// skillsMatchingIds below already goes through raw ILIKE instead of typed
// filters. Live-confirmed bug this fixes: searching "java" previously only
// checked title/company, so a job whose title doesn't literally contain
// "java" but has "Java" as a tag was invisible to the main search box even
// though the same term typed into the separate "Skills" filter would find
// it — two different keyword-matching behaviors for what a user reasonably
// expects to be the same kind of search.
async function keywordMatchingIds(q: string): Promise<string[] | null> {
  const terms = q
    .trim()
    .toLowerCase()
    .replace(/[.\-_/]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (terms.length === 0) return null;

  const termConditions = terms.map((term) => {
    const pattern = `%${term}%`;
    return Prisma.sql`(title ILIKE ${pattern} OR company ILIKE ${pattern} OR EXISTS (SELECT 1 FROM unnest(tags) AS t WHERE t ILIKE ${pattern}))`;
  });
  const rows = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT id FROM jobs WHERE is_active = true AND ${Prisma.join(termConditions, " AND ")}`
  );
  return rows.map((r) => r.id);
}

// Records a search so it can be surfaced later as a quick-access link
// (StreamsPanel's "Recent searches") — every distinct query a user has
// ever run stays available for reuse instead of being forgotten after one
// visit. Upsert keeps it a single row per distinct query, incrementing a
// count so the panel could later favor popular searches if needed.
export async function recordSearch(q: string): Promise<void> {
  const query = q.trim();
  if (!query) return;
  await prisma.searchQuery.upsert({
    where: { query },
    update: { searchCount: { increment: 1 }, lastSearchedAt: new Date() },
    create: { query },
  });
}

export async function getRecentSearches(limit = 12): Promise<string[]> {
  const rows = await prisma.searchQuery.findMany({
    orderBy: { lastSearchedAt: "desc" },
    take: limit,
    select: { query: true },
  });
  return rows.map((r) => r.query);
}

// Homepage Community section — real popular-search chips, not fabricated
// activity. Ordered by how many times a query has actually been run.
export async function getPopularSearches(limit = 6): Promise<string[]> {
  const rows = await prisma.searchQuery.findMany({
    orderBy: { searchCount: "desc" },
    take: limit,
    select: { query: true },
  });
  return rows.map((r) => r.query);
}

// Real aggregate, not a fabricated "N people online" claim — total searches
// ever recorded across all distinct queries.
export async function getTotalSearchActivity(): Promise<number> {
  const result = await prisma.searchQuery.aggregate({ _sum: { searchCount: true } });
  return result._sum.searchCount ?? 0;
}

// Footer's "Popular cities" links — genuine internal linking from real
// inventory, not a hardcoded city list.
export async function getTopLocations(limit = 6): Promise<string[]> {
  const rows = await prisma.job.groupBy({
    by: ["location"],
    where: { isActive: true, location: { not: null } },
    _count: true,
    orderBy: { _count: { location: "desc" } },
    take: limit,
  });
  return rows.map((r) => r.location).filter((l): l is string => Boolean(l));
}

export async function suggestCorrection(q: string): Promise<string | null> {
  // Only ever consulted when the normal keyword search comes back empty —
  // a trigram similarity lookup against titles already in the DB, so it
  // improves as the DB grows rather than relying on a fixed word list.
  const rows = await prisma.$queryRaw<{ title: string; sim: number }[]>`
    SELECT title, similarity(title, ${q}) AS sim
    FROM jobs
    WHERE is_active = true AND similarity(title, ${q}) > 0.3
    ORDER BY sim DESC
    LIMIT 1
  `;
  const match = rows[0];
  if (!match) return null;
  if (match.title.trim().toLowerCase() === q.trim().toLowerCase()) return null;
  return match.title;
}

// "Experience level" isn't a real column — it's inferred from free-text
// description via regex, so matching happens as a raw-SQL lookup that
// resolves to a set of job IDs, then folds into the normal typed Prisma
// where clause as `id: { in: [...] }`. Descriptions can be NULL now (a
// "stub" posting whose detail-page enrichment hasn't landed yet — see
// scripts/run_scrape.py's MANDATORY_FIELDS comment) — `~*`/`!~*`/
// regexp_match against a NULL description all evaluate to NULL, which a
// SQL WHERE clause treats as "no match", so a stub simply doesn't match any
// experience-level filter rather than erroring or false-matching. Correct
// behavior: we genuinely don't know its experience level yet.
const EXPERIENCE_MIN_YEARS: Record<string, number> = { "1+": 1, "2+": 2, "3+": 3, "5+": 5 };

// Postgres regex syntax for the experience-level filter dropdown. The
// capturing group around `\d+` is required for regexp_match(...)[1] below
// to extract just the number — without it,
// [1] would be the entire matched phrase (e.g. "2+ years of experience"),
// which fails to cast to int.
const EXPERIENCE_PATTERN = String.raw`(\d+)\+?\s*(?:-|to)?\s*\d*\+?\s*years?\s+(?:of\s+)?experience`;

async function experienceMatchingIds(level: string): Promise<string[] | null> {
  if (level === "fresher") {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM jobs
      WHERE is_active = true
      AND (
        description ~* '\yfresher\y|entry[- ]level|no experience required'
        OR description !~* ${EXPERIENCE_PATTERN}
      )
    `;
    return rows.map((r) => r.id);
  }
  const minYears = EXPERIENCE_MIN_YEARS[level];
  if (!minYears) return null;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM jobs
    WHERE is_active = true
    AND (regexp_match(description, ${EXPERIENCE_PATTERN}, 'i'))[1]::int >= ${minYears}
  `;
  return rows.map((r) => r.id);
}

// Skills/tech-stack search — free text, comma-separated (e.g. "python,
// react"), matched against ANY of a job's tags (OR, not AND — "python,
// react" means either, not both). Unlike employmentType's exact match
// against known-canonical values, arbitrary user-typed skill text can't
// assume it matches stored tag casing (tags are mixed-case — "Machine
// learning" vs "React"), so this goes through a raw ILIKE-per-tag lookup
// (same "resolve to job IDs first" pattern as experienceMatchingIds) rather
// than Prisma's case-sensitive-only array `hasSome`.
async function skillsMatchingIds(rawTags: string): Promise<string[]> {
  const patterns = rawTags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => `%${t}%`);
  if (patterns.length === 0) return [];
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT DISTINCT j.id FROM jobs j, unnest(j.tags) AS t
    WHERE j.is_active = true AND t ILIKE ANY(${patterns})
  `;
  return rows.map((r) => r.id);
}

// Shared where-clause builder for the two job-browsing pages (Jobs / Live
// Opening) — `extra` lets a caller (like /live) bolt on an additional hard
// constraint (e.g. postedAt >= 48h ago) without duplicating the rest.
export async function buildJobsWhere(
  {
    q, location, workplaceType, postedWithin, experienceLevel,
    company, tags, employmentType, source, hasSalary, salaryMin, hideIncomplete,
  }: SearchParams,
  extra?: Prisma.JobWhereInput
): Promise<{ where: Prisma.JobWhereInput; isDefaultIndiaScope: boolean }> {
  const postedAfter = postedWithinCutoff(postedWithin);
  const isAnyLocation = location === ANY_LOCATION;
  const isDefaultIndiaScope = !location && !isAnyLocation;

  // All three resolve to `id: { in: [...] }` — collected into one array and
  // merged via `AND` (rather than naively spread, which would let a later
  // one silently clobber an earlier one under the same `id` key) so
  // keyword/experienceLevel/skills can all be filtered on at the same time.
  const [keywordIds, experienceIds, skillIds] = await Promise.all([
    q ? keywordMatchingIds(q) : Promise.resolve(null),
    experienceLevel ? experienceMatchingIds(experienceLevel) : Promise.resolve(null),
    tags ? skillsMatchingIds(tags) : Promise.resolve(null),
  ]);
  const idFilters: Prisma.JobWhereInput[] = [];
  if (keywordIds) idFilters.push({ id: { in: keywordIds } });
  if (experienceIds) idFilters.push({ id: { in: experienceIds } });
  if (skillIds) idFilters.push({ id: { in: skillIds } });

  const sourceList = Array.isArray(source) ? source : source ? [source] : [];
  const minSalary = salaryMin ? Number(salaryMin) : null;
  const validEmploymentType =
    employmentType && EMPLOYMENT_TYPE_TAGS.includes(employmentType) ? employmentType : null;

  const where: Prisma.JobWhereInput = {
    isActive: true,
    ...(isDefaultIndiaScope
      ? indiaScopeFilter()
      : location && !isAnyLocation
        ? { location: { contains: location, mode: "insensitive" as const } }
        : {}),
    ...(workplaceType ? { workplaceType } : {}),
    ...(postedAfter ? { postedAt: { gte: postedAfter } } : {}),
    ...(company ? { company: { contains: company, mode: "insensitive" as const } } : {}),
    ...(validEmploymentType ? { tags: { has: validEmploymentType } } : {}),
    ...(sourceList.length ? { source: { in: sourceList } } : {}),
    // An explicit min implies "must be disclosed" too — no need for both
    // conditions when a min is set, `gte` alone already excludes NULLs.
    ...(minSalary !== null && !Number.isNaN(minSalary)
      ? { salaryMin: { gte: minSalary } }
      : hasSalary === "true"
        ? { salaryMin: { not: null } }
        : {}),
    ...(hideIncomplete === "true" ? { description: { not: null } } : {}),
    ...(idFilters.length === 1 ? idFilters[0] : idFilters.length > 1 ? { AND: idFilters } : {}),
    ...(extra ?? {}),
  };

  return { where, isDefaultIndiaScope };
}
