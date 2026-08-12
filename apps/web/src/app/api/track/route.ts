import { NextResponse, type NextRequest } from "next/server";
import geoip from "fast-geoip";
import { prisma } from "@/lib/prisma";

// Prisma is Node-only; this route can't run on Edge.
export const runtime = "nodejs";

// Resolve the visitor's country. Prod sits behind nginx-proxy (not
// Cloudflare), so the old `cf-ipcountry` header never exists — country was
// always null. Derive it from the forwarded client IP via an OFFLINE GeoIP
// lookup instead (fast-geoip reads a few KB per call, no external request, so
// it can't slow or block the track write). Still prefers a CDN country header
// if one is ever present, so putting Cloudflare in front later just works.
function clientIpFrom(request: NextRequest): string | null {
  // X-Forwarded-For is "client, proxy1, proxy2…" — the leftmost entry is the
  // original visitor (nginx-proxy appends the immediate peer on the right).
  const xff = request.headers.get("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim();
  if (first) return first;
  return request.headers.get("x-real-ip");
}

async function countryFrom(request: NextRequest): Promise<string | null> {
  const cf = request.headers.get("cf-ipcountry");
  if (cf && cf !== "XX") return cf; // XX = Cloudflare "unknown"
  const ip = clientIpFrom(request);
  if (!ip) return null;
  try {
    const geo = await geoip.lookup(ip);
    return geo?.country ?? null; // 2-letter ISO, same shape cf-ipcountry used
  } catch {
    return null; // a geo miss must never break the track write
  }
}

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

  let body: { type?: string; path?: string; contentType?: string; contentId?: string; certificationId?: string };
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
          country: await countryFrom(request),
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
    } else if (
      body.type === "partner_click" &&
      body.certificationId &&
      UUID_RE.test(body.certificationId)
    ) {
      // Snapshot provider/network/monetised AT CLICK TIME — a later re-price or
      // a changed deal must not rewrite what past clicks were worth. Separate
      // table from apply_click on purpose (it must not corrupt the job/contest
      // engagement numbers the admin dashboard reads).
      const cert = await prisma.certification.findUnique({
        where: { id: body.certificationId },
        select: { providerSlug: true, affiliateNetwork: true, affiliateUrl: true },
      });
      if (cert) {
        await prisma.partnerClick.create({
          data: {
            visitorId,
            sessionId,
            certificationId: body.certificationId,
            providerSlug: cert.providerSlug,
            affiliateNetwork: cert.affiliateNetwork,
            isMonetised: cert.affiliateUrl != null,
            trafficSource: attribution.source,
          },
        });
      }
    }
  } catch (error) {
    // Analytics must never break a page load or an apply click.
    console.error("[track]", error);
  }

  return new NextResponse(null, { status: 204 });
}
