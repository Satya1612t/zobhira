"use client";

import { useEffect, useRef, useState } from "react";

type CurrentSweep = {
  source: string;
  tier: string;
  started_at: string;
  total_steps: number;
  completed_steps: number;
  saved_count: number;
  current_query: string | null;
};

type LastRun = {
  started_at: string;
  finished_at: string;
  total_steps: number;
  saved_count: number;
  errors: number;
};

type Progress = {
  current: CurrentSweep | null;
  last_runs: Record<string, LastRun | null>;
};

const POLL_INTERVAL_MS = 3000;

const SOURCES = [{ key: "dev_community", label: "DEV Community", cadence: "Daily" }];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function ContestSchedulerProgress() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;

    async function poll() {
      try {
        const res = await fetch("/api/contests/scheduler/progress", { cache: "no-store" });
        const data: Progress = await res.json();
        if (!cancelled.current) {
          setProgress(data);
          setError(null);
        }
      } catch {
        if (!cancelled.current) {
          setError("Could not reach the scraper service. Is it running (see README)?");
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

  async function handleTrigger(source: string) {
    setTriggering(source);
    setTriggerError(null);
    try {
      const res = await fetch(`/api/contests/scheduler/trigger/${source}`, { method: "POST" });
      const data = await res.json();
      if (!data.started) {
        setTriggerError(data.reason ?? "Could not start this sweep.");
      }
    } catch {
      setTriggerError("Could not reach the scraper service.");
    } finally {
      setTriggering(null);
    }
  }

  const anySweepRunning = progress?.current != null;
  const runningEntry = progress?.current
    ? SOURCES.find((s) => s.key === progress.current?.source)
    : undefined;

  return (
    <div>
      {error && <p style={{ color: "var(--warn)", fontSize: 13, margin: "0 0 12px" }}>{error}</p>}
      {triggerError && (
        <p style={{ color: "var(--warn)", fontSize: 13, margin: "0 0 12px" }}>{triggerError}</p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {SOURCES.map((src) => {
          const isRunning = progress?.current?.source === src.key;
          const isWaiting = anySweepRunning && !isRunning;
          const current = isRunning ? progress?.current ?? null : null;
          const lastRun = progress?.last_runs?.[src.key] ?? null;
          const percent = current ? Math.round((current.completed_steps / current.total_steps) * 100) : 0;
          const disabled = triggering !== null || isWaiting;
          const runningSourceLabel = runningEntry?.label;

          return (
            <div
              key={src.key}
              style={{
                padding: "14px 16px",
                borderRadius: "var(--radius)",
                background: "var(--surface)",
                border: "1px solid var(--line)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 600,
                        fontSize: 16.5,
                        color: "var(--ink)",
                        overflowWrap: "break-word",
                      }}
                    >
                      {src.label}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10.5,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: 0.4,
                        padding: "2px 7px",
                        borderRadius: 999,
                        color: isRunning ? "var(--accent-ink)" : isWaiting ? "var(--ink-muted)" : "var(--ink-faint)",
                        background: isRunning ? "var(--accent)" : "var(--surface-hover)",
                        border: isRunning ? "none" : "1px solid var(--line)",
                      }}
                    >
                      {isRunning ? "Running" : isWaiting ? "Waiting" : "Idle"}
                    </span>
                  </div>
                  <div style={{ color: "var(--ink-muted)", fontSize: 13, marginTop: 3 }}>{src.cadence}</div>
                </div>
                <button
                  onClick={() => handleTrigger(src.key)}
                  disabled={disabled}
                  title={isWaiting ? `${runningSourceLabel} is running — this source will wait for it to finish` : undefined}
                  style={{
                    padding: "7px 14px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--line)",
                    background: disabled ? "var(--surface-hover)" : "var(--accent)",
                    color: disabled ? "var(--ink-faint)" : "var(--accent-ink)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12.5,
                    cursor: disabled ? "not-allowed" : "pointer",
                    flexShrink: 0,
                  }}
                >
                  {isRunning ? "Running…" : isWaiting ? "Waiting…" : "Run now"}
                </button>
              </div>
              {isWaiting && (
                <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-muted)" }}>
                  {runningSourceLabel} is running right now — only one contest source scrapes at a
                  time, this one will start once it&apos;s free.
                </div>
              )}

              {isRunning && current ? (
                <div style={{ marginTop: 12 }}>
                  <div
                    style={{
                      height: 8,
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
                  <div
                    style={{
                      marginTop: 6,
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "var(--ink-faint)",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <span>
                      Step {current.completed_steps}/{current.total_steps} ({percent}%)
                    </span>
                    <span>· saved so far: {current.saved_count}</span>
                  </div>
                </div>
              ) : (
                !isWaiting && (
                  <div style={{ marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-faint)" }}>
                    {lastRun ? (
                      <span>
                        Last run: {formatDateTime(lastRun.finished_at)} · {lastRun.saved_count} contest
                        {lastRun.saved_count === 1 ? "" : "s"} stored
                        {lastRun.errors > 0 && (
                          <span style={{ color: "var(--warn)" }}>
                            {" "}
                            · {lastRun.errors} error{lastRun.errors === 1 ? "" : "s"}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span>Never run yet</span>
                    )}
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
