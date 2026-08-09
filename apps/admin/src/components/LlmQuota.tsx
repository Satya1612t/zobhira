"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";

type Summary = {
  totalRequests?: number;
  successRate?: number;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  estimatedCostSavings?: number;
  avgLatencyMs?: number;
};
type Platform = {
  platform?: string;
  requests?: number;
  successRate?: number;
  errorCount?: number;
};
type Key = { platform?: string; status?: string; enabled?: boolean };
type Daily = {
  requestsUsed?: number | null;
  requestsLimit?: number | null;
  tokensUsed?: number | null;
  tokensLimit?: number | null;
};
type Quota = {
  configured?: boolean;
  error?: string;
  summary?: Summary;
  daily?: Daily;
  byPlatform?: Platform[];
  keys?: Key[];
};

const card: React.CSSProperties = {
  borderRadius: "var(--radius)",
  border: "1px solid var(--line)",
  background: "var(--surface)",
  padding: 16,
};

function compact(n: number | undefined): string {
  if (n === undefined || n === null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// Green = reliable, amber = flaky, red = mostly failing. One glance tells you
// which providers are actually pulling their weight.
function health(rate: number | undefined): { color: string; label: string } {
  if (rate === undefined || rate === null) return { color: "#9ca3af", label: "no data" };
  if (rate >= 90) return { color: "#16a34a", label: "healthy" };
  if (rate >= 75) return { color: "#d97706", label: "flaky" };
  return { color: "#dc2626", label: "failing" };
}

// One bar: how much of today's combined daily allowance is spent. Free tiers
// reset daily, so this empties and refills each day.
function DailyBar({ daily }: { daily: Daily }) {
  const used = daily.requestsUsed ?? 0;
  const limit = daily.requestsLimit ?? 0;
  const hasLimit = limit > 0;
  const pct = hasLimit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const left = Math.max(0, limit - used);
  const color = pct >= 90 ? "#dc2626" : pct >= 75 ? "#d97706" : "#16a34a";

  return (
    <div style={{ ...card, marginBottom: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>Today&apos;s usage</span>
        <span style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>
          {used.toLocaleString()}{hasLimit ? ` / ${limit.toLocaleString()}` : ""} requests
        </span>
      </div>
      {hasLimit ? (
        <>
          <div style={{ height: 14, borderRadius: 99, background: "var(--surface-hover)", overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99, transition: "width .3s ease" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12.5 }}>
            <span style={{ color: "var(--ink-muted)" }}>Used <strong style={{ color: "var(--ink)" }}>{used.toLocaleString()}</strong></span>
            <span style={{ color: "var(--ink-muted)" }}>Left <strong style={{ color: color }}>{left.toLocaleString()}</strong></span>
          </div>
        </>
      ) : (
        <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--ink-muted)" }}>
          {used.toLocaleString()} requests used today. The router doesn&apos;t report a daily limit
          for the active providers, so there&apos;s no &quot;left&quot; figure to show.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ ...card, flex: "1 1 140px", minWidth: 140 }}>
      <div style={{ fontSize: 11.5, color: "var(--ink-faint)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)" }}>{value}</div>
    </div>
  );
}

export function LlmQuota() {
  const [data, setData] = useState<Quota | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await adminFetch("/api/llm/quota", { cache: "no-store" });
      setData(await res.json());
    } catch {
      setData({ configured: true, error: "Couldn't load LLM router status." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !data) return <p style={{ color: "var(--ink-muted)", fontSize: 13 }}>Loading…</p>;

  if (data?.configured === false) {
    return (
      <div style={{ ...card, color: "var(--ink-muted)", fontSize: 13.5, lineHeight: 1.6 }}>
        <strong style={{ color: "var(--ink)" }}>FreeLLMAPI admin not configured.</strong>
        <p style={{ margin: "8px 0 0" }}>
          Set all three in the scraper&apos;s <code>.env</code> (the router&apos;s dashboard login,
          not the inference API key), then restart the scraper:
        </p>
        <pre style={{ margin: "8px 0 0", padding: 12, background: "var(--surface-hover)", borderRadius: "var(--radius-sm)", fontSize: 12.5, overflowX: "auto" }}>
{`FREELLMAPI_BASE_URL=http://localhost:3001/v1
FREELLMAPI_ADMIN_EMAIL=you@example.com
FREELLMAPI_ADMIN_PASSWORD=<your freellmapi dashboard password>`}
        </pre>
      </div>
    );
  }

  const s = data?.summary ?? {};
  const tokens = (s.totalInputTokens ?? 0) + (s.totalOutputTokens ?? 0);
  const providers = (data?.byPlatform ?? []).filter((p) => (p.requests ?? 0) > 0);
  const keys = data?.keys ?? [];
  const healthyKeys = keys.filter((k) => k.status === "healthy" && k.enabled !== false).length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button
          onClick={load}
          disabled={loading}
          style={{ padding: "6px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: 12.5, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {data?.error && (
        <div style={{ ...card, borderColor: "#dc2626", color: "#dc2626", fontSize: 13, marginBottom: 18 }}>{data.error}</div>
      )}

      {/* The one bar: today's usage vs the daily allowance. */}
      {data?.daily && <DailyBar daily={data.daily} />}

      {/* Headline numbers — everything you usually want at a glance. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 22 }}>
        <Stat label="Requests (30d)" value={s.totalRequests?.toLocaleString() ?? "—"} />
        <Stat label="Success rate" value={s.successRate != null ? `${s.successRate}%` : "—"} />
        <Stat label="Tokens used" value={compact(tokens)} />
        <Stat label="Cost saved" value={s.estimatedCostSavings != null ? `$${s.estimatedCostSavings.toFixed(2)}` : "—"} />
      </div>

      {/* Providers actually handling traffic, busiest first. */}
      {providers.length > 0 && (
        <>
          <h3 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-faint)" }}>
            Providers in use
          </h3>
          <div style={{ ...card, padding: 0 }}>
            {providers
              .slice()
              .sort((a, b) => (b.requests ?? 0) - (a.requests ?? 0))
              .map((p, i) => {
                const h = health(p.successRate);
                return (
                  <div
                    key={p.platform ?? i}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderTop: i === 0 ? "none" : "1px solid var(--line)" }}
                  >
                    <span title={h.label} style={{ width: 9, height: 9, borderRadius: "50%", background: h.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "var(--ink)", textTransform: "capitalize" }}>{p.platform}</span>
                    <span style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>{(p.requests ?? 0).toLocaleString()} reqs</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: h.color, minWidth: 48, textAlign: "right" }}>
                      {p.successRate != null ? `${p.successRate}%` : "—"}
                    </span>
                  </div>
                );
              })}
          </div>
        </>
      )}

      {keys.length > 0 && (
        <p style={{ margin: "14px 2px 0", fontSize: 12.5, color: "var(--ink-muted)" }}>
          {healthyKeys} of {keys.length} providers healthy.
        </p>
      )}
    </div>
  );
}
