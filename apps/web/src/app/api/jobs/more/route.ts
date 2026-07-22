import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildJobsWhere, JOB_SELECT, type SearchParams } from "@/lib/jobQuery";

const PAGE_SIZE = 50;

// Powers infinite scroll on the Jobs/Live Opening pages. Two-phase: while
// `mode === "filtered"`, keep paging through whatever matches the user's
// active filters; once that's exhausted (0 rows left), fall through in the
// SAME request to an unfiltered "general" listing so scrolling never just
// dead-ends — the client is told which mode to send on its NEXT request via
// the response's `mode` field. `excludeIds` accumulates every job already
// rendered client-side (both phases) so switching modes can never re-show
// something already on screen, without needing cursor/offset math that
// nullable `postedAt` values would complicate.
type RequestBody = SearchParams & {
  mode?: "filtered" | "general";
  excludeIds?: string[];
  liveWindowHours?: number;
};

export async function POST(request: NextRequest) {
  const body: RequestBody = await request.json();
  const { mode = "filtered", excludeIds = [], liveWindowHours, ...filters } = body;

  // Combined via AND rather than spread — both the experience filter (in
  // `buildJobsWhere`'s where, as `id: { in: [...] }`) and this exclude list
  // (`id: { notIn: [...] }`) can set the `id` key, and spreading two objects
  // that share a key silently drops one of them.
  const excludeWhere: Prisma.JobWhereInput = excludeIds.length ? { id: { notIn: excludeIds } } : {};
  const liveWhere = liveWindowHours
    ? { postedAt: { gte: new Date(Date.now() - liveWindowHours * 60 * 60 * 1000) } }
    : {};
  const orderBy = [
    { postedAt: filters.sort === "oldest" ? ("asc" as const) : ("desc" as const) },
    { id: "desc" as const },
  ];

  if (mode === "filtered") {
    const { where } = await buildJobsWhere(filters, liveWhere);
    const jobs = await prisma.job.findMany({
      where: excludeIds.length ? { AND: [where, excludeWhere] } : where,
      orderBy,
      take: PAGE_SIZE,
      select: JOB_SELECT,
    });
    if (jobs.length > 0) {
      return NextResponse.json({ jobs, mode: "filtered", done: false });
    }
    // Filtered scope exhausted — fall through to the general listing below
    // instead of returning an empty page.
  }

  const jobs = await prisma.job.findMany({
    where: { isActive: true, ...liveWhere, ...excludeWhere },
    orderBy,
    take: PAGE_SIZE,
    select: JOB_SELECT,
  });
  return NextResponse.json({ jobs, mode: "general", done: jobs.length === 0 });
}
