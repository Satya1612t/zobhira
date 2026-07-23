import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/firebase-admin";

const SCRAPER_API_URL = process.env.SCRAPER_API_URL ?? "http://localhost:8000";

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  const response = await fetch(`${SCRAPER_API_URL}/contests/scheduler/progress`, {
    cache: "no-store",
  });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
