import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/firebase-admin";
import { writeAuditLog } from "@/lib/auditLog";

function parseId(raw: string): bigint | null {
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  const id = parseId(params.id);
  if (id === null) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const body = await request.json();
  const isActive = Boolean(body.isActive);
  const company = await prisma.companyRegistry.update({
    where: { id },
    data: { isActive },
    select: { id: true, isActive: true },
  });
  writeAuditLog({
    adminEmail: admin.email,
    action: "company.set_active",
    targetType: "company",
    targetId: params.id,
    metadata: { isActive },
  });
  return NextResponse.json({ id: Number(company.id), isActive: company.isActive });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  const id = parseId(params.id);
  if (id === null) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  await prisma.companyRegistry.delete({ where: { id } });
  writeAuditLog({
    adminEmail: admin.email,
    action: "company.delete",
    targetType: "company",
    targetId: params.id,
  });
  return NextResponse.json({ deleted: true });
}
