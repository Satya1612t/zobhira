"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";

type Quota = {
  configured?: boolean;
  error?: string;
  summary?: unknown;
  byPlatform?: unknown;
  keys?: unknown;
};

const card: React.CSSProperties = {
  borderRadius: "var(--radius)",
  border: "1px solid var(--line)",
  background: "var(--surface)",
  padding: 16,
};

function isRecordArray(v: unknown): v is Record<string, unknown>[] {
  return Array.isArray(v) && v.length > 0 && typeof v[0] === "object" && v[0] !== null;
}

function scalar(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "object") return Array.isArray(v) ? `${v.length} items` : "…";
  return String(v);
}

// Generic table for any array-of-objects (freellmapi's exact shapes aren't
// documented here, so render whatever columns come back rather than hardcode).
function AutoTable({ rows }: { rows: Record<string, unknown>[] }) {
  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r)))).filter(
    (c) => rows.some((r) => typeof r[c] !== "object" || r[c] === null)
  );
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} style={{ textAlign: "left", padding: "6px 10px", color: "var(--ink-faint)", fontWeight: 600, borderBottom: "1px solid var(--line)", textTransform: "capitalize" }}>
                {c.replace(/([A-Z])/g, " $1")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={c} style={{ padding: "6px 10px", borderBottom: "1px solid var(--line)", color: "var(--ink)" }}>
                  {scalar(r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ title, data }: { title: string; data: unknown }) {
  if (data === undefined || data === null) return null;
  return (
    <div style={{ marginBottom: 22 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-faint)" }}>
        {title}
      </h3>
      <div style={card}>
        {isRecordArray(data) ? (
          <AutoTable rows={data} />
        ) : typeof data === "object" ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
            {Object.entries(data as Record<string, unknown>)
              .filter(([, v]) => typeof v !== "object" || v === null)
              .map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 11, color: "var(--ink-faint)", textTransform: "capitalize" }}>{k.replace(/([A-Z])/g, " $1")}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>{scalar(v)}</div>
                </div>
              ))}
          </div>
        ) : (
          <span style={{ fontSize: 14, color: "var(--ink)" }}>{scalar(data)}</span>
        )}
      </div>
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
          Set all three in the scraper&apos;s <code>.env</code> — the router&apos;s dashboard login
          (not the inference API key) plus its base URL — then restart the scraper:
        </p>
        <pre style={{ margin: "8px 0 0", padding: 12, background: "var(--surface-hover)", borderRadius: "var(--radius-sm)", fontSize: 12.5, overflowX: "auto" }}>
{`FREELLMAPI_BASE_URL=http://localhost:3001/v1
FREELLMAPI_ADMIN_EMAIL=you@example.com
FREELLMAPI_ADMIN_PASSWORD=<your freellmapi dashboard password>`}
        </pre>
        <p style={{ margin: "10px 0 0", fontSize: 12.5 }}>
          Already set them and still seeing this? Confirm the admin app&apos;s{" "}
          <code>SCRAPER_API_URL</code> points at the same scraper where you edited the{" "}
          <code>.env</code> — a locally-run admin talking to a local scraper won&apos;t see vars you
          set on the server.
        </p>
      </div>
    );
  }

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
        <div style={{ ...card, borderColor: "var(--warn)", color: "var(--warn)", fontSize: 13, marginBottom: 18 }}>{data.error}</div>
      )}
      <Section title="Summary (last 30 days)" data={data?.summary} />
      <Section title="Providers / platforms" data={data?.byPlatform} />
      <Section title="Keys" data={data?.keys} />
    </div>
  );
}
