import { NextResponse, type NextRequest } from "next/server";
import { resolveAttribution } from "@/lib/analytics";

const VISITOR_COOKIE = "zb_vid";
const SESSION_COOKIE = "zb_sid";
const SOURCE_COOKIE = "zb_src";

const VISITOR_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
const SESSION_MAX_AGE = 60 * 30; // 30 min, sliding

const COOKIE_BASE = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

// Assigns the two ids every analytics row is keyed by, and resolves traffic
// attribution once per session so a click three pages deep still credits the
// source the visitor actually arrived from.
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Visitor — persistent.
  if (!request.cookies.get(VISITOR_COOKIE)?.value) {
    response.cookies.set(VISITOR_COOKIE, crypto.randomUUID(), {
      ...COOKIE_BASE,
      maxAge: VISITOR_MAX_AGE,
    });
  }

  // Session — 30 min sliding window, re-set on every request.
  const existingSession = request.cookies.get(SESSION_COOKIE)?.value;
  response.cookies.set(SESSION_COOKIE, existingSession ?? crypto.randomUUID(), {
    ...COOKIE_BASE,
    maxAge: SESSION_MAX_AGE,
  });

  // Attribution — resolved on the session's first request, then carried.
  if (!existingSession) {
    const attribution = resolveAttribution(
      request.nextUrl.searchParams,
      request.headers.get("referer"),
      request.nextUrl.hostname
    );
    response.cookies.set(SOURCE_COOKIE, JSON.stringify(attribution), {
      ...COOKIE_BASE,
      maxAge: SESSION_MAX_AGE,
    });
  } else {
    const carried = request.cookies.get(SOURCE_COOKIE)?.value;
    if (carried) {
      response.cookies.set(SOURCE_COOKIE, carried, { ...COOKIE_BASE, maxAge: SESSION_MAX_AGE });
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Page requests only. Excludes static assets, the track endpoint itself,
    // and the dispatch API (n8n polls it on a shared secret, not a browser —
    // it should never be handed a visitor cookie).
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|ads.txt|icon.png|apple-icon.png|api/track|api/dispatch).*)",
  ],
};
