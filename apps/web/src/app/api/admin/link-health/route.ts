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

type LinkStatus = "alive" | "dead" | "inconclusive";

async function checkLink(url: string): Promise<LinkStatus> {
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

    if (CONFIRMED_DEAD_STATUSES.has(res.status)) return "dead";
    if (!res.ok) return "inconclusive";

    // A redirect that lands on the bare site root (when the original URL
    // wasn't already the root) usually means the specific posting was
    // pulled and the host bounced the request to its homepage instead of
    // returning a real 404.
    const finalPath = new URL(res.url).pathname;
    const originalPath = new URL(url).pathname;
    const landedOnRoot = finalPath === "/" || finalPath === "";
    const wasNotAlreadyRoot = originalPath !== "/" && originalPath !== "";
    if (landedOnRoot && wasNotAlreadyRoot) return "dead";

    return "alive";
  } catch {
    return "inconclusive";
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: NextRequest) {
  const denied = requireDispatchKey(request);
  if (denied) return denied;

  const jobs = await prisma.job.findMany({
    where: { isActive: true },
    orderBy: [{ linkCheckedAt: { sort: "asc", nulls: "first" } }],
    take: BATCH_SIZE,
    select: { id: true, sourceUrl: true },
  });

  const results = await Promise.all(
    jobs.map(async (job) => ({ job, status: await checkLink(job.sourceUrl) }))
  );

  const deadIds = results.filter((r) => r.status === "dead").map((r) => r.job.id);
  const checkedAt = new Date();

  await prisma.$transaction([
    prisma.job.updateMany({
      where: { id: { in: results.map((r) => r.job.id) } },
      data: { linkCheckedAt: checkedAt },
    }),
    ...(deadIds.length
      ? [prisma.job.updateMany({ where: { id: { in: deadIds } }, data: { isActive: false } })]
      : []),
  ]);

  return NextResponse.json({
    checked: results.length,
    deactivated: deadIds.length,
    inconclusive: results.filter((r) => r.status === "inconclusive").length,
  });
}
