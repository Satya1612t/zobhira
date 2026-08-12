"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";

type Provider = {
  providerSlug: string;
  clicks: number;
  monetised: number;
  shareMonetised: number;
  topSource: string;
};
type Payload = { range: string; totalClicks: number; providers: Provider[] };

const RANGES = ["7d", "30d", "90d"] as const;

const th: React.CSSProperties = {
  textAlign: "left", fontWeight: 500, fontSize: 11.5, letterSpacing: 0.4, textTransform: "uppercase",
  color: "var(--ink-faint)", padding: "0 12px 8px", borderBottom: "1px solid var(--line)",
};
const td: React.CSSProperties = { padding: "9px 12px", fontSize: 13, color: "var(--ink)", borderBottom: "1px solid var(--line)" };

export function PartnerStats() {
  const [range, setRange] = useState<(typeof RANGES)[number]>("30d");
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminFetch(`/api/certifications/partner-stats?range=${range}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Payload) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-muted)" }}>
          {data ? `${data.totalClicks.toLocaleString()} partner clicks in the last ${range}` : " "}
        </p>
        <div style={{ display: "flex", gap: 4 }}>
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                padding: "5px 11px", fontSize: 12.5, cursor: "pointer", borderRadius: "var(--radius-sm)",
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

      {loading ? (
        <p style={{ color: "var(--ink-muted)", fontSize: 13 }}>Loading…</p>
      ) : !data || data.providers.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: 13 }}>No partner clicks in this range yet.</p>
      ) : (
        <div style={{ borderRadius: "var(--radius)", border: "1px solid var(--line)", background: "var(--surface)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Provider</th>
                <th style={{ ...th, textAlign: "right" }}>Clicks</th>
                <th style={{ ...th, textAlign: "right" }}>Monetised</th>
                <th style={{ ...th, textAlign: "right" }}>Share</th>
                <th style={th}>Top source</th>
              </tr>
            </thead>
            <tbody>
              {data.providers.map((p) => (
                <tr key={p.providerSlug}>
                  <td style={{ ...td, fontWeight: 600 }}>{p.providerSlug}</td>
                  <td style={{ ...td, textAlign: "right" }}>{p.clicks.toLocaleString()}</td>
                  <td style={{ ...td, textAlign: "right", color: "var(--ink-muted)" }}>{p.monetised.toLocaleString()}</td>
                  <td style={{ ...td, textAlign: "right" }}>{p.shareMonetised}%</td>
                  <td style={{ ...td, textTransform: "capitalize" }}>{p.topSource}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
