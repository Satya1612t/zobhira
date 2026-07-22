import { NextResponse } from "next/server";

const SCRAPER_API_URL = process.env.SCRAPER_API_URL ?? "http://localhost:8000";

export async function GET() {
  const response = await fetch(`${SCRAPER_API_URL}/scheduler/progress`, {
    cache: "no-store",
  });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
