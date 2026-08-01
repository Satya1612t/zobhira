import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { expandSkillQuery } from "@/lib/skillVocab";

// Every job list/detail query in the app uses this same select — it's every
// column except `raw` (the full scraped-page payload, which no frontend
// component ever reads but which was otherwise shipped over the wire on
// every single job row, list or detail). `dedupKey`/`extractionMethod`/
// `lastScrapedAt` are internal bookkeeping the UI never renders, so they're
// left out too. `firstSeenAt` IS selected despite being scrape bookkeeping —
// some sources (YCombinator) never provide a real `postedAt` at all (see
// scrapers/ycombinator.py's own docstring), so JobCard falls back to our
// scrape date, formatted identically to a real postedAt, rather than
// showing nothing.
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
  firstSeenAt: true,
  deadlineAt: true,
  logoUrl: true,
  isActive: true,
  employmentType: true,
  // New — lets JobCard render an accurate "Fresher" / "3-5 yrs" chip from a
  // stored value instead of re-running extractExperience() over the whole
  // description on every render of every card.
  experienceBand: true,
  minYearsExp: true,
  maxYearsExp: true,
} satisfies Prisma.JobSelect;

export type JobListItem = Prisma.JobGetPayload<{ select: typeof JOB_SELECT }>;

// Default listing order: fresher-first (see the Postgres-computed
// fresherRank column, db/migrations/0019), then best-quality (qualityScore,
// db/migrations/0014), then newest, then a stable id tiebreak. `sort=oldest`/
// `sort=newest` are explicit user choices to see chronology — fresherRank/
// qualityScore don't override those, since the whole point of picking a
// chronological sort is chronology, not audience fit.
//
// idx_jobs_fresher_order (migration 0019) matches this exact tuple, so this
// is an index scan with no sort node.
export function jobOrderBy(sort?: string): Prisma.JobOrderByWithRelationInput[] {
  if (sort === "oldest") {
    return [{ postedAt: "asc" }, { id: "desc" }];
  }
  if (sort === "newest") {
    return [{ postedAt: "desc" }, { id: "desc" }];
  }
  return [
    { fresherRank: "asc" },
    { qualityScore: "desc" },
    { postedAt: "desc" },
    { id: "desc" },
  ];
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
//
// Cap on the keyword id-list. Without a bound, a broad query ("engineer")
// on a large table materialises every matching id in Node and sends it back
// to Postgres as an IN list — which is how this pattern falls over. The cap
// is well above any page size the UI requests.
const MAX_KEYWORD_IDS = 5000;

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
    Prisma.sql`SELECT id FROM jobs WHERE is_active = true AND ${Prisma.join(
      termConditions,
      " AND "
    )} ORDER BY fresher_rank ASC, quality_score DESC LIMIT ${MAX_KEYWORD_IDS}`
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

/** UI value -> filter. Bands are stored; year floors are also stored. */
const EXPERIENCE_BANDS = ["fresher", "junior", "mid", "senior", "lead"] as const;
const EXPERIENCE_MIN_YEARS: Record<string, number> = { "1+": 1, "2+": 2, "3+": 3, "5+": 5 };

function experienceFilter(level?: string): Prisma.JobWhereInput {
  if (!level) return {};

  // Band values (fresher/junior/mid/senior/lead) — an indexed equality.
  if ((EXPERIENCE_BANDS as readonly string[]).includes(level)) {
    // "fresher" also admits postings whose stated floor is <= 1 year even if
    // the band landed elsewhere via the LLM pass — belt and braces on the
    // one filter this product cannot afford to get wrong.
    if (level === "fresher") {
      return { OR: [{ experienceBand: "fresher" }, { minYearsExp: { lte: 1 } }] };
    }
    return { experienceBand: level };
  }

  // Legacy "N+ years" values — kept so existing bookmarks, the footer links
  // and any indexed URLs keep working.
  const minYears = EXPERIENCE_MIN_YEARS[level];
  if (minYears !== undefined) return { minYearsExp: { gte: minYears } };

  // FIX for a live bug: /jobs?experienceLevel=senior is linked from
  // components/home/Offers.tsx but "senior" was not in EXPERIENCE_MIN_YEARS,
  // so experienceMatchingIds returned null and the filter was silently
  // dropped — that CTA showed unfiltered results. It is a valid band now,
  // handled above. Anything still unrecognised is ignored rather than
  // producing a confusing empty page.
  return {};
}

// Skills/tech-stack search — free text, comma-separated (e.g. "python,
// react"), matched against ANY of a job's tags_norm (OR, not AND — "python,
// react" means either, not both). tags_norm (migration 0019) holds
// lowercased, alias-collapsed tags, so `hasSome` maps to the `&&`
// array-overlap operator and hits the GIN index directly — unlike the old
// `unnest(tags) ... ILIKE ANY(...)` lookup, which was opaque to the planner
// and ran as a full sequential scan regardless of the GIN index on tags.
async function skillsFilter(rawTags?: string): Promise<Prisma.JobWhereInput> {
  if (!rawTags) return {};
  const keys = await expandSkillQuery(rawTags);
  if (keys.length === 0) return {};
  return { tagsNorm: { hasSome: keys } };
}

// The old filter checked `tags: { has: "Fulltime" }` — exact and
// case-sensitive — which failed for three of four sources: ycombinator
// pushed the raw "Full-time" (hyphen) into tags, himalayas had the real
// value in its employment_type column (never tags), and linkedin/talentd
// only tagged it during detail-page enrichment, so every unenriched stub
// failed the filter silently. Every source now writes the canonical value
// into the indexed employment_type column
// (services/scraper/utils/field_enrichment.py), and this ORs across both so
// rows scraped before the backfill still match via their tag.
const EMPLOYMENT_TYPES = ["Fulltime", "Parttime", "Contract", "Internship", "Apprenticeship"];

function employmentTypeFilter(value?: string): Prisma.JobWhereInput {
  if (!value || !EMPLOYMENT_TYPES.includes(value)) return {};
  return { OR: [{ employmentType: value }, { tags: { has: value } }] };
}

// Shared where-clause builder for the two job-browsing pages (Jobs / Live
// Opening) — `extra` lets a caller (like /live) bolt on an additional hard
// constraint (e.g. postedAt >= 48h ago) without duplicating the rest.
//
// Only keyword search still needs the resolve-to-ids round trip (it
// genuinely needs ILIKE across title/company/tags). Experience and skills
// are now typed, indexed clauses.
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

  const [keywordIds, skillsClause] = await Promise.all([
    q ? keywordMatchingIds(q) : Promise.resolve(null),
    skillsFilter(tags),
  ]);

  const sourceList = Array.isArray(source) ? source : source ? [source] : [];
  const minSalary = salaryMin ? Number(salaryMin) : null;

  // Collected as an AND list so several clauses can target the same key
  // without one silently clobbering another (the reason the original code
  // merged id-filters explicitly rather than spreading them).
  const and: Prisma.JobWhereInput[] = [
    experienceFilter(experienceLevel),
    skillsClause,
    employmentTypeFilter(employmentType),
  ].filter((clause) => Object.keys(clause).length > 0);

  if (keywordIds) and.push({ id: { in: keywordIds } });

  const where: Prisma.JobWhereInput = {
    isActive: true,
    // A job isn't publicly visible until scrape-time LLM formatting has run
    // on it (see services/scraper/utils/job_formatter.py) — the detail page
    // itself 404s for an unformatted job, so it must never surface here
    // either. See apps/web/src/app/(main)/jobs/[id]/page.tsx's matching
    // notFound() guard.
    formattedDescription: { not: null },
    ...(isDefaultIndiaScope
      ? indiaScopeFilter()
      : location && !isAnyLocation
        ? { location: { contains: location, mode: "insensitive" as const } }
        : {}),
    ...(workplaceType ? { workplaceType } : {}),
    ...(postedAfter ? { postedAt: { gte: postedAfter } } : {}),
    ...(company ? { company: { contains: company, mode: "insensitive" as const } } : {}),
    ...(sourceList.length ? { source: { in: sourceList } } : {}),
    // An explicit min implies "must be disclosed" too — no need for both
    // conditions when a min is set, `gte` alone already excludes NULLs.
    ...(minSalary !== null && !Number.isNaN(minSalary)
      ? { salaryMin: { gte: minSalary } }
      : hasSalary === "true"
        ? { salaryMin: { not: null } }
        : {}),
    ...(hideIncomplete === "true" ? { description: { not: null } } : {}),
    ...(and.length ? { AND: and } : {}),
    ...(extra ?? {}),
  };

  return { where, isDefaultIndiaScope };
}

// jobs/[id]/page.tsx currently uses `tags: { hasSome: job.tags }`, which is
// case-SENSITIVE — so a job tagged "Machine learning" never matches one
// tagged "Machine Learning". Route it through tags_norm instead.
export function relatedJobsWhere(job: { id: string; tagsNorm: string[] }): Prisma.JobWhereInput {
  return {
    isActive: true,
    formattedDescription: { not: null },
    id: { not: job.id },
    tagsNorm: { hasSome: job.tagsNorm },
  };
}
