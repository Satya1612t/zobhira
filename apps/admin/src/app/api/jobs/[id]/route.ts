import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/firebase-admin";
import { writeAuditLog } from "@/lib/auditLog";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  const job = await prisma.job.findUnique({ where: { id: params.id } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // companyId is a Postgres BIGINT (company_registry.id) -> Prisma BigInt,
  // which JSON.stringify (and therefore NextResponse.json) cannot serialize
  // natively. Cast to a plain number for the response only — safe here
  // since company_registry is a small (dozens-to-low-thousands row) table,
  // nowhere near Number.MAX_SAFE_INTEGER.
  return NextResponse.json({
    ...job,
    companyId: job.companyId === null ? null : Number(job.companyId),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  const body = await request.json();
  const isActive = Boolean(body.isActive);
  const job = await prisma.job.update({
    where: { id: params.id },
    data: { isActive },
    select: { id: true, isActive: true },
  });
  writeAuditLog({
    adminEmail: admin.email,
    action: "job.set_active",
    targetType: "job",
    targetId: params.id,
    metadata: { isActive },
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
  writeAuditLog({
    adminEmail: admin.email,
    action: "job.delete",
    targetType: "job",
    targetId: params.id,
  });
  return NextResponse.json({ deleted: true });
}
