import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  const [total, active, totalBySource, activeBySource] = await Promise.all([
    prisma.job.count(),
    prisma.job.count({ where: { isActive: true } }),
    prisma.job.groupBy({ by: ["source"], _count: { _all: true } }),
    prisma.job.groupBy({ by: ["source"], where: { isActive: true }, _count: { _all: true } }),
  ]);
  const activeMap = new Map(activeBySource.map((row) => [row.source, row._count._all]));
  const bySource = totalBySource
    .map((row) => ({ source: row.source, total: row._count._all, active: activeMap.get(row.source) ?? 0 }))
    .sort((a, b) => b.total - a.total);
  return NextResponse.json({ total, active, inactive: total - active, bySource });
}
