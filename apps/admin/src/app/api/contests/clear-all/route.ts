import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/firebase-admin";
import { writeAuditLog } from "@/lib/auditLog";

// TEMPORARY: bulk-wipe endpoint backing the admin "Danger Zone" clear-all
// button — see AdminDangerZone.tsx. Remove alongside that component once
// it's no longer needed.
export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  const { count } = await prisma.contest.deleteMany({});
  writeAuditLog({
    adminEmail: admin.email,
    action: "contest.clear_all",
    targetType: "contest",
    targetId: "all",
    metadata: { count },
  });
  return NextResponse.json({ deleted: count });
}
