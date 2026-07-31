import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireDispatchKey } from "@/lib/dispatchAuth";
import { extractTechnologies, extractExperience, extractEmail } from "@/lib/jobInsights";
import { inferJobSignals } from "@/lib/dispatchLlm";

const VALID_PLATFORMS = ["telegram", "whatsapp", "instagram", "youtube"];
const SITE_ORIGIN = "https://zobhira.com";

// "We can share 2 posts at a time" — a single combined cap per call, drawn
// from whichever sources still have daily quota left, not 2-per-source.
// Applies independently to jobs and contests.
const BATCH_SIZE = 2;

// Fixed rotation order the round-robin below walks each call — with a
// per-call cap of 2, this just means "whichever of these, in this order,
// have quota + a pending item" wins the two slots; it's not meant to
// starve later sources, since BATCH_SIZE(2) << the daily quotas summed
// across many calls a day.
// RemoteOK removed as a source entirely (see
// db/migrations/0016_remove_remoteok_source.sql) — its real application
// link is gated behind a mandatory account signup for most listings, not
// something a Telegram-dispatched post can send anyone to directly.
const SOURCE_ROTATION = ["linkedin", "ycombinator", "talentd"];
const SOURCE_DAILY_QUOTA: Record<string, number> = {
  linkedin: 20,
  ycombinator: 2,
  talentd: 5,
};

type JobRow = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  workplaceType: string;
  salaryMin: string | null;
  salaryMax: string | null;
  salaryCurrency: string | null;
  sourceUrl: string;
  description: string | null;
  tags: string[];
  postedAt: Date | null;
  source: string;
};

type ContestRow = {
  id: string;
  title: string;
  contestPlatform: string;
  organizer: string | null;
  mode: string;
  prizeAmount: string | null;
  prizeCurrency: string | null;
  prizeSummary: string | null;
  sourceUrl: string;
  tags: string[];
  startsAt: Date | null;
  deadlineAt: Date | null;
};

// How many of today's (IST) telegram posts came from each source, so we know
// how much of each source's daily quota is left. IST, not UTC, because the
// audience/quota framing ("India", "same day") is IST-local.
async function getPostedTodayCounts(platform: string): Promise<Record<string, number>> {
  const rows = await prisma.$queryRaw<{ source: string; count: bigint }[]>`
    SELECT j.source, count(*)::int AS count
    FROM dispatch_log d
    JOIN jobs j ON j.id = d.content_id
    WHERE d.content_type = 'job' AND d.platform = ${platform} AND d.posted_at IS NOT NULL
      AND (d.posted_at AT TIME ZONE 'Asia/Kolkata')::date = (now() AT TIME ZONE 'Asia/Kolkata')::date
    GROUP BY j.source
  `;
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.source] = Number(row.count);
  return counts;
}

// Fresher-only for now (0-1 yr, per experience_band/min_years_exp from
// services/scraper/utils/field_enrichment.py) — a job with no classified
// experience at all is excluded rather than assumed fresher-friendly, since
// we genuinely don't know.
const FRESHER_FILTER = Prisma.sql`AND (j.experience_band = 'fresher' OR j.min_years_exp <= 1)`;

async function fetchCandidates(source: string, platform: string, limit: number): Promise<JobRow[]> {
  if (limit <= 0) return [];

  if (source === "linkedin") {
    // LinkedIn: same-(IST)-day postings only, newest first — same ordering
    // every other source uses now (latest jobs only, not ranked by
    // completeness).
    return prisma.$queryRaw<JobRow[]>`
      SELECT j.id, j.title, j.company, j.location, j.workplace_type AS "workplaceType",
             j.salary_min AS "salaryMin", j.salary_max AS "salaryMax",
             j.salary_currency AS "salaryCurrency", j.source_url AS "sourceUrl",
             j.description, j.tags, j.posted_at AS "postedAt", j.source
      FROM jobs j
      WHERE j.is_active = true AND j.source = ${source}
        AND (COALESCE(j.posted_at, j.first_seen_at) AT TIME ZONE 'Asia/Kolkata')::date
            = (now() AT TIME ZONE 'Asia/Kolkata')::date
        ${FRESHER_FILTER}
        AND NOT EXISTS (
          SELECT 1 FROM dispatch_log d
          WHERE d.content_type = 'job' AND d.content_id = j.id
            AND d.platform = ${platform} AND d.posted_at IS NOT NULL
        )
      ORDER BY COALESCE(j.posted_at, j.first_seen_at) DESC
      LIMIT ${limit}
    `;
  }

  // YCombinator / Talentd: newest unposted first.
  return prisma.$queryRaw<JobRow[]>`
    SELECT j.id, j.title, j.company, j.location, j.workplace_type AS "workplaceType",
           j.salary_min AS "salaryMin", j.salary_max AS "salaryMax",
           j.salary_currency AS "salaryCurrency", j.source_url AS "sourceUrl",
           j.description, j.tags, j.posted_at AS "postedAt", j.source
    FROM jobs j
    WHERE j.is_active = true AND j.source = ${source}
      ${FRESHER_FILTER}
      AND NOT EXISTS (
        SELECT 1 FROM dispatch_log d
        WHERE d.content_type = 'job' AND d.content_id = j.id
          AND d.platform = ${platform} AND d.posted_at IS NOT NULL
      )
    ORDER BY COALESCE(j.posted_at, j.first_seen_at) DESC
    LIMIT ${limit}
  `;
}

