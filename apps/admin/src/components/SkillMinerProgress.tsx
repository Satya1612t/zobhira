"use client";

import { useEffect, useRef, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";
import { useToast } from "@/components/Toast";

type Current = { started_at: string; scan_limit: number };

type LastRun = {
  started_at: string;
  finished_at: string;
  scan_limit: number;
  skills_promoted: number;
  candidates_pending: number;
  new_candidates_found: number;
  error: string | null;
};

type Progress = { current: Current | null; last_run: LastRun | null };

const POLL_INTERVAL_MS = 3000;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

// Single job, not a per-source sweep — unlike SchedulerProgress/
// ContestSchedulerProgress, there is only ever one card here. Scans job
// descriptions + zero-result skill searches (skill_query_misses) and
// auto-promotes whatever clears the thresholds in
// services/scraper/scripts/mine_skills.py; everything else lands in the
// skill_candidates review queue for a human (`--promote`/`--reject` on the
// CLI — no admin UI for reviewing individual candidates yet).
export function SkillMinerProgress() {
  const { showToast } = useToast();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;

    async function poll() {
      try {
        const res = await adminFetch("/api/skills/miner/progress", { cache: "no-store" });
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

  async function handleTrigger() {
    setTriggering(true);
    try {
      const res = await adminFetch("/api/skills/miner/trigger", { method: "POST" });
      const data = await res.json();
      if (!data.started) {
        showToast(data.reason ?? "Could not start the mining run.", "error");
      } else {
        showToast("Skill vocabulary mining started.", "success");
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
                Skill vocabulary miner
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
              Weekly, Sunday 04:00 local &middot; scans job descriptions + skill searches that
              returned nothing
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
            Started {formatDateTime(progress.current.started_at)} &middot; scanning up to{" "}
            {progress.current.scan_limit.toLocaleString()} descriptions
          </div>
        ) : (
          <div style={{ marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-faint)" }}>
            {lastRun ? (
              <span>
                Last run: {formatDateTime(lastRun.finished_at)} &middot; {lastRun.skills_promoted} new skill
                {lastRun.skills_promoted === 1 ? "" : "s"} promoted &middot; {lastRun.candidates_pending} pending
                review
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
