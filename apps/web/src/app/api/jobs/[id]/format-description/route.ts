import { NextRequest, NextResponse } from "next/server";

const SCRAPER_API_URL = process.env.SCRAPER_API_URL ?? "http://localhost:8000";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const response = await fetch(`${SCRAPER_API_URL}/jobs/${id}/format-description`, {
    method: "POST",
  });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
