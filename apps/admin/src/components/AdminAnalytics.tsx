"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";

type Totals = {
  visitors: number; sessions: number; pageViews: number;
  clicks: number; clicksPerVisitor: number;
};
type SourceRow = {
  source: string; visitors: number; pageViews: number;
  clicks: number; clicksPerVisitor: number;
};
type ContentRow = {
  contentType: string; contentId: string;
  title: string | null; subtitle: string | null;
  clicks: number; visitors: number;
};
type DayRow = { day: string; visitors: number; clicks: number };
type Payload = {
  totals: Totals; bySource: SourceRow[]; topContent: ContentRow[]; daily: DayRow[];
};

const RANGES = ["7d", "30d", "90d"] as const;

const num: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

const card: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: "var(--radius)",
  background: "var(--surface)",
  boxShadow: "var(--shadow-card)",
};

function Kpi({ label, value, decimal }: { label: string; value: number; decimal?: boolean }) {
  return (
    <div style={{ ...card, padding: "16px 18px", flex: "1 1 150px" }}>
      <div style={{ fontSize: 11.5, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--ink-faint)" }}>
        {label}
      </div>
      <div style={{ ...num, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 24, color: "var(--ink)", marginTop: 4 }}>
        {decimal ? value.toFixed(2) : value.toLocaleString()}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ ...card, padding: "16px 18px", marginBottom: 14 }}>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, margin: "0 0 12px", color: "var(--ink)" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

const th: React.CSSProperties = {
  textAlign: "left", fontWeight: 500, fontSize: 11.5, letterSpacing: 0.4,
  textTransform: "uppercase", color: "var(--ink-faint)",
  padding: "0 0 8px", borderBottom: "1px solid var(--line)",
};
const td: React.CSSProperties = {
  padding: "9px 0", fontSize: 13, color: "var(--ink)",
  borderBottom: "1px solid var(--line)",
};

export function AdminAnalytics() {
  const [range, setRange] = useState<(typeof RANGES)[number]>("30d");
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminFetch(`/api/analytics?range=${range}`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((payload: Payload) => {
        if (!cancelled) { setData(payload); setError(null); }
      })
      .catch(() => { if (!cancelled) setError("Could not load analytics."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range]);

  const maxVisitors = Math.max(1, ...(data?.bySource.map((s) => s.visitors) ?? []));
  const maxDaily = Math.max(1, ...(data?.daily.map((d) => d.visitors) ?? []));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600, margin: 0, color: "var(--ink)" }}>
          Analytics
        </h1>
        <div style={{ display: "flex", gap: 4 }}>
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              aria-pressed={r === range}
              style={{
                ...num,
                padding: "5px 11px", fontSize: 12.5, cursor: "pointer",
                borderRadius: "var(--radius-sm)",
                border: `1px solid ${r === range ? "var(--accent)" : "var(--line)"}`,
                background: r === range ? "var(--accent)" : "var(--surface)",
                color: r === range ? "var(--accent-ink)" : "var(--ink-muted)",
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {error && <p style={{ color: "var(--warn)", fontSize: 13 }}>{error}</p>}
      {loading && !data && <p style={{ color: "var(--ink-muted)", fontSize: 13 }}>Loading…</p>}

      {data && (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <Kpi label="Visitors" value={data.totals.visitors} />
            <Kpi label="Page views" value={data.totals.pageViews} />
            <Kpi label="Apply clicks" value={data.totals.clicks} />
            <Kpi label="Clicks / visitor" value={data.totals.clicksPerVisitor} decimal />
          </div>

          <Section title="Where people come from">
            {data.bySource.length === 0 ? (
              <p style={{ color: "var(--ink-muted)", fontSize: 13, margin: 0 }}>
                No visits yet in this range. Post a tagged link and check back.
              </p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={th}>Source</th>
                    <th style={{ ...th, textAlign: "right" }}>Visitors</th>
                    <th style={{ ...th, textAlign: "right" }}>Views</th>
                    <th style={{ ...th, textAlign: "right" }}>Clicks</th>
                    <th style={{ ...th, textAlign: "right" }}>CPV</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bySource.map((s) => (
                    <tr key={s.source}>
                      <td style={td}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ width: 92, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {s.source}
                          </span>
                          <span
                            aria-hidden
                            style={{
                              height: 6, borderRadius: 3, background: "var(--accent)",
                              width: `${(s.visitors / maxVisitors) * 100}%`, minWidth: 2,
                            }}
                          />
                        </div>
                      </td>
                      <td style={{ ...td, ...num, textAlign: "right" }}>{s.visitors.toLocaleString()}</td>
                      <td style={{ ...td, ...num, textAlign: "right", color: "var(--ink-muted)" }}>{s.pageViews.toLocaleString()}</td>
                      <td style={{ ...td, ...num, textAlign: "right" }}>{s.clicks.toLocaleString()}</td>
                      <td style={{ ...td, ...num, textAlign: "right", fontWeight: 600 }}>{s.clicksPerVisitor.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section title="Most clicked listings">
            {data.topContent.length === 0 ? (
              <p style={{ color: "var(--ink-muted)", fontSize: 13, margin: 0 }}>No apply clicks in this range.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={th}>Listing</th>
                    <th style={{ ...th, textAlign: "right" }}>Clicks</th>
                    <th style={{ ...th, textAlign: "right" }}>Visitors</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topContent.map((c) => (
                    <tr key={`${c.contentType}:${c.contentId}`}>
                      <td style={td}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.title ?? <span style={{ color: "var(--ink-faint)" }}>Removed listing</span>}
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--ink-muted)", marginTop: 2 }}>
                          {c.contentType}{c.subtitle ? ` · ${c.subtitle}` : ""}
                        </div>
                      </td>
                      <td style={{ ...td, ...num, textAlign: "right" }}>{c.clicks}</td>
                      <td style={{ ...td, ...num, textAlign: "right", color: "var(--ink-muted)" }}>{c.visitors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section title="Daily visitors">
            <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 96 }} role="img" aria-label="Daily visitors">
              {data.daily.map((d) => (
                <div
                  key={d.day}
                  title={`${d.day} — ${d.visitors} visitors, ${d.clicks} clicks`}
                  style={{
                    flex: 1, minWidth: 2, borderRadius: "2px 2px 0 0",
                    background: "var(--accent-soft)",
                    height: `${Math.max((d.visitors / maxDaily) * 100, 2)}%`,
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11.5, color: "var(--ink-faint)" }}>
              <span>{data.daily[0]?.day}</span>
              <span>{data.daily[data.daily.length - 1]?.day}</span>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
