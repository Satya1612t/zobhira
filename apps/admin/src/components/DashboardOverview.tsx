"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";

type JobStats = { total: number; active: number; inactive: number; bySource: { source: string; total: number; active: number }[] };
type Analytics = {
  totals: { visitors: number; sessions: number; pageViews: number; clicks: number; clicksPerVisitor: number };
  bySource: { source: string; visitors: number; pageViews: number; clicks: number; clicksPerVisitor: number }[];
  topContent: { contentType: string; contentId: string; title: string | null; subtitle: string | null; clicks: number; visitors: number }[];
  daily: { day: string; visitors: number; clicks: number }[];
};
type Source = { name: string; family: string; enabled: boolean; lastError: string | null; lastErrorAt: string | null };
type DashboardData = { jobs: JobStats; analytics: Analytics; contests: number; sources: Source[] };

const SOURCE_LABELS: Record<string, string> = {
  greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby", smartrecruiters: "SmartRecruiters",
  workable: "Workable", recruitee: "Recruitee", adzuna: "Adzuna", jooble: "Jooble",
  careerjet: "Careerjet", himalayas: "Himalayas", dev_community: "DEV Community",
};
const formatCompact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function ArrowIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20"><path d="M4 10h11m-4-4 4 4-4 4" /></svg>;
}

function RefreshIcon() {
  return <svg aria-hidden="true" viewBox="0 0 20 20"><path d="M15.2 7A6 6 0 1 0 16 12M15.2 7V3.8M15.2 7H12" /></svg>;
}

function MetricCard({ label, value, detail, tone = "blue" }: { label: string; value: number | string; detail: string; tone?: "blue" | "green" | "amber" | "violet" }) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <div className="metric-card__top"><span>{label}</span><span className="metric-card__signal" aria-hidden="true" /></div>
      <strong>{typeof value === "number" ? value.toLocaleString() : value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function TrendChart({ rows }: { rows: Analytics["daily"] }) {
  const points = useMemo(() => {
    if (!rows.length) return "";
    const maximum = Math.max(1, ...rows.map((row) => row.visitors));
    return rows.map((row, index) => {
      const x = rows.length === 1 ? 50 : (index / (rows.length - 1)) * 100;
      const y = 92 - (row.visitors / maximum) * 76;
      return `${x},${y}`;
    }).join(" ");
  }, [rows]);
  const total = rows.reduce((sum, row) => sum + row.visitors, 0);
  const start = rows[0]?.day;
  const end = rows[rows.length - 1]?.day;

  return (
    <div className="trend-chart">
      <div className="trend-chart__summary">
        <div><span>Unique visitors</span><strong>{total.toLocaleString()}</strong></div>
        <span className="legend"><i /> Daily traffic</span>
      </div>
      {rows.length ? <>
        <svg className="trend-chart__plot" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`Daily visitors from ${start} to ${end}`}>
          <defs><linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-blue)" stopOpacity=".28" /><stop offset="100%" stopColor="var(--chart-blue)" stopOpacity="0" /></linearGradient></defs>
          <path className="chart-grid" d="M0 25H100M0 50H100M0 75H100" />
          <polygon points={`0,100 ${points} 100,100`} fill="url(#trafficFill)" />
          <polyline points={points} className="chart-line" />
        </svg>
        <div className="trend-chart__axis"><span>{formatDay(start)}</span><span>{formatDay(end)}</span></div>
        <table className="sr-only">
          <caption>Daily traffic for the last 30 days</caption>
          <thead><tr><th>Date</th><th>Visitors</th><th>Apply clicks</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.day}><td>{row.day}</td><td>{row.visitors}</td><td>{row.clicks}</td></tr>)}</tbody>
        </table>
      </> : <div className="chart-empty">Traffic will appear after the first visit.</div>}
    </div>
  );
}

function formatDay(value?: string) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString("en", { month: "short", day: "numeric" }) : "—";
}

