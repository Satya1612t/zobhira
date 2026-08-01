import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireDispatchKey } from "@/lib/dispatchAuth";
import { extractTechnologies, extractExperience, extractEmail, flattenFormatted } from "@/lib/jobInsights";
import { inferJobSignals } from "@/lib/dispatchLlm";
import { SHOW_UNRELEASED_NAV } from "@/lib/authNavFlags";

const VALID_PLATFORMS = ["telegram", "whatsapp", "instagram", "youtube"];
const SITE_ORIGIN = "https://zobhira.com";

// "We can share 2 posts at a time" — a single combined cap per call.
// Applies independently to jobs and contests.
const BATCH_SIZE = 2;

// Sources eligible for dispatch — selectJobBatch() below pools all of them
// together and ranks purely by recency (no per-source quota, no fixed
// rotation order — the freshest eligible job across any of these wins a
// slot, regardless of which one it's from).
// RemoteOK removed as a source entirely (see
// db/migrations/0016_remove_remoteok_source.sql) — its real application
// link is gated behind a mandatory account signup for most listings, not
// something a Telegram-dispatched post can send anyone to directly.
//
// Himalayas was deliberately excluded here previously — see CLAUDE.md's
// "Himalayas attribution conflict" note (its terms document an attribution
// obligation apps/web has never implemented). Included now regardless, per
// an explicit call to accept that gap rather than sit on zero fresher
// candidates from the other three sources.
//
// YCombinator excluded from Telegram dispatch — its postings never carry a
// real `posted_at` (that source doesn't expose one; see jobInsights/dispatch
// discussion), so "newest first" for YC is only ever scrape-date ordering,
// not genuine posting recency.
const SOURCE_ROTATION = ["linkedin", "talentd", "himalayas"];

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
  formattedDescription: string | null;
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

// Fresher-only for now (0-1 yr, per experience_band/min_years_exp from
// services/scraper/utils/field_enrichment.py) — a job with no classified
// experience at all is excluded rather than assumed fresher-friendly, since
// we genuinely don't know.
const FRESHER_FILTER = Prisma.sql`AND (j.experience_band = 'fresher' OR j.min_years_exp <= 1)`;

// A job isn't publicly viewable until scrape-time LLM formatting has run on
// it (see services/scraper/utils/job_formatter.py and jobQuery.ts's
// matching listing filter) — dispatching a link to Telegram for a job whose
// detail page would 404 is worse than just waiting for the next batch.
const FORMATTED_FILTER = Prisma.sql`AND j.formatted_description IS NOT NULL`;

// One combined pool across every rotation source, ranked purely by recency —
// not round-robin-by-source. "Share the latest job" means the single most
// recently posted eligible job wins a slot regardless of which platform it
// came from; picking one-per-source-in-turn (the old approach) could hand
// out an older LinkedIn job ahead of a newer Himalayas one just because of
// rotation order. No per-source cap either — a source can fill the whole
// batch if its jobs are genuinely the freshest.
async function selectJobBatch(platform: string, batchSize: number): Promise<JobRow[]> {
  if (batchSize <= 0) return [];
  return prisma.$queryRaw<JobRow[]>`
    SELECT j.id, j.title, j.company, j.location, j.workplace_type AS "workplaceType",
           j.salary_min AS "salaryMin", j.salary_max AS "salaryMax",
           j.salary_currency AS "salaryCurrency", j.source_url AS "sourceUrl",
           j.description, j.formatted_description AS "formattedDescription",
           j.tags, j.posted_at AS "postedAt", j.source
    FROM jobs j
    WHERE j.is_active = true AND j.source IN (${Prisma.join(SOURCE_ROTATION)})
      ${FRESHER_FILTER}
      ${FORMATTED_FILTER}
      AND NOT EXISTS (
        SELECT 1 FROM dispatch_log d
        WHERE d.content_type = 'job' AND d.content_id = j.id
          AND d.platform = ${platform} AND d.posted_at IS NOT NULL
      )
    ORDER BY COALESCE(j.posted_at, j.first_seen_at) DESC
    LIMIT ${batchSize}
  `;
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
    const base = jobs.map((job) => {
      const text = flattenFormatted(job.formattedDescription) ?? job.description;
      return {
        job,
        text,
        skills: extractTechnologies(job.formattedDescription, job.description).slice(0, 6),
        experience: extractExperience(job.formattedDescription, job.description),
        email: extractEmail(job.formattedDescription, job.description),
      };
    });

    const inferred = await Promise.all(
      base.map((b) => (b.skills.length === 0 || b.experience === null ? inferJobSignals(b.text) : null))
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

  // Contests aren't ready for production yet — /contest/{id} 404s there (see
  // authNavFlags.ts), so a dispatched Telegram link would point at a dead
  // page. Skip contest dispatch entirely rather than post broken links.
  if (SHOW_UNRELEASED_NAV && (type === "all" || type === "contest")) {
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
