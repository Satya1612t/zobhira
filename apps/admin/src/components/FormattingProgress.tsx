"use client";

import { useEffect, useRef, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";
import { useToast } from "@/components/Toast";

type Current = { started_at: string; limit: number };

type LastRun = {
  started_at: string;
  finished_at: string;
  limit: number;
  processed: number;
  formatted: number;
  tripped: boolean;
  error: string | null;
};

type Progress = { current: Current | null; last_run: LastRun | null };

const PROGRESS_POLL_MS = 3000; // in-memory on the scraper, cheap
const BACKLOG_POLL_MS = 20000; // a DB count, kept infrequent

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

// The second-phase LLM description formatting pass (services/scraper's
// format_scheduler.py / scripts/format_jobs.py). Ingest leaves every job on a
// deterministic plain-text description; this pass upgrades those to the
// LLM-structured sections. Single job (no per-source sweep), so one card.
export function FormattingProgress() {
  const { showToast } = useToast();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [backlog, setBacklog] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const cancelled = useRef(false);

  async function fetchBacklog() {
    try {
      const res = await adminFetch("/api/jobs/formatting/backlog", { cache: "no-store" });
      const data: { pending?: number } = await res.json();
      if (!cancelled.current && typeof data.pending === "number") setBacklog(data.pending);
    } catch {
      /* non-fatal — the card still works without the backlog number */
    }
  }

  useEffect(() => {
    cancelled.current = false;

    async function pollProgress() {
      try {
        const res = await adminFetch("/api/jobs/formatting/progress", { cache: "no-store" });
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

    pollProgress();
    fetchBacklog();
    const p = setInterval(pollProgress, PROGRESS_POLL_MS);
    const b = setInterval(fetchBacklog, BACKLOG_POLL_MS);
    return () => {
      cancelled.current = true;
      clearInterval(p);
      clearInterval(b);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleTrigger() {
    setTriggering(true);
    try {
      const res = await adminFetch("/api/jobs/formatting/trigger", { method: "POST" });
      const data = await res.json();
      if (!data.started) {
        showToast(data.reason ?? "Could not start the formatting run.", "error");
      } else {
        showToast("Description formatting started.", "success");
      }
    } catch {
      showToast("Could not reach the scraper service.", "error");
    } finally {
      setTriggering(false);
    }
  }

  const isRunning = progress?.current != null;
  const lastRun = progress?.last_run ?? null;

  return (
    <div>
      {error && <p style={{ color: "var(--warn)", fontSize: 13, margin: "0 0 12px" }}>{error}</p>}
      <div
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
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16.5, color: "var(--ink)" }}>
                Description formatting
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
                  color: isRunning ? "var(--accent-ink)" : "var(--ink-faint)",
                  background: isRunning ? "var(--accent)" : "var(--surface-hover)",
                  border: isRunning ? "none" : "1px solid var(--line)",
                }}
              >
                {isRunning ? "Running" : "Idle"}
              </span>
            </div>
            <div style={{ color: "var(--ink-muted)", fontSize: 13, marginTop: 3 }}>
              Rolling LLM pass &middot; upgrades plain-text descriptions to structured sections
              {backlog != null && (
                <>
                  {" "}&middot;{" "}
                  <strong style={{ color: backlog > 0 ? "var(--ink)" : "var(--ink-muted)" }}>
                    {backlog.toLocaleString()}
                  </strong>{" "}
                  awaiting formatting
                </>
              )}
            </div>
          </div>
          <button
            onClick={handleTrigger}
            disabled={triggering || isRunning}
            style={{
              padding: "7px 14px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--line)",
              background: triggering || isRunning ? "var(--surface-hover)" : "var(--accent)",
              color: triggering || isRunning ? "var(--ink-faint)" : "var(--accent-ink)",
              fontFamily: "var(--font-mono)",
              fontSize: 12.5,
              cursor: triggering || isRunning ? "not-allowed" : "pointer",
              flexShrink: 0,
            }}
          >
            {isRunning ? "Running…" : "Run now"}
          </button>
        </div>

        {isRunning && progress?.current ? (
          <div style={{ marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-faint)" }}>
            Started {formatDateTime(progress.current.started_at)} &middot; up to{" "}
            {progress.current.limit.toLocaleString()} jobs this pass
          </div>
        ) : (
          <div style={{ marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-faint)" }}>
            {lastRun ? (
              <span>
                Last run: {formatDateTime(lastRun.finished_at)} &middot; {lastRun.formatted} formatted
                {" "}/ {lastRun.processed} checked
                {lastRun.tripped && <span style={{ color: "var(--warn)" }}> &middot; stopped early (LLM failing)</span>}
                {lastRun.error && <span style={{ color: "var(--warn)" }}> &middot; failed: {lastRun.error}</span>}
              </span>
            ) : (
              <span>Never run yet</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
