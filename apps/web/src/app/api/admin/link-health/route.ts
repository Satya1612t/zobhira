import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDispatchKey } from "@/lib/dispatchAuth";

// Bounded per call — this is meant to be triggered periodically (e.g. a
// daily n8n/cron POST), gradually cycling through every active job's
// sourceUrl a batch at a time rather than checking hundreds of external
// sites in one request.
const BATCH_SIZE = 20;
const TIMEOUT_MS = 8000;

// Only these statuses are treated as "confirmed gone" — safe to deactivate
// on. Everything else (timeouts, 5xx, DNS failures, a site that rejects
// HEAD outright) is inconclusive, not dead: those are just as consistent
// with "this site is temporarily unhappy" as "this job is gone", and a
// wrongly-deactivated real job is worse than leaving a maybe-dead link for
// the next batch to check again.
const CONFIRMED_DEAD_STATUSES = new Set([404, 410]);

// Default dry-run switch — set LINK_HEALTH_DRY_RUN=true in the environment
// to run every check without actually deactivating anything, logging what
// *would* have been deactivated instead. Meant for a short trial period
// after standing this up (or after touching the dead-link heuristics
// below): landedOnRoot in particular is a guess, not a certainty — some
// sites (LinkedIn especially) redirect a still-live job to the homepage
// when the request looks logged-out/blocked, not just when the job is
// actually gone. Watch dry-run output for a few days, spot-check a few of
// the flagged URLs by hand, and only then turn this off. A `?dryRun=`
// query param always overrides the env var for one-off manual testing.
const DRY_RUN_DEFAULT = process.env.LINK_HEALTH_DRY_RUN === "true";

type LinkStatus = "alive" | "dead" | "inconclusive";
type DeadReason = "404" | "410" | "landedOnRoot";

async function checkLink(url: string): Promise<{ status: LinkStatus; reason?: DeadReason }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      // A bare/identifying user-agent alone gets a flat 406 from at least
      // one real source (workatastartup.com, confirmed live) — content
      // negotiation there requires real browser-shaped Accept/Accept-
      // Language headers too, not just a User-Agent string.
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.5",
      },
    });

    if (CONFIRMED_DEAD_STATUSES.has(res.status)) {
      return { status: "dead", reason: res.status === 404 ? "404" : "410" };
    }
    if (!res.ok) return { status: "inconclusive" };

    // A redirect that lands on the bare site root (when the original URL
    // wasn't already the root) usually means the specific posting was
    // pulled and the host bounced the request to its homepage instead of
    // returning a real 404.
    const finalPath = new URL(res.url).pathname;
    const originalPath = new URL(url).pathname;
    const landedOnRoot = finalPath === "/" || finalPath === "";
    const wasNotAlreadyRoot = originalPath !== "/" && originalPath !== "";
    if (landedOnRoot && wasNotAlreadyRoot) return { status: "dead", reason: "landedOnRoot" };

    return { status: "alive" };
  } catch {
    return { status: "inconclusive" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: NextRequest) {
  const denied = requireDispatchKey(request);
  if (denied) return denied;

  const dryRunParam = request.nextUrl.searchParams.get("dryRun");
  const dryRun = dryRunParam !== null ? dryRunParam === "true" : DRY_RUN_DEFAULT;

  const jobs = await prisma.job.findMany({
    where: { isActive: true },
    orderBy: [{ linkCheckedAt: { sort: "asc", nulls: "first" } }],
    take: BATCH_SIZE,
    select: { id: true, sourceUrl: true },
  });

  const results = await Promise.all(
    jobs.map(async (job) => ({ job, ...(await checkLink(job.sourceUrl)) }))
  );

  const dead = results.filter((r) => r.status === "dead");
  const deadIds = dead.map((r) => r.job.id);
  const checkedAt = new Date();

  await prisma.$transaction([
    // linkCheckedAt always advances, dry run or not — otherwise the same
    // batch (oldest-checked-first) would just get re-checked every call
    // instead of cycling through the rest of the active jobs.
    prisma.job.updateMany({
      where: { id: { in: results.map((r) => r.job.id) } },
      data: { linkCheckedAt: checkedAt },
    }),
    ...(!dryRun && deadIds.length
      ? [prisma.job.updateMany({ where: { id: { in: deadIds } }, data: { isActive: false } })]
      : []),
  ]);

  if (dryRun && dead.length) {
    console.warn(
      `[link-health dry-run] would deactivate ${dead.length} job(s):`,
      dead.map((r) => `${r.job.id} (${r.reason}): ${r.job.sourceUrl}`).join("; ")
    );
  }

  return NextResponse.json({
    dryRun,
    checked: results.length,
    deactivated: dryRun ? 0 : deadIds.length,
    inconclusive: results.filter((r) => r.status === "inconclusive").length,
    ...(dryRun
      ? {
          wouldDeactivate: dead.map((r) => ({
            id: r.job.id,
            sourceUrl: r.job.sourceUrl,
            reason: r.reason,
          })),
        }
      : {}),
  });
}
