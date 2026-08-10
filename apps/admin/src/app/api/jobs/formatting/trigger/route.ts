import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/firebase-admin";
import { writeAuditLog } from "@/lib/auditLog";

const SCRAPER_API_URL = process.env.SCRAPER_API_URL ?? "http://localhost:8000";

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  const response = await fetch(`${SCRAPER_API_URL}/jobs/formatting/trigger`, {
    method: "POST",
  });
  const data = await response.json();
  writeAuditLog({
    adminEmail: admin.email,
    action: "scheduler.trigger",
    targetType: "scheduler",
    targetId: "job_formatting",
    metadata: { status: response.status },
  });
  return NextResponse.json(data, { status: response.status });
}
