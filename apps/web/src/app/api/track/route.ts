import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// Prisma is Node-only; this route can't run on Edge.
export const runtime = "nodejs";

// Your own scrapers, Playwright, Googlebot, and uptime checks all hit these
// pages. Filtering at write time keeps them out of the numbers permanently —
// filtering at read time means every query carries the exclusion forever.
const BOT_UA =
  /bot|crawler|spider|crawling|slurp|bingpreview|headless|playwright|puppeteer|python-requests|httpx|curl|wget|axios|scrapy|lighthouse|gtmetrix|pingdom|uptime|monitor/i;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Attribution = { source: string; medium: string | null; campaign: string | null };

function readAttribution(raw: string | undefined): Attribution {
  if (!raw) return { source: "direct", medium: null, campaign: null };
  try {
    const parsed = JSON.parse(raw) as Partial<Attribution>;
    return {
      source: String(parsed.source ?? "direct").slice(0, 64),
      medium: parsed.medium ? String(parsed.medium).slice(0, 64) : null,
      campaign: parsed.campaign ? String(parsed.campaign).slice(0, 128) : null,
    };
  } catch {
    return { source: "direct", medium: null, campaign: null };
  }
}

function deviceFrom(ua: string): "mobile" | "tablet" | "desktop" {
  if (/tablet|ipad/i.test(ua)) return "tablet";
  if (/mobile|android|iphone/i.test(ua)) return "mobile";
  return "desktop";
}

export async function POST(request: NextRequest) {
  const ua = request.headers.get("user-agent") ?? "";
  if (!ua || BOT_UA.test(ua)) return new NextResponse(null, { status: 204 });

  const visitorId = request.cookies.get("zb_vid")?.value;
  const sessionId = request.cookies.get("zb_sid")?.value;
  if (!visitorId || !sessionId || !UUID_RE.test(visitorId) || !UUID_RE.test(sessionId)) {
    return new NextResponse(null, { status: 204 });
  }

  const attribution = readAttribution(request.cookies.get("zb_src")?.value);

  let body: { type?: string; path?: string; contentType?: string; contentId?: string };
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  try {
    if (body.type === "page_view" && body.path) {
      await prisma.pageView.create({
        data: {
          visitorId,
          sessionId,
          path: body.path.slice(0, 512),
          referrer: request.headers.get("referer")?.slice(0, 512) ?? null,
          trafficSource: attribution.source,
          utmMedium: attribution.medium,
          utmCampaign: attribution.campaign,
          device: deviceFrom(ua),
          country: request.headers.get("cf-ipcountry") ?? null,
        },
      });
    } else if (
      body.type === "apply_click" &&
      (body.contentType === "job" || body.contentType === "contest") &&
      body.contentId &&
      UUID_RE.test(body.contentId)
    ) {
      await prisma.applyClick.create({
        data: {
          visitorId,
          sessionId,
          contentType: body.contentType,
          contentId: body.contentId,
          trafficSource: attribution.source,
        },
      });
    }
  } catch (error) {
    // Analytics must never break a page load or an apply click.
    console.error("[track]", error);
  }

  return new NextResponse(null, { status: 204 });
}
