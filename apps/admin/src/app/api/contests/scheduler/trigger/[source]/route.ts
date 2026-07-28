import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/firebase-admin";
import { writeAuditLog } from "@/lib/auditLog";

const SCRAPER_API_URL = process.env.SCRAPER_API_URL ?? "http://localhost:8000";

export async function POST(
  request: NextRequest,
  { params }: { params: { source: string } }
) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  const { source } = params;
  const response = await fetch(`${SCRAPER_API_URL}/contests/scheduler/trigger/${source}`, {
    method: "POST",
  });
  const data = await response.json();
  writeAuditLog({
    adminEmail: admin.email,
    action: "contest_scheduler.trigger",
    targetType: "scheduler",
    targetId: source,
    metadata: { status: response.status },
  });
  return NextResponse.json(data, { status: response.status });
}
