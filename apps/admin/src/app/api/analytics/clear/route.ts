import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/firebase-admin";
import { writeAuditLog } from "@/lib/auditLog";

// TEMPORARY: wipes all first-party analytics (page_view + apply_click) so the
// numbers can restart clean after the source/country attribution fixes. Admin-
// gated and audit-logged. TRUNCATE takes no params — no user input reaches SQL.
// Remove this route (and the button in AdminAnalytics) once the reset is done.
export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  try {
    await prisma.$executeRawUnsafe("TRUNCATE page_view, apply_click");
  } catch {
    return NextResponse.json({ ok: false, error: "Could not clear analytics." }, { status: 500 });
  }

  writeAuditLog({
    adminEmail: admin.email,
    action: "analytics.clear",
    targetType: "analytics",
    targetId: "page_view+apply_click",
  });
  return NextResponse.json({ ok: true });
}
