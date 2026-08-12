import { NextRequest, NextResponse } from "next/server";
import { suggestSkills } from "@/lib/skillVocab";

export const runtime = "nodejs";

// Autocomplete for the profile skills input — canonical vocabulary only.
// Public (no auth): it reveals nothing sensitive, just the skill list the job
// search already exposes.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (q.trim().length < 2) return NextResponse.json({ skills: [] });
  const skills = await suggestSkills(q);
  return NextResponse.json({ skills });
}
