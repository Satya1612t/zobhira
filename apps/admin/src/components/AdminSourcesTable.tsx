"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";
import { useToast } from "@/components/Toast";

type ScraperSource = {
  name: string;
  family: string;
  enabled: boolean;
  lastError: string | null;
  lastErrorAt: string | null;
};

export function AdminSourcesTable() {
  const { showToast } = useToast();
  const [sources, setSources] = useState<ScraperSource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch("/api/sources")
      .then((res) => res.json())
      .then((data: { sources: ScraperSource[] }) => setSources(data.sources))
      .finally(() => setLoading(false));
  }, []);

  async function toggleEnabled(source: ScraperSource) {
    const next = !source.enabled;
    setSources((prev) => prev.map((s) => (s.name === source.name ? { ...s, enabled: next } : s)));
    try {
      const res = await adminFetch(`/api/sources/${source.name}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error();
      showToast(`${source.name} ${next ? "enabled" : "disabled"}.`, "success");
    } catch {
      setSources((prev) => prev.map((s) => (s.name === source.name ? { ...s, enabled: !next } : s)));
      showToast(`Couldn't update "${source.name}". Try again.`, "error");
    }
  }

  if (loading) return null;

  return (
    <div
      style={{
        borderRadius: "var(--radius)",
        border: "1px solid var(--line)",
        background: "var(--surface)",
        overflow: "hidden",
      }}
    >
      {sources.map((source) => (
        <div
          key={source.name}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>{source.name}</span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                  padding: "2px 7px",
                  borderRadius: 999,
                  background: "var(--surface-hover)",
                  color: "var(--ink-faint)",
                  border: "1px solid var(--line)",
                }}
              >
                {source.family}
              </span>
            </div>
            {source.lastError && (
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--warn)" }}>
                {source.lastError}
                {source.lastErrorAt && (
                  <span style={{ color: "var(--ink-faint)" }}>
                    {" "}
                    · {new Date(source.lastErrorAt).toLocaleString("en-US")}
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => toggleEnabled(source)}
            style={{
              padding: "6px 14px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--line)",
              background: source.enabled ? "var(--accent)" : "var(--surface-hover)",
              color: source.enabled ? "var(--accent-ink)" : "var(--ink-faint)",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {source.enabled ? "Enabled" : "Disabled"}
          </button>
        </div>
      ))}
    </div>
  );
}
