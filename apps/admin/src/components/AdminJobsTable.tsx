"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";
import { useToast } from "@/components/Toast";

type AdminJob = {
  id: string;
  title: string;
  company: string;
  source: string;
  location: string | null;
  isActive: boolean;
  postedAt: string | null;
  deadlineAt: string | null;
};

const SOURCES = ["", "linkedin", "talentd", "remoteok", "ycombinator"];

export function AdminJobsTable() {
  const { showToast } = useToast();
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [source, setSource] = useState("");
  const [isActive, setIsActive] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (q) params.set("q", q);
    if (source) params.set("source", source);
    if (isActive) params.set("isActive", isActive);
    adminFetch(`/api/jobs?${params}`)
      .then((res) => res.json())
      .then((data: { jobs: AdminJob[]; total: number }) => {
        setJobs(data.jobs);
        setTotal(data.total);
      })
      .finally(() => setLoading(false));
  }, [page, q, source, isActive]);

  async function toggleActive(job: AdminJob) {
    const next = !job.isActive;
    setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, isActive: next } : j)));
    try {
      const res = await adminFetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) throw new Error();
      showToast(`${job.title} ${next ? "activated" : "deactivated"}.`, "success");
    } catch {
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, isActive: !next } : j)));
      showToast(`Couldn't update "${job.title}". Try again.`, "error");
    }
  }

  async function deleteJob(job: AdminJob) {
    if (!confirm(`Delete "${job.title}" at ${job.company}? This cannot be undone.`)) return;
    setJobs((prev) => prev.filter((j) => j.id !== job.id));
    setTotal((t) => t - 1);
    try {
      const res = await adminFetch(`/api/jobs/${job.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast(`Deleted "${job.title}".`, "success");
    } catch {
      showToast(`Couldn't delete "${job.title}". Refresh and try again.`, "error");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / 50));

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <input
          placeholder="Search title/company…"
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
          value={source}
          onChange={(e) => {
            setPage(1);
            setSource(e.target.value);
          }}
          style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--line)", fontSize: 13.5 }}
        >
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s || "All sources"}
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
        {jobs.map((job) => (
          <div
            key={job.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 14px",
              borderBottom: "1px solid var(--line)",
              fontSize: 13,
              opacity: job.isActive ? 1 : 0.55,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {job.title}
              </div>
              <div style={{ color: "var(--ink-muted)", fontSize: 12 }}>
                {job.company} · {job.source} · {job.location ?? "—"}
              </div>
            </div>
            <button
              onClick={() => toggleActive(job)}
              style={{
                padding: "5px 10px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--line)",
                background: job.isActive ? "var(--surface-hover)" : "var(--accent)",
                color: job.isActive ? "var(--ink)" : "var(--accent-ink)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              {job.isActive ? "Deactivate" : "Activate"}
            </button>
            <button
              onClick={() => deleteJob(job)}
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
        {!loading && jobs.length === 0 && (
          <div style={{ padding: 20, color: "var(--ink-faint)", fontSize: 13 }}>No jobs match these filters.</div>
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
