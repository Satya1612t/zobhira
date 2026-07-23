import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/firebase-admin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  const body = await request.json();
  const source = await prisma.scraperSource.update({
    where: { name: params.name },
    data: { enabled: Boolean(body.enabled) },
  });
  return NextResponse.json(source);
}
