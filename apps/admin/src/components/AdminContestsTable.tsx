"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";
import { useToast } from "@/components/Toast";

type AdminContest = {
  id: string;
  title: string;
  platform: string;
  organizer: string | null;
  isActive: boolean;
  startsAt: string | null;
  deadlineAt: string | null;
};

const PLATFORMS = ["", "dev_community"];

export function AdminContestsTable() {
  const { showToast } = useToast();
  const [contests, setContests] = useState<AdminContest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [platform, setPlatform] = useState("");
  const [isActive, setIsActive] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (q) params.set("q", q);
    if (platform) params.set("platform", platform);
    if (isActive) params.set("isActive", isActive);
    adminFetch(`/api/contests?${params}`)
      .then((res) => res.json())
      .then((data: { contests: AdminContest[]; total: number }) => {
        setContests(data.contests);
        setTotal(data.total);
      })
      .finally(() => setLoading(false));
  }, [page, q, platform, isActive]);

  async function toggleActive(contest: AdminContest) {
    const next = !contest.isActive;
    setContests((prev) => prev.map((c) => (c.id === contest.id ? { ...c, isActive: next } : c)));
    try {
      const res = await adminFetch(`/api/contests/${contest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) throw new Error();
      showToast(`${contest.title} ${next ? "activated" : "deactivated"}.`, "success");
    } catch {
      setContests((prev) => prev.map((c) => (c.id === contest.id ? { ...c, isActive: !next } : c)));
      showToast(`Couldn't update "${contest.title}". Try again.`, "error");
    }
  }

  async function deleteContest(contest: AdminContest) {
    if (!confirm(`Delete "${contest.title}"? This cannot be undone.`)) return;
    setContests((prev) => prev.filter((c) => c.id !== contest.id));
    setTotal((t) => t - 1);
    try {
      const res = await adminFetch(`/api/contests/${contest.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast(`Deleted "${contest.title}".`, "success");
    } catch {
      showToast(`Couldn't delete "${contest.title}". Refresh and try again.`, "error");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / 50));

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <input
          placeholder="Search title/organizer…"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          style={{
            padding: "8px 12px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--line)",
            fontSize: 13.5,
            minWidth: 220,
          }}
        />
        <select
          value={platform}
          onChange={(e) => {
            setPage(1);
            setPlatform(e.target.value);
          }}
          style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--line)", fontSize: 13.5 }}
        >
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {p || "All platforms"}
            </option>
          ))}
        </select>
        <select
          value={isActive}
          onChange={(e) => {
            setPage(1);
            setIsActive(e.target.value);
          }}
          style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--line)", fontSize: 13.5 }}
        >
          <option value="">Active + inactive</option>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
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
        {contests.map((contest) => (
          <div
            key={contest.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 14px",
              borderBottom: "1px solid var(--line)",
              fontSize: 13,
              opacity: contest.isActive ? 1 : 0.55,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {contest.title}
              </div>
              <div style={{ color: "var(--ink-muted)", fontSize: 12 }}>
                {contest.organizer ?? "—"} · {contest.platform}
              </div>
            </div>
            <button
              onClick={() => toggleActive(contest)}
              style={{
                padding: "5px 10px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--line)",
                background: contest.isActive ? "var(--surface-hover)" : "var(--accent)",
                color: contest.isActive ? "var(--ink)" : "var(--accent-ink)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              {contest.isActive ? "Deactivate" : "Activate"}
            </button>
            <button
              onClick={() => deleteContest(contest)}
              style={{
                padding: "5px 10px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--line)",
                background: "var(--surface)",
                color: "var(--warn)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              Delete
            </button>
          </div>
        ))}
        {!loading && contests.length === 0 && (
          <div style={{ padding: 20, color: "var(--ink-faint)", fontSize: 13 }}>No contests match these filters.</div>
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
