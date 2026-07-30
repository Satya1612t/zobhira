import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/firebase-admin";

const PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  const { searchParams } = new URL(request.url);
  const targetType = searchParams.get("targetType") || undefined;
  const action = searchParams.get("action") || undefined;
  const q = searchParams.get("q")?.trim();
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const where: Prisma.AdminAuditLogWhereInput = {
    ...(targetType ? { targetType } : {}),
    ...(action ? { action } : {}),
    ...(q
      ? {
          OR: [
            { adminEmail: { contains: q, mode: "insensitive" } },
            { targetId: { contains: q, mode: "insensitive" } },
            { action: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [entries, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.adminAuditLog.count({ where }),
  ]);

  return NextResponse.json({ entries, total, page, pageSize: PAGE_SIZE });
}
