import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/firebase-admin";
import { writeAuditLog } from "@/lib/auditLog";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  const body = await request.json();
  const enabled = Boolean(body.enabled);
  const source = await prisma.scraperSource.update({
    where: { name: params.name },
    data: { enabled },
  });
  writeAuditLog({
    adminEmail: admin.email,
    action: "source.set_enabled",
    targetType: "source",
    targetId: params.name,
    metadata: { enabled },
  });
  return NextResponse.json(source);
}