function Skeleton() {
  return <div className="dashboard-skeleton" aria-label="Loading dashboard"><div className="skeleton-block skeleton-wide skeleton-shimmer" /><div className="skeleton-grid">{Array.from({ length: 4 }, (_, index) => <div className="skeleton-block skeleton-card skeleton-shimmer" key={index} />)}</div><div className="skeleton-columns"><div className="skeleton-block skeleton-panel skeleton-shimmer" /><div className="skeleton-block skeleton-panel skeleton-shimmer" /></div></div>;
}

export function DashboardOverview() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async (signal?: AbortSignal, background = false) => {
    background ? setRefreshing(true) : setLoading(true);
    try {
      const [jobsRes, analyticsRes, contestsRes, sourcesRes] = await Promise.all([
        adminFetch("/api/jobs/stats", { cache: "no-store", signal }),
        adminFetch("/api/analytics?range=30d", { cache: "no-store", signal }),
        adminFetch("/api/contests?isActive=true&page=1", { cache: "no-store", signal }),
        adminFetch("/api/sources", { cache: "no-store", signal }),
      ]);
      if (![jobsRes, analyticsRes, contestsRes, sourcesRes].every((response) => response.ok)) throw new Error("Dashboard request failed");
      const [jobs, analytics, contestsPayload, sourcesPayload] = await Promise.all([jobsRes.json(), analyticsRes.json(), contestsRes.json(), sourcesRes.json()]);
      setData({ jobs, analytics, contests: contestsPayload.total, sources: sourcesPayload.sources });
      setUpdatedAt(new Date());
      setError(null);
    } catch (loadError) {
      if ((loadError as Error).name !== "AbortError") setError("Dashboard data is temporarily unavailable. Try refreshing.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  if (loading && !data) return <Skeleton />;
  if (!data) return <div className="dashboard-error" role="alert"><strong>Couldn’t load the control room.</strong><span>{error}</span><button onClick={() => load()}>Try again</button></div>;

  const enabledSources = data.sources.filter((source) => source.enabled).length;
  const sourceErrors = data.sources.filter((source) => source.lastError);
  const activeRate = data.jobs.total ? Math.round((data.jobs.active / data.jobs.total) * 100) : 0;
  const clickRate = data.analytics.totals.visitors ? (data.analytics.totals.clicks / data.analytics.totals.visitors) * 100 : 0;
  const maxSourceTotal = Math.max(1, ...data.jobs.bySource.map((source) => source.total));
  const hour = new Date().getHours();

  return (
    <div className="dashboard-page">
      <header className="dashboard-heading">
        <div><span className="eyebrow">Operations overview</span><h1>Good {hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"}.</h1><p>Here’s what’s happening across Zobhira’s opportunity pipeline.</p></div>
        <button className="refresh-button" type="button" onClick={() => load(undefined, true)} disabled={refreshing}><RefreshIcon /><span>{refreshing ? "Refreshing…" : "Refresh data"}</span></button>
      </header>

      {error && <div className="inline-alert" role="status">{error} Showing the last available snapshot.</div>}

      <section className="pipeline-strip" aria-label="Opportunity pipeline status">
        <div className="pipeline-intro"><span className="live-dot" aria-hidden="true" /><div><strong>Pipeline status</strong><span>{sourceErrors.length ? `${sourceErrors.length} source${sourceErrors.length === 1 ? "" : "s"} need attention` : "All systems operating normally"}</span></div></div>
        <div className="pipeline-flow">
          <div><span>Sources online</span><strong>{enabledSources}/{data.sources.length}</strong></div><ArrowIcon />
          <div><span>Jobs collected</span><strong>{formatCompact.format(data.jobs.total)}</strong></div><ArrowIcon />
          <div><span>Live inventory</span><strong>{activeRate}%</strong></div><ArrowIcon />
          <div><span>Apply intent</span><strong>{clickRate.toFixed(1)}%</strong></div>
        </div>
        <Link href="/scheduler" className="pipeline-link">Open scheduler <ArrowIcon /></Link>
      </section>

      <section className="metric-grid" aria-label="Key performance indicators">
        <MetricCard label="Active jobs" value={data.jobs.active} detail={`${data.jobs.inactive.toLocaleString()} inactive listings`} />
        <MetricCard label="Active contests" value={data.contests} detail="Available on the marketplace" tone="violet" />
        <MetricCard label="30-day visitors" value={data.analytics.totals.visitors} detail={`${data.analytics.totals.pageViews.toLocaleString()} page views`} tone="green" />
        <MetricCard label="Apply clicks" value={data.analytics.totals.clicks} detail={`${data.analytics.totals.clicksPerVisitor.toFixed(2)} per visitor`} tone="amber" />
      </section>

      <div className="dashboard-grid dashboard-grid--primary">
        <section className="dashboard-panel traffic-panel">
          <div className="panel-heading"><div><span>Audience</span><h2>Traffic over 30 days</h2></div><Link href="/analytics">View analytics <ArrowIcon /></Link></div>
          <TrendChart rows={data.analytics.daily} />
        </section>
        <section className="dashboard-panel">
          <div className="panel-heading"><div><span>Inventory</span><h2>Jobs by source</h2></div><Link href="/jobs">Manage jobs <ArrowIcon /></Link></div>
          <div className="source-bars">
            {data.jobs.bySource.slice(0, 6).map((source) => {
              const activePercent = source.total ? Math.round((source.active / source.total) * 100) : 0;
              return <div className="source-row" key={source.source}><div className="source-row__meta"><strong>{SOURCE_LABELS[source.source] ?? source.source}</strong><span>{source.total.toLocaleString()}</span></div><div className="source-row__track"><i style={{ width: `${Math.max(2, (source.total / maxSourceTotal) * 100)}%` }} /></div><span className="source-row__active">{activePercent}% live</span></div>;
            })}
            {!data.jobs.bySource.length && <p className="empty-copy">No job sources have collected data yet.</p>}
          </div>
        </section>
      </div>

      <div className="dashboard-grid dashboard-grid--secondary">
        <section className="dashboard-panel">
          <div className="panel-heading"><div><span>Engagement</span><h2>Listings people act on</h2></div></div>
          <div className="top-listings">
            {data.analytics.topContent.slice(0, 5).map((item, index) => <div className="listing-row" key={`${item.contentType}:${item.contentId}`}><span className="listing-rank">{String(index + 1).padStart(2, "0")}</span><div><strong>{item.title ?? "Removed listing"}</strong><span>{item.subtitle ?? item.contentType}</span></div><div className="listing-clicks"><strong>{item.clicks}</strong><span>clicks</span></div></div>)}
            {!data.analytics.topContent.length && <p className="empty-copy">Top listings will appear after visitors start applying.</p>}
          </div>
        </section>
        <aside className="dashboard-panel health-panel">
          <div className="panel-heading"><div><span>System health</span><h2>Source readiness</h2></div><Link href="/sources">Review <ArrowIcon /></Link></div>
          <div className="health-score"><div className="health-score__ring" style={{ "--score": `${data.sources.length ? (enabledSources / data.sources.length) * 360 : 0}deg` } as React.CSSProperties}><span>{data.sources.length ? Math.round((enabledSources / data.sources.length) * 100) : 0}%</span></div><div><strong>{sourceErrors.length ? "Action recommended" : "Sources are healthy"}</strong><span>{enabledSources} enabled · {sourceErrors.length} reporting errors</span></div></div>
          <div className="health-list">{data.sources.slice(0, 4).map((source) => <div key={source.name}><span className={`status-dot ${source.lastError ? "status-dot--error" : source.enabled ? "status-dot--ok" : "status-dot--idle"}`} /><strong>{source.name}</strong><span>{source.lastError ? "Error" : source.enabled ? "Ready" : "Paused"}</span></div>)}</div>
        </aside>
      </div>
      <footer className="dashboard-updated">Last updated {updatedAt?.toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" }) ?? "just now"}</footer>
    </div>
  );
}
