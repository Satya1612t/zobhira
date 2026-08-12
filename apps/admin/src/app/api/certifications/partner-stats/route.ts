import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/firebase-admin";

const RANGES: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

// Partner performance, grouped by providerSlug — the negotiating artefact
// ("we sent you 400 clicks last month from job-seeking students"). Counts are
// ::int-cast in SQL so no BigInt reaches NextResponse.json() (trap 1.2).
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  const rangeKey = new URL(request.url).searchParams.get("range") ?? "30d";
  const days = RANGES[rangeKey] ?? 30;
  const from = new Date(Date.now() - days * 86_400_000);

  const [rows, topSources] = await Promise.all([
    prisma.$queryRaw<Array<{ provider_slug: string; clicks: number; monetised: number }>>`
      SELECT provider_slug,
             count(*)::int                            AS clicks,
             count(*) FILTER (WHERE is_monetised)::int AS monetised
      FROM partner_click
      WHERE created_at >= ${from}
      GROUP BY provider_slug
      ORDER BY clicks DESC
    `,
    prisma.$queryRaw<Array<{ provider_slug: string; traffic_source: string }>>`
      SELECT DISTINCT ON (provider_slug) provider_slug, traffic_source
      FROM (
        SELECT provider_slug, traffic_source, count(*) AS n
        FROM partner_click
        WHERE created_at >= ${from}
        GROUP BY provider_slug, traffic_source
      ) t
      ORDER BY provider_slug, n DESC
    `,
  ]);

  const topByProvider = new Map(topSources.map((s) => [s.provider_slug, s.traffic_source]));

  const providers = rows.map((r) => ({
    providerSlug: r.provider_slug,
    clicks: r.clicks,
    monetised: r.monetised,
    shareMonetised: r.clicks ? Math.round((r.monetised / r.clicks) * 100) : 0,
    topSource: topByProvider.get(r.provider_slug) ?? "—",
  }));

  const totalClicks = providers.reduce((sum, p) => sum + p.clicks, 0);

  return NextResponse.json({ range: rangeKey, totalClicks, providers });
}
