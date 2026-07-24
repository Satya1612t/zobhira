import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDispatchKey } from "@/lib/dispatchAuth";
import { extractTechnologies, extractExperience, extractEmail } from "@/lib/jobInsights";
import { inferJobSignals } from "@/lib/dispatchLlm";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const VALID_PLATFORMS = ["telegram", "whatsapp", "instagram", "youtube"];
const SITE_ORIGIN = "https://zobhira.com";

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

export async function GET(request: NextRequest) {
  const denied = requireDispatchKey(request);
  if (denied) return denied;

  const sp = request.nextUrl.searchParams;
  const platform = sp.get("platform") ?? "";
  const type = sp.get("type") ?? "all";
  const limit = Math.min(Number(sp.get("limit")) || DEFAULT_LIMIT, MAX_LIMIT);

  if (!VALID_PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: "Unknown platform" }, { status: 400 });
  }

  const items: unknown[] = [];

  if (type === "all" || type === "job") {
    const jobs = await prisma.$queryRaw<JobRow[]>`
      SELECT j.id, j.title, j.company, j.location, j.workplace_type AS "workplaceType",
             j.salary_min AS "salaryMin", j.salary_max AS "salaryMax",
             j.salary_currency AS "salaryCurrency", j.source_url AS "sourceUrl",
             j.description, j.tags, j.posted_at AS "postedAt"
      FROM jobs j
      WHERE j.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM dispatch_log d
          WHERE d.content_type = 'job' AND d.content_id = j.id
            AND d.platform = ${platform} AND d.posted_at IS NOT NULL
        )
      ORDER BY j.first_seen_at ASC
      LIMIT ${limit}
    `;

    // Deterministic pass first, for every job. Only jobs still missing
    // skills/experience afterward get a freellmapi call, and those calls run
    // in parallel (not one `await` per job in sequence) so a batch of N
    // fallbacks costs ~one timeout window, not N of them.
    // `tags` (rendered separately as hashtags below) mixes designation/role
    // labels ("Fulltime", "Engineering manager") with real tech, so it isn't
    // a reliable skills source on its own — only extractTechnologies'
    // curated tech-keyword match feeds `skills`, to avoid "Skills Required:
    // Fulltime" and avoid the same value appearing twice in one message.
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
    const contests = await prisma.$queryRaw<ContestRow[]>`
      SELECT c.id, c.title, c.platform AS "contestPlatform", c.organizer, c.mode,
             c.prize_amount AS "prizeAmount", c.prize_currency AS "prizeCurrency",
             c.prize_summary AS "prizeSummary", c.source_url AS "sourceUrl",
             c.tags, c.starts_at AS "startsAt", c.deadline_at AS "deadlineAt"
      FROM contests c
      WHERE c.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM dispatch_log d
          WHERE d.content_type = 'contest' AND d.content_id = c.id
            AND d.platform = ${platform} AND d.posted_at IS NOT NULL
        )
      ORDER BY c.first_seen_at ASC
      LIMIT ${limit}
    `;

    for (const contest of contests) {
      items.push({
        contentType: "contest",
        id: contest.id,
        title: contest.title,
        contestPlatform: contest.contestPlatform,
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
