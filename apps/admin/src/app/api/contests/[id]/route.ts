import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/firebase-admin";
import { writeAuditLog } from "@/lib/auditLog";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  const body = await request.json();
  const isActive = Boolean(body.isActive);
  const contest = await prisma.contest.update({
    where: { id: params.id },
    data: { isActive },
    select: { id: true, isActive: true },
  });
  writeAuditLog({
    adminEmail: admin.email,
    action: "contest.set_active",
    targetType: "contest",
    targetId: params.id,
    metadata: { isActive },
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
  writeAuditLog({
    adminEmail: admin.email,
    action: "contest.delete",
    targetType: "contest",
    targetId: params.id,
  });
  return NextResponse.json({ deleted: true });
}
