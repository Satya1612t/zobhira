import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/firebase-admin";
import { writeAuditLog } from "@/lib/auditLog";

const SCRAPER_API_URL = process.env.SCRAPER_API_URL ?? "http://localhost:8000";

// Proxies to the scraper's POST /feeds/companies/detect, which runs the
// Python ATS auto-detection (scripts/detect_ats.py) and, on a verified
// match, upserts the company into company_registry. Detection is Python-only
// (regex + live API probing), so it can't live in this Prisma layer.
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  const body = await request.json();
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!url) {
    return NextResponse.json({ detected: false, reason: "A careers-page URL is required." }, { status: 400 });
  }

  let data: unknown;
  try {
    const response = await fetch(`${SCRAPER_API_URL}/feeds/companies/detect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, name: name || null }),
    });
    data = await response.json();
  } catch {
    return NextResponse.json(
      { detected: false, reason: "Could not reach the scraper service. Is it running (see README)?" },
      { status: 502 }
    );
  }

  const result = data as { detected?: boolean; provider?: string; token?: string; name?: string };
  if (result.detected) {
    writeAuditLog({
      adminEmail: admin.email,
      action: "company.add",
      targetType: "company",
      targetId: result.token ?? url,
      metadata: { provider: result.provider ?? "", name: result.name ?? "" },
    });
  }
  return NextResponse.json(data);
}
