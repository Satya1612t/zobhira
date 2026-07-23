"use client";

import { useEffect, useRef, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";

const SOURCE_LABELS: Record<string, string> = {
  ycombinator: "Y Combinator",
  remoteok: "RemoteOK",
  talentd: "Talentd",
  linkedin: "LinkedIn",
};

type SourceCount = { source: string; total: number; active: number };

type Stats = {
  total: number;
  active: number;
  inactive: number;
  bySource: SourceCount[];
};

const POLL_INTERVAL_MS = 5000;

function StatNumber({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 24, color: "var(--ink)" }}>
        {value.toLocaleString()}
      </div>
      <div style={{ color: "var(--ink-muted)", fontSize: 12.5, marginTop: 2 }}>{label}</div>
    </div>
  );
}

export function DbStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;

    async function poll() {
      try {
        const res = await adminFetch("/api/jobs/stats", { cache: "no-store" });
        const data: Stats = await res.json();
        if (!cancelled.current) {
          setStats(data);
          setError(null);
        }
      } catch {
        if (!cancelled.current) {
          setError("Could not load DB stats.");
        }
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled.current = true;
      clearInterval(interval);
    };
  }, []);

  if (error) {
    return <p style={{ color: "var(--warn)", fontSize: 13, margin: "0 0 12px" }}>{error}</p>;
  }
  if (!stats) return null;

  const maxCount = Math.max(1, ...stats.bySource.map((s) => s.total));

  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: "var(--radius)",
        background: "var(--surface)",
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow-card)",
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
        <StatNumber label="Total jobs" value={stats.total} />
        <StatNumber label="Active" value={stats.active} />
        <StatNumber label="Inactive" value={stats.inactive} />
      </div>

      <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
        {stats.bySource.map((row) => {
          const percent = Math.round((row.total / maxCount) * 100);
          return (
            <div key={row.source}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12.5,
                  color: "var(--ink-muted)",
                  marginBottom: 4,
                }}
              >
                <span>{SOURCE_LABELS[row.source] ?? row.source}</span>
                <span>
                  {row.total.toLocaleString()}
                  {row.active !== row.total && (
                    <span style={{ color: "var(--ink-faint)" }}> ({row.active.toLocaleString()} active)</span>
                  )}
                </span>
              </div>
              <div
                style={{
                  height: 10,
                  borderRadius: 999,
                  background: "var(--surface-hover)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${percent}%`,
                    background: "var(--accent)",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>
          );
        })}
        {stats.bySource.length === 0 && (
          <p style={{ color: "var(--ink-faint)", fontSize: 12.5, margin: 0 }}>No jobs in the DB yet.</p>
        )}
      </div>
    </div>
  );
}
