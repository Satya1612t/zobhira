"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";

type AuditEntry = {
  id: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

const TARGET_TYPES = ["", "job", "contest", "source", "scheduler"];

// Mirrors the AuditAction union in src/lib/auditLog.ts — kept as a flat list
// here (rather than importing the server-only type) since this is a plain
// <select> of known values, grouped visually by what they do to the data.
const ACTIONS = [
  "",
  "job.delete",
  "job.set_active",
  "job.clear_all",
  "contest.delete",
  "contest.set_active",
  "contest.clear_all",
  "source.set_enabled",
  "scheduler.trigger",
  "contest_scheduler.trigger",
];

// Color-codes by the verb, not the entity, so "delete" always reads as
// dangerous and "trigger" always reads as neutral regardless of whether
// it's a job, contest, or scheduler action.
function actionTone(action: string): { bg: string; fg: string; border: string } {
  if (action.includes("delete") || action.includes("clear_all")) {
    return { bg: "var(--warn-soft)", fg: "var(--warn)", border: "var(--warn)" };
  }
  if (action.includes("set_active") || action.includes("set_enabled")) {
    return { bg: "var(--accent-soft)", fg: "var(--accent)", border: "var(--accent)" };
  }
  return { bg: "var(--surface-hover)", fg: "var(--ink-muted)", border: "var(--line)" };
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function AdminAuditLogTable() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [targetType, setTargetType] = useState("");
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handle = setTimeout(() => {
      setPage(1);
      setQ(qInput);
    }, 350);
    return () => clearTimeout(handle);
  }, [qInput]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (targetType) params.set("targetType", targetType);
    if (action) params.set("action", action);
    if (q) params.set("q", q);
    adminFetch(`/api/audit-log?${params}`)
      .then((res) => res.json())
      .then((data: { entries: AuditEntry[]; total: number }) => {
        setEntries(data.entries);
        setTotal(data.total);
      })
      .finally(() => setLoading(false));
  }, [page, targetType, action, q]);

  const activeFilters = [
    q ? { key: "q", label: `"${q}"`, clear: () => { setQInput(""); setQ(""); } } : null,
    targetType ? { key: "targetType", label: targetType, clear: () => setTargetType("") } : null,
    action ? { key: "action", label: action, clear: () => setAction("") } : null,
  ].filter((f): f is { key: string; label: string; clear: () => void } => f !== null);

  function clearAllFilters() {
    setQInput("");
    setQ("");
    setTargetType("");
    setAction("");
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(total / 50));

  return (
    <div>
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: "var(--radius)",
          background: "var(--surface)",
          padding: 12,
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              placeholder="Search admin, target id, or action…"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 30px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--line)",
                fontSize: 13.5,
              }}
            />
          </div>
          <select
            value={targetType}
            onChange={(e) => {
              setPage(1);
              setTargetType(e.target.value);
            }}
            style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--line)", fontSize: 13.5, color: "var(--ink)" }}
          >
            {TARGET_TYPES.map((t) => (
              <option key={t} value={t}>
                {t ? t[0].toUpperCase() + t.slice(1) : "All categories"}
              </option>
            ))}
          </select>
          <select
            value={action}
            onChange={(e) => {
              setPage(1);
              setAction(e.target.value);
            }}
            style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--line)", fontSize: 13.5, color: "var(--ink)" }}
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a || "All actions"}
              </option>
            ))}
          </select>
          <span
            style={{
              marginLeft: "auto",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--accent)",
              background: "var(--accent-soft)",
              padding: "5px 10px",
              borderRadius: "var(--radius-full, 999px)",
              whiteSpace: "nowrap",
            }}
          >
            {loading ? "…" : total.toLocaleString()} total
          </span>
        </div>

        {activeFilters.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
            {activeFilters.map((f) => (
              <button
                key={f.key}
                onClick={f.clear}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 8px",
                  borderRadius: "var(--radius-full, 999px)",
                  border: "1px solid var(--line)",
                  background: "var(--surface-hover)",
                  color: "var(--ink)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {f.label}
                <span aria-hidden="true" style={{ color: "var(--ink-faint)" }}>&times;</span>
              </button>
            ))}
            <button
              onClick={clearAllFilters}
              style={{ background: "none", border: 0, color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "4px 4px" }}
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      <div
        style={{
          borderRadius: "var(--radius)",
          border: "1px solid var(--line)",
          background: "var(--surface)",
          overflow: "hidden",
        }}
      >
        {entries.map((entry) => {
          const tone = actionTone(entry.action);
          const created = new Date(entry.createdAt);
          const metadataEntries = entry.metadata ? Object.entries(entry.metadata) : [];
          return (
            <div
              key={entry.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "12px 14px",
                borderBottom: "1px solid var(--line)",
                fontSize: 13,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: "var(--radius-sm)",
                  background: tone.bg,
                  color: tone.fg,
                  border: `1px solid ${tone.border}`,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {entry.action}
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, color: "var(--ink)" }}>{entry.adminEmail}</span>
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
                    {entry.targetType}
                  </span>
                  <span style={{ color: "var(--ink-faint)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
                    {entry.targetId}
                  </span>
                </div>
                {metadataEntries.length > 0 && (
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
                    {metadataEntries.map(([key, value]) => (
                      <span
                        key={key}
                        style={{
                          fontSize: 11.5,
                          padding: "2px 7px",
                          borderRadius: "var(--radius-sm)",
                          background: "var(--surface-hover)",
                          color: "var(--ink-muted)",
                        }}
                      >
                        <strong style={{ color: "var(--ink-faint)", fontWeight: 600 }}>{key}:</strong> {String(value)}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div
                title={created.toLocaleString("en-US")}
                style={{ color: "var(--ink-faint)", fontSize: 12, flexShrink: 0, whiteSpace: "nowrap", marginTop: 2 }}
              >
                {timeAgo(created)}
              </div>
            </div>
          );
        })}
        {!loading && entries.length === 0 && (
          <div style={{ padding: 20, color: "var(--ink-faint)", fontSize: 13 }}>No audit entries match these filters.</div>
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{ padding: "6px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--line)", background: "var(--surface)", fontSize: 12.5, cursor: page <= 1 ? "not-allowed" : "pointer" }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>
            Page {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{ padding: "6px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--line)", background: "var(--surface)", fontSize: 12.5, cursor: page >= totalPages ? "not-allowed" : "pointer" }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
