import { NextRequest, NextResponse } from "next/server";

const SCRAPER_API_URL = process.env.SCRAPER_API_URL ?? "http://localhost:8000";

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (typeof body.query !== "string" || !body.query.trim()) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const response = await fetch(`${SCRAPER_API_URL}/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: body.query,
      location: typeof body.location === "string" && body.location.trim() ? body.location : undefined,
    }),
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