async function selectJobBatch(platform: string, batchSize: number): Promise<JobRow[]> {
  const postedToday = await getPostedTodayCounts(platform);

  const candidateLists = new Map<string, JobRow[]>();
  for (const source of SOURCE_ROTATION) {
    const remaining = Math.max(0, (SOURCE_DAILY_QUOTA[source] ?? 0) - (postedToday[source] ?? 0));
    const fetchLimit = Math.min(remaining, batchSize);
    candidateLists.set(source, await fetchCandidates(source, platform, fetchLimit));
  }

  // Round-robin across sources, one at a time, until the combined cap is
  // filled or every source's candidate list is exhausted.
  const selected: JobRow[] = [];
  let madeProgress = true;
  while (selected.length < batchSize && madeProgress) {
    madeProgress = false;
    for (const source of SOURCE_ROTATION) {
      if (selected.length >= batchSize) break;
      const next = candidateLists.get(source)?.shift();
      if (next) {
        selected.push(next);
        madeProgress = true;
      }
    }
  }
  return selected;
}

export async function GET(request: NextRequest) {
  const denied = requireDispatchKey(request);
  if (denied) return denied;

  const sp = request.nextUrl.searchParams;
  const platform = sp.get("platform") ?? "";
  const type = sp.get("type") ?? "all";
  const requestedLimit = sp.get("limit") ? Number(sp.get("limit")) : BATCH_SIZE;
  const batchSize = Math.min(Math.max(1, requestedLimit || BATCH_SIZE), BATCH_SIZE);

  if (!VALID_PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: "Unknown platform" }, { status: 400 });
  }

  const items: unknown[] = [];

  if (type === "all" || type === "job") {
    const jobs = await selectJobBatch(platform, batchSize);

    // Deterministic pass first, for every selected job. Only jobs still
    // missing skills/experience afterward get a freellmapi call, run in
    // parallel — cheap now that this only ever runs against the ≤2 jobs
    // actually chosen for this batch, not every pending candidate.
    // `tags` (rendered separately as hashtags below) mixes designation/role
    // labels ("Fulltime", "Engineering manager") with real tech, so it isn't
    // a reliable skills source on its own — only extractTechnologies'
    // curated tech-keyword match feeds `skills`.
    const base = jobs.map((job) => ({
      job,
      skills: extractTechnologies(job.description).slice(0, 6),
      experience: extractExperience(job.description),
      email: extractEmail(job.description),
    }));

    const inferred = await Promise.all(
      base.map((b) => (b.skills.length === 0 || b.experience === null ? inferJobSignals(b.job.description) : null))
    );

    base.forEach((b, i) => {
      const fallback = inferred[i];
      if (!fallback) return;
      if (b.skills.length === 0) b.skills = fallback.skills.slice(0, 6);
      if (b.experience === null) b.experience = fallback.experience;
    });

    for (const { job, skills, experience, email } of base) {
      items.push({
        contentType: "job",
        id: job.id,
        source: job.source,
        title: job.title,
        company: job.company,
        location: job.location,
        workplaceType: job.workplaceType,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        salaryCurrency: job.salaryCurrency,
        sourceUrl: job.sourceUrl,
        tags: job.tags,
        skills,
        experience,
        email,
        detailUrl: `${SITE_ORIGIN}/jobs/${job.id}`,
        postedAt: job.postedAt,
      });
    }
  }

  if (type === "all" || type === "contest") {
    // "Only if live" = hasn't started yet or is currently ongoing, and
    // hasn't already passed its deadline.
    const contests = await prisma.$queryRaw<ContestRow[]>`
      SELECT c.id, c.title, c.platform AS "contestPlatform", c.organizer, c.mode,
             c.prize_amount AS "prizeAmount", c.prize_currency AS "prizeCurrency",
             c.prize_summary AS "prizeSummary", c.source_url AS "sourceUrl",
             c.tags, c.starts_at AS "startsAt", c.deadline_at AS "deadlineAt"
      FROM contests c
      WHERE c.is_active = true
        AND (c.deadline_at IS NULL OR c.deadline_at > now())
        AND (c.starts_at IS NULL OR c.starts_at <= now())
        AND NOT EXISTS (
          SELECT 1 FROM dispatch_log d
          WHERE d.content_type = 'contest' AND d.content_id = c.id
            AND d.platform = ${platform} AND d.posted_at IS NOT NULL
        )
      ORDER BY c.first_seen_at ASC
      LIMIT ${batchSize}
    `;

    for (const contest of contests) {
      items.push({
        contentType: "contest",
        id: contest.id,
        contestPlatform: contest.contestPlatform,
        title: contest.title,
        organizer: contest.organizer,
        mode: contest.mode,
        prizeAmount: contest.prizeAmount,
        prizeCurrency: contest.prizeCurrency,
        prizeSummary: contest.prizeSummary,
        sourceUrl: contest.sourceUrl,
        tags: contest.tags,
        detailUrl: `${SITE_ORIGIN}/contest/${contest.id}`,
        startsAt: contest.startsAt,
        deadlineAt: contest.deadlineAt,
      });
    }
  }

  return NextResponse.json({ platform, count: items.length, items });
}
