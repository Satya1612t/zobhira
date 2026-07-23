import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/firebase-admin";

const PAGE_SIZE = 50;

const ADMIN_CONTEST_SELECT = {
  id: true,
  title: true,
  platform: true,
  organizer: true,
  isActive: true,
  startsAt: true,
  deadlineAt: true,
} satisfies Prisma.ContestSelect;

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const platform = searchParams.get("platform") || undefined;
  const isActiveParam = searchParams.get("isActive");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const where: Prisma.ContestWhereInput = {
    ...(platform ? { platform } : {}),
    ...(isActiveParam === "true" ? { isActive: true } : {}),
    ...(isActiveParam === "false" ? { isActive: false } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { organizer: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [contests, total] = await Promise.all([
    prisma.contest.findMany({
      where,
      orderBy: { lastScrapedAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      select: ADMIN_CONTEST_SELECT,
    }),
    prisma.contest.count({ where }),
  ]);

  return NextResponse.json({ contests, total, page, pageSize: PAGE_SIZE });
}
