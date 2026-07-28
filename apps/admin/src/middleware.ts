import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";

// Mutating calls (delete a job/contest, flip a source, trigger a scraper run)
// are far more expensive/damaging per-request than a read, so they get a
// tighter budget. Both are generous for normal use by a handful of admins and
// tight enough to stop a leaked token or a runaway client from hammering the
// scraper or mass-deleting rows.
const READ_LIMIT = 120;
const WRITE_LIMIT = 30;
const WINDOW_MS = 60_000;

// Structural safety net in front of every /api/* route: rejects requests with
// no (or malformed) Authorization header before they ever reach a handler.
// This runs on the Edge runtime, which can't load firebase-admin (Node-only),
// so it can't verify the token's signature or check ADMIN_ALLOWED_EMAILS
// itself — that full verification stays in requireAdmin() (lib/firebase-admin.ts),
// which every route already calls. What this catches is the case a per-route
// call can't: a future route that forgets to call requireAdmin() at all no
// longer means an open endpoint, since totally unauthenticated requests are
// stopped here first.
export function middleware(request: NextRequest) {
  const isMutating = request.method !== "GET" && request.method !== "HEAD";
  const rateLimitKey = `${clientIp(request)}:${isMutating ? "write" : "read"}`;
  const { allowed, retryAfterSeconds } = checkRateLimit(
    rateLimitKey,
    isMutating ? WRITE_LIMIT : READ_LIMIT,
    WINDOW_MS
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
