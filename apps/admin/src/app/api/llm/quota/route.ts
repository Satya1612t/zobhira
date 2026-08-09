import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/firebase-admin";

const SCRAPER_API_URL = process.env.SCRAPER_API_URL ?? "http://localhost:8000";

// Proxies to the scraper's GET /llm/quota, which reads the self-hosted
// FreeLLMAPI router's own dashboard API (provider health + usage). The
// scraper holds the router admin creds; this route just gates on requireAdmin.
export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  try {
    const response = await fetch(`${SCRAPER_API_URL}/llm/quota`, { cache: "no-store" });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json(
      { configured: true, error: "Could not reach the scraper service. Is it running (see README)?" },
      { status: 502 }
    );
  }
}
