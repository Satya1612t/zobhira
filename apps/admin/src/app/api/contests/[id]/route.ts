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
  const contest = await prisma.contest.update({
    where: { id: params.id },
    data: { isActive: Boolean(body.isActive) },
    select: { id: true, isActive: true },
  });
  return NextResponse.json(contest);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  await prisma.contest.delete({ where: { id: params.id } });
  return NextResponse.json({ deleted: true });
}
