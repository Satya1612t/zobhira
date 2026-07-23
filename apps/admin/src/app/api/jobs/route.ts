import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/firebase-admin";

const PAGE_SIZE = 50;

// Admin-only select — unlike the public JOB_SELECT (apps/web) this
// deliberately stays minimal (no description/highlights/raw) since it's a
// dense management table, not a listing card; isActive is always included
// here (the public select has it too, but the public where-clause always
// forces isActive: true so it's never actually filterable there).
const ADMIN_JOB_SELECT = {
  id: true,
  title: true,
  company: true,
  source: true,
  location: true,
  isActive: true,
  postedAt: true,
  deadlineAt: true,
} satisfies Prisma.JobSelect;

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const source = searchParams.get("source") || undefined;
  const isActiveParam = searchParams.get("isActive");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const where: Prisma.JobWhereInput = {
    ...(source ? { source } : {}),
    ...(isActiveParam === "true" ? { isActive: true } : {}),
    ...(isActiveParam === "false" ? { isActive: false } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { company: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: { lastScrapedAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      select: ADMIN_JOB_SELECT,
    }),
    prisma.job.count({ where }),
  ]);

  return NextResponse.json({ jobs, total, page, pageSize: PAGE_SIZE });
}
