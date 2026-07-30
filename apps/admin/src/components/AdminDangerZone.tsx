"use client";

import { useState } from "react";
import { adminFetch } from "@/lib/adminFetch";
import { useToast } from "@/components/Toast";

// TEMPORARY component — a quick way to wipe all scraped data during testing.
// Delete this file + its two api/*/clear-all routes + the <AdminDangerZone />
// usage in sources/page.tsx once it's no longer needed.
export function AdminDangerZone() {
  const { showToast } = useToast();
  const [busy, setBusy] = useState<"jobs" | "contests" | null>(null);

  async function clearAll(kind: "jobs" | "contests") {
    const typed = window.prompt(
      `This permanently deletes ALL ${kind} data. This cannot be undone.\n\nType DELETE to confirm.`
    );
    if (typed !== "DELETE") return;

    setBusy(kind);
    try {
      const res = await adminFetch(`/api/${kind}/clear-all`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      const data: { deleted: number } = await res.json();
      showToast(`Deleted ${data.deleted.toLocaleString()} ${kind}.`, "success");
    } catch {
      showToast(`Couldn't clear ${kind}. Try again.`, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      style={{
        marginTop: 24,
        border: "1px dashed var(--warn)",
        borderRadius: "var(--radius)",
        background: "var(--warn-soft)",
        padding: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--warn)",
          }}
        >
          Danger zone · temporary
        </span>
      </div>
      <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--ink-muted)" }}>
        Permanently deletes every row from the database. Cannot be undone — use only for testing.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => clearAll("jobs")}
          disabled={busy !== null}
          style={{
            padding: "8px 14px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--warn)",
            background: "var(--surface)",
            color: "var(--warn)",
            fontSize: 12.5,
            fontWeight: 700,
            cursor: busy !== null ? "not-allowed" : "pointer",
            opacity: busy !== null ? 0.6 : 1,
          }}
        >
          {busy === "jobs" ? "Clearing jobs…" : "Clear all job data"}
        </button>
        <button
          onClick={() => clearAll("contests")}
          disabled={busy !== null}
          style={{
            padding: "8px 14px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--warn)",
            background: "var(--surface)",
            color: "var(--warn)",
            fontSize: 12.5,
            fontWeight: 700,
            cursor: busy !== null ? "not-allowed" : "pointer",
            opacity: busy !== null ? 0.6 : 1,
          }}
        >
          {busy === "contests" ? "Clearing contests…" : "Clear all contest data"}
        </button>
      </div>
    </div>
  );
}
