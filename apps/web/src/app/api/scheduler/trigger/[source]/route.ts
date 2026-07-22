import { NextRequest, NextResponse } from "next/server";

const SCRAPER_API_URL = process.env.SCRAPER_API_URL ?? "http://localhost:8000";

// The recent-searches LinkedIn sweep lives at a different backend path
// (`/scheduler/trigger/recent-searches/linkedin`, not through
// scheduler.SOURCE_TIER like every other source) since it isn't one of the
// tiered sources — this card's key needs translating before proxying.
const SOURCE_PATH_OVERRIDES: Record<string, string> = {
  linkedin_recent_searches: "recent-searches/linkedin",
};

export async function POST(
  _request: NextRequest,
  { params }: { params: { source: string } }
) {
  const { source } = params;
  const path = SOURCE_PATH_OVERRIDES[source] ?? source;
  const response = await fetch(`${SCRAPER_API_URL}/scheduler/trigger/${path}`, {
    method: "POST",
  });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
