import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/firebase-admin";

const RANGES: Record<string, number> = { "1d": 1, "7d": 7, "30d": 30, "90d": 90 };

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  const rangeKey = new URL(request.url).searchParams.get("range") ?? "30d";
  const days = RANGES[rangeKey] ?? 30;
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);

  const [totals, bySource, topContent, daily] = await Promise.all([
    prisma.$queryRaw<Array<{ visitors: number; sessions: number; page_views: number; clicks: number }>>`
      SELECT
        (SELECT COUNT(DISTINCT visitor_id)::int FROM page_view
           WHERE created_at BETWEEN ${from} AND ${to}) AS visitors,
        (SELECT COUNT(DISTINCT session_id)::int  FROM page_view
           WHERE created_at BETWEEN ${from} AND ${to}) AS sessions,
        (SELECT COUNT(*)::int                    FROM page_view
           WHERE created_at BETWEEN ${from} AND ${to}) AS page_views,
        (SELECT COUNT(*)::int                    FROM apply_click
           WHERE created_at BETWEEN ${from} AND ${to}) AS clicks
    `,

    // Aggregate each table separately, then join. Joining page_view to
    // apply_click on visitor_id *before* aggregating multiplies every click by
    // that visitor's page-view count and silently inflates the numbers.
    prisma.$queryRaw<Array<{ source: string; visitors: number; page_views: number; clicks: number }>>`
      WITH v AS (
        SELECT traffic_source AS source,
               COUNT(DISTINCT visitor_id)::int AS visitors,
               COUNT(*)::int                   AS page_views
        FROM page_view
        WHERE created_at BETWEEN ${from} AND ${to}
        GROUP BY traffic_source
      ),
      c AS (
        SELECT traffic_source AS source, COUNT(*)::int AS clicks
        FROM apply_click
        WHERE created_at BETWEEN ${from} AND ${to}
        GROUP BY traffic_source
      )
      SELECT v.source, v.visitors, v.page_views, COALESCE(c.clicks, 0) AS clicks
      FROM v LEFT JOIN c ON c.source = v.source
      ORDER BY v.visitors DESC
    `,

    prisma.$queryRaw<Array<{
      content_type: string; content_id: string;
      title: string | null; subtitle: string | null;
      clicks: number; visitors: number;
    }>>`
      SELECT a.content_type,
             a.content_id::text                  AS content_id,
             COALESCE(j.title, ct.title)         AS title,
             COALESCE(j.company, ct.organizer)   AS subtitle,
             COUNT(*)::int                       AS clicks,
             COUNT(DISTINCT a.visitor_id)::int   AS visitors
      FROM apply_click a
      LEFT JOIN jobs     j  ON a.content_type = 'job'     AND j.id  = a.content_id
      LEFT JOIN contests ct ON a.content_type = 'contest' AND ct.id = a.content_id
      WHERE a.created_at BETWEEN ${from} AND ${to}
      GROUP BY a.content_type, a.content_id, j.title, j.company, ct.title, ct.organizer
      ORDER BY clicks DESC
      LIMIT 20
    `,

    prisma.$queryRaw<Array<{ day: string; visitors: number; clicks: number }>>`
      WITH days AS (
        SELECT generate_series(${from}::date, ${to}::date, '1 day')::date AS day
      )
      SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
             COALESCE(v.visitors, 0)      AS visitors,
             COALESCE(c.clicks, 0)        AS clicks
      FROM days d
      LEFT JOIN (
        SELECT created_at::date AS day, COUNT(DISTINCT visitor_id)::int AS visitors
        FROM page_view WHERE created_at BETWEEN ${from} AND ${to} GROUP BY 1
      ) v ON v.day = d.day
      LEFT JOIN (
        SELECT created_at::date AS day, COUNT(*)::int AS clicks
        FROM apply_click WHERE created_at BETWEEN ${from} AND ${to} GROUP BY 1
      ) c ON c.day = d.day
      ORDER BY d.day
    `,
  ]);

  const t = totals[0];
  return NextResponse.json({
    totals: {
      visitors: t.visitors,
      sessions: t.sessions,
      pageViews: t.page_views,
      clicks: t.clicks,
      clicksPerVisitor: t.visitors ? +(t.clicks / t.visitors).toFixed(2) : 0,
    },
    bySource: bySource.map((r) => ({
      source: r.source,
      visitors: r.visitors,
      pageViews: r.page_views,
      clicks: r.clicks,
      clicksPerVisitor: r.visitors ? +(r.clicks / r.visitors).toFixed(2) : 0,
    })),
    topContent: topContent.map((r) => ({
      contentType: r.content_type,
      contentId: r.content_id,
      title: r.title,
      subtitle: r.subtitle,
      clicks: r.clicks,
      visitors: r.visitors,
    })),
    daily,
  });
}
