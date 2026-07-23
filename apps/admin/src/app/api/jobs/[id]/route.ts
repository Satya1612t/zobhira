import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/firebase-admin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  const body = await request.json();
  const job = await prisma.job.update({
    where: { id: params.id },
    data: { isActive: Boolean(body.isActive) },
    select: { id: true, isActive: true },
  });
  return NextResponse.json(job);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  await prisma.job.delete({ where: { id: params.id } });
  return NextResponse.json({ deleted: true });
}
