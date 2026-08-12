import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildCertificationsWhere,
  CERTIFICATION_SELECT,
  CERTIFICATION_ORDER_BY,
  mapCertification,
  type CertificationSearchParams,
} from "@/lib/certificationQuery";

const PAGE_SIZE = 50;

type RequestBody = CertificationSearchParams & { excludeIds?: string[] };

export async function POST(request: NextRequest) {
  const body: RequestBody = await request.json();
  const { excludeIds = [], ...filters } = body;

  const where = buildCertificationsWhere(filters);
  const excludeWhere: Prisma.CertificationWhereInput = excludeIds.length ? { id: { notIn: excludeIds } } : {};

  const rows = await prisma.certification.findMany({
    where: excludeIds.length ? { AND: [where, excludeWhere] } : where,
    orderBy: CERTIFICATION_ORDER_BY,
    take: PAGE_SIZE,
    select: CERTIFICATION_SELECT,
  });

  return NextResponse.json({
    certifications: rows.map(mapCertification),
    done: rows.length < PAGE_SIZE,
  });
}
