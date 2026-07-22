import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildContestsWhere, CONTEST_SELECT, CONTEST_ORDER_BY, type ContestSearchParams } from "@/lib/contestQuery";

const PAGE_SIZE = 50;

type RequestBody = ContestSearchParams & { excludeIds?: string[] };

export async function POST(request: NextRequest) {
  const body: RequestBody = await request.json();
  const { excludeIds = [], ...filters } = body;

  const where = buildContestsWhere(filters);
  const excludeWhere: Prisma.ContestWhereInput = excludeIds.length ? { id: { notIn: excludeIds } } : {};

  const contests = await prisma.contest.findMany({
    where: excludeIds.length ? { AND: [where, excludeWhere] } : where,
    orderBy: CONTEST_ORDER_BY,
    take: PAGE_SIZE,
    select: CONTEST_SELECT,
  });

  return NextResponse.json({ contests, done: contests.length < PAGE_SIZE });
}
