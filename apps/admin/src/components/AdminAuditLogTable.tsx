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

function formatMetadata(metadata: Record<string, unknown> | null): string {
  if (!metadata) return "";
  return Object.entries(metadata)
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");
}

export function AdminAuditLogTable() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [targetType, setTargetType] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (targetType) params.set("targetType", targetType);
    adminFetch(`/api/audit-log?${params}`)
      .then((res) => res.json())
      .then((data: { entries: AuditEntry[]; total: number }) => {
        setEntries(data.entries);
        setTotal(data.total);
      })
      .finally(() => setLoading(false));
  }, [page, targetType]);

  const totalPages = Math.max(1, Math.ceil(total / 50));

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <select
          value={targetType}
          onChange={(e) => {
            setPage(1);
            setTargetType(e.target.value);
          }}
          style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--line)", fontSize: 13.5 }}
        >
          {TARGET_TYPES.map((t) => (
            <option key={t} value={t}>
              {t ? t[0].toUpperCase() + t.slice(1) : "All types"}
            </option>
          ))}
        </select>
        <span style={{ alignSelf: "center", color: "var(--ink-faint)", fontSize: 12.5 }}>
          {total.toLocaleString()} total
        </span>
      </div>

      <div
        style={{
          borderRadius: "var(--radius)",
          border: "1px solid var(--line)",
          background: "var(--surface)",
          overflow: "hidden",
        }}
      >
        {entries.map((entry) => (
          <div
            key={entry.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 14px",
              borderBottom: "1px solid var(--line)",
              fontSize: 13,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 600, color: "var(--ink)" }}>{entry.action}</span>
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
              </div>
              <div style={{ color: "var(--ink-muted)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {entry.adminEmail} · {entry.targetId}
                {entry.metadata && ` · ${formatMetadata(entry.metadata)}`}
              </div>
            </div>
            <div style={{ color: "var(--ink-faint)", fontSize: 12, flexShrink: 0 }}>
              {new Date(entry.createdAt).toLocaleString("en-US")}
            </div>
          </div>
        ))}
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
