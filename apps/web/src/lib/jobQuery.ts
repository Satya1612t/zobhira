import type { Prisma } from "@prisma/client";
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
} satisfies Prisma.JobSelect;

export type JobListItem = Prisma.JobGetPayload<{ select: typeof JOB_SELECT }>;

export type SearchParams = {
  q?: string;
  location?: string;
  workplaceType?: string;
  postedWithin?: string;
  sort?: string;
  experienceLevel?: string;
};

// Sentinel value for the explicit worldwide opt-out — kept distinct from ""
// (the default/unset state) so callers can tell "user hasn't touched this"
// (defaults to India) apart from "user explicitly wants everywhere".
export const ANY_LOCATION = "__any__";

function postedWithinCutoff(postedWithin: string): Date | null {
  const days = { "24h": 1, week: 7, month: 30 }[postedWithin];
  if (!days) return null;
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

function buildKeywordFilter(q: string): Prisma.JobWhereInput {
  // Match each word of the query independently (in any order, anywhere
  // across title/company/tags) rather than requiring the whole phrase as
  // one literal substring — so "data engineer" matches a title like
  // "Senior Data Platform Engineer", and "nodejs developer" matches
  // "Node.js Developer" once punctuation is stripped from both sides.
  const terms = q
    .trim()
    .toLowerCase()
    .replace(/[.\-_/]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  // Note: tags are stored with mixed casing (e.g. "Machine learning"), and
  // Prisma's array `has` filter is exact-match/case-sensitive with no
  // case-insensitive equivalent — so tags aren't included here, since a
  // lowercased term would silently fail to match most of them.
  return {
    AND: terms.map((term) => ({
      OR: [
        { title: { contains: term, mode: "insensitive" } },
        { company: { contains: term, mode: "insensitive" } },
      ],
    })),
  };
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
// where clause as `id: { in: [...] }`. Every stored job is guaranteed a
// non-null description (see scripts/run_scrape.py's mandatory-field rule),
// so there's no need to special-case a NULL description here.
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

// Shared where-clause builder for the two job-browsing pages (Jobs / Live
// Opening) — `extra` lets a caller (like /live) bolt on an additional hard
// constraint (e.g. postedAt >= 48h ago) without duplicating the rest.
export async function buildJobsWhere(
  { q, location, workplaceType, postedWithin, experienceLevel }: SearchParams,
  extra?: Prisma.JobWhereInput
): Promise<{ where: Prisma.JobWhereInput; isDefaultIndiaScope: boolean }> {
  const postedAfter = postedWithin ? postedWithinCutoff(postedWithin) : null;
  const isAnyLocation = location === ANY_LOCATION;
  const isDefaultIndiaScope = !location && !isAnyLocation;
  const experienceIds = experienceLevel ? await experienceMatchingIds(experienceLevel) : null;

  const where: Prisma.JobWhereInput = {
    isActive: true,
    ...(q ? buildKeywordFilter(q) : {}),
    ...(isDefaultIndiaScope
      ? indiaScopeFilter()
      : location && !isAnyLocation
        ? { location: { contains: location, mode: "insensitive" as const } }
        : {}),
    ...(workplaceType ? { workplaceType } : {}),
    ...(postedAfter ? { postedAt: { gte: postedAfter } } : {}),
    ...(experienceIds ? { id: { in: experienceIds } } : {}),
    ...(extra ?? {}),
  };

  return { where, isDefaultIndiaScope };
}
