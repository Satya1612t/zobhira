"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

// Current ingestion sources (LinkedIn/Talentd/YCombinator retired). Value is
// the raw `jobs.source` string the filter queries on; label is human-readable.
const SOURCES: { value: string; label: string }[] = [
  { value: "", label: "All sources" },
  { value: "greenhouse", label: "Greenhouse" },
  { value: "lever", label: "Lever" },
  { value: "ashby", label: "Ashby" },
  { value: "smartrecruiters", label: "SmartRecruiters" },
  { value: "workable", label: "Workable" },
  { value: "recruitee", label: "Recruitee" },
  { value: "adzuna", label: "Adzuna" },
  { value: "jooble", label: "Jooble" },
  { value: "careerjet", label: "Careerjet" },
  { value: "himalayas", label: "Himalayas" },
];

export function AdminJobsTable() {
  const { showToast } = useToast();
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [source, setSource] = useState("");
  const [isActive, setIsActive] = useState("");
  const [formatted, setFormatted] = useState("");
  const [loading, setLoading] = useState(false);

  // Free-text search is debounced (typing "software engineer" would
  // otherwise fire 18 requests); source/status are instant since they're
  // discrete choices, not keystrokes.
  const [qInput, setQInput] = useState("");
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
    if (q) params.set("q", q);
    if (source) params.set("source", source);
    if (isActive) params.set("isActive", isActive);
    if (formatted) params.set("formatted", formatted);
    adminFetch(`/api/jobs?${params}`)
      .then((res) => res.json())
      .then((data: { jobs: AdminJob[]; total: number }) => {
        setJobs(data.jobs);
        setTotal(data.total);
      })
      .finally(() => setLoading(false));
  }, [page, q, source, isActive, formatted]);

  const activeFilters = [
    q ? { key: "q", label: `"${q}"`, clear: () => { setQInput(""); setQ(""); } } : null,
    source ? { key: "source", label: source, clear: () => setSource("") } : null,
    isActive ? { key: "isActive", label: isActive === "true" ? "Active only" : "Inactive only", clear: () => setIsActive("") } : null,
    formatted ? { key: "formatted", label: formatted === "true" ? "Formatted only" : "Unformatted only", clear: () => setFormatted("") } : null,
  ].filter((f): f is { key: string; label: string; clear: () => void } => f !== null);

  function clearAllFilters() {
    setQInput("");
    setQ("");
    setSource("");
    setIsActive("");
    setFormatted("");
    setPage(1);
  }

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
              placeholder="Search title or company…"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 30px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--line)",
                fontSize: 13.5,
                background: "var(--bg, var(--surface))",
              }}
            />
          </div>
          <select
            value={source}
            onChange={(e) => {
              setPage(1);
              setSource(e.target.value);
            }}
            style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--line)", fontSize: 13.5, color: "var(--ink)" }}
          >
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            value={isActive}
            onChange={(e) => {
              setPage(1);
              setIsActive(e.target.value);
            }}
            style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--line)", fontSize: 13.5, color: "var(--ink)" }}
          >
            <option value="">Active + inactive</option>
            <option value="true">Active only</option>
            <option value="false">Inactive only</option>
          </select>
          <select
            value={formatted}
            onChange={(e) => {
              setPage(1);
              setFormatted(e.target.value);
            }}
            style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--line)", fontSize: 13.5, color: "var(--ink)" }}
          >
            <option value="">All formatting</option>
            <option value="true">Formatted only</option>
            <option value="false">Unformatted only</option>
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
              <Link
                href={`/jobs/${job.id}`}
                style={{ fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", textDecoration: "none" }}
              >
                {job.title}
              </Link>
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
