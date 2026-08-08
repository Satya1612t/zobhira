"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminFetch } from "@/lib/adminFetch";
import { useToast } from "@/components/Toast";

type AdminJob = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  workplaceType: string;
  employmentType: string | null;
  seniority: string | null;
  salaryMin: string | null;
  salaryMax: string | null;
  salaryCurrency: string | null;
  source: string;
  sourceUrl: string;
  description: string | null;
  formattedDescription: string | null;
  highlights: string[];
  tags: string[];
  postedAt: string | null;
  deadlineAt: string | null;
  logoUrl: string | null;
  firstSeenAt: string;
  lastScrapedAt: string;
  isActive: boolean;
  extractionMethod: string;
  dedupKey: string;
  raw: unknown;
};

function fmt(value: string | null | undefined): string {
  return value && value.trim() ? value : "—";
}

function fmtDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US");
}

// One row of the field list — the `visible` badge is the whole point of
// this page: it tells the admin, field by field, whether it's part of
// apps/web's JOB_SELECT + actually rendered on the public job page, or
// whether it's scraper/admin-internal and never shown to a visitor.
function Field({
  label,
  value,
  visible,
  note,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  visible: boolean;
  note?: string;
  mono?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "10px 14px", borderBottom: "1px solid var(--line)", alignItems: "flex-start" }}>
      <div style={{ width: 160, flexShrink: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-muted)" }}>{label}</div>
        <span
          style={{
            display: "inline-block",
            marginTop: 4,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            padding: "2px 6px",
            borderRadius: 999,
            background: visible ? "var(--accent-soft)" : "var(--surface-hover)",
            color: visible ? "var(--accent)" : "var(--ink-faint)",
          }}
        >
          {visible ? "On public site" : "Admin only"}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: "var(--ink)", fontFamily: mono ? "var(--font-mono)" : undefined, wordBreak: "break-word" }}>
          {value}
        </div>
        {note && <div style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 3 }}>{note}</div>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--ink-faint)" }}>
        {title}
      </h3>
      <div style={{ borderRadius: "var(--radius)", border: "1px solid var(--line)", background: "var(--surface)", overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}

export function AdminJobDetail({ id }: { id: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [job, setJob] = useState<AdminJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);

  useEffect(() => {
    adminFetch(`/api/jobs/${id}`)
      .then((res) => {
        if (res.status === 404) {
          setNotFoundState(true);
          return null;
        }
        return res.json();
      })
      .then((data) => data && setJob(data))
      .finally(() => setLoading(false));
  }, [id]);

  async function toggleActive() {
    if (!job) return;
    const next = !job.isActive;
    setJob({ ...job, isActive: next });
    try {
      const res = await adminFetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) throw new Error();
      showToast(`${job.title} ${next ? "activated" : "deactivated"}.`, "success");
    } catch {
      setJob({ ...job, isActive: !next });
      showToast("Couldn't update. Try again.", "error");
    }
  }

  async function deleteJob() {
    if (!job) return;
    if (!confirm(`Delete "${job.title}" at ${job.company}? This cannot be undone.`)) return;
    try {
      const res = await adminFetch(`/api/jobs/${job.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast(`Deleted "${job.title}".`, "success");
      router.push("/jobs");
    } catch {
      showToast("Couldn't delete. Try again.", "error");
    }
  }

  if (loading) return null;
  if (notFoundState || !job) {
    return (
      <div style={{ padding: 20, color: "var(--ink-faint)", fontSize: 13.5 }}>
        Job not found. <Link href="/jobs" style={{ color: "var(--accent)" }}>Back to jobs</Link>
      </div>
    );
  }

  const salary =
    job.salaryMin || job.salaryMax
      ? `${job.salaryCurrency ?? ""} ${job.salaryMin ?? "?"}${job.salaryMax ? ` – ${job.salaryMax}` : ""}`.trim()
      : null;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link href="/jobs" style={{ fontSize: 12.5, color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
          ← All jobs
        </Link>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
          padding: 16,
          border: "1px solid var(--line)",
          borderRadius: "var(--radius)",
          background: "var(--surface)",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600, color: "var(--ink)" }}>
            {job.title}
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--ink-muted)" }}>
            {job.company} · {job.location ?? "Location unknown"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <a href={job.sourceUrl} target="_blank" rel="noreferrer" className="admin-btn-outline" style={btnOutline}>
            View source ↗
          </a>
          <button onClick={toggleActive} style={{ ...btnBase, background: job.isActive ? "var(--surface-hover)" : "var(--accent)", color: job.isActive ? "var(--ink)" : "var(--accent-ink)" }}>
            {job.isActive ? "Deactivate" : "Activate"}
          </button>
          <button onClick={deleteJob} style={{ ...btnBase, background: "var(--surface)", color: "var(--warn)", border: "1px solid var(--warn)" }}>
            Delete
          </button>
        </div>
      </div>

      <Section title="Shown to users — core">
        <Field label="Title" value={job.title} visible />
        <Field label="Company" value={job.company} visible />
        <Field label="Location" value={fmt(job.location)} visible />
        <Field label="Workplace type" value={job.workplaceType} visible note={job.workplaceType === "unknown" ? "Hidden when \"unknown\" — public page only renders this line if set." : undefined} />
        <Field label="Employment type" value={fmt(job.employmentType)} visible />
        <Field label="Salary" value={salary ?? "Not disclosed"} visible note="Only rendered on the public page when at least one of salaryMin/salaryMax is set." />
        <Field label="Posted" value={fmtDate(job.postedAt)} visible />
        <Field label="Apply-by deadline" value={fmtDate(job.deadlineAt)} visible note='Shows "Open" publicly when empty.' />
        <Field label="Logo" value={job.logoUrl ? <img src={job.logoUrl} alt="" style={{ height: 28, borderRadius: 6 }} /> : "No logo — initial-tile fallback shown"} visible />
        <Field label="Tags" value={job.tags.length ? job.tags.join(", ") : "—"} visible note='Rendered as the "Role tags" chip row.' />
      </Section>

      <Section title="Shown to users — description">
        <Field label="Description" value={<span style={{ whiteSpace: "pre-wrap" }}>{fmt(job.description)}</span>} visible note="Raw scraped text; the public page prefers formattedDescription when present." />
        <Field label="Formatted description" value={<span style={{ whiteSpace: "pre-wrap" }}>{fmt(job.formattedDescription)}</span>} visible note="LLM-cleaned version, generated on first view and cached." />
        <Field label="Highlights" value={job.highlights.length ? job.highlights.join(" · ") : "—"} visible />
        <Field label="Apply link" value={<span style={{ wordBreak: "break-all" }}>{job.sourceUrl}</span>} visible note="Used as the Apply button's href — the raw URL itself isn't printed as text on the public page." mono />
      </Section>

      <Section title="Admin-only — not shown on the public site">
        <Field label="Active" value={job.isActive ? "Active — visible in listings" : "Inactive — hidden from listings"} visible={false} note="Controls whether this job appears at all, but isn't rendered as a field itself." />
        <Field label="Source" value={job.source} visible={false} note="Ingestion origin (greenhouse/lever/adzuna/etc.) — deliberately never surfaced to visitors." />
        <Field label="Seniority" value={fmt(job.seniority)} visible={false} note="Structured only for some sources; not part of the public job-detail select." />
        <Field label="Extraction method" value={job.extractionMethod} visible={false} />
        <Field label="First seen" value={fmtDate(job.firstSeenAt)} visible={false} />
        <Field label="Last scraped" value={fmtDate(job.lastScrapedAt)} visible={false} />
        <Field label="Dedup key" value={job.dedupKey} visible={false} mono />
        <Field label="Job ID" value={job.id} visible={false} mono note="Used in the public URL (/jobs/{id}) but not displayed as text." />
      </Section>

      <Section title="Raw scrape payload">
        <details style={{ padding: 14 }}>
          <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "var(--ink-muted)" }}>
            {job.raw ? "Show raw JSON" : "No raw payload stored"}
          </summary>
          {job.raw ? (
            <pre style={{ marginTop: 10, padding: 12, background: "var(--surface-hover)", borderRadius: "var(--radius-sm)", fontSize: 11.5, overflowX: "auto", maxHeight: 400 }}>
              {JSON.stringify(job.raw, null, 2)}
            </pre>
          ) : null}
        </details>
      </Section>
    </div>
  );
}

const btnBase: React.CSSProperties = {
  padding: "7px 14px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--line)",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
};

const btnOutline: React.CSSProperties = {
  ...btnBase,
  display: "inline-flex",
  alignItems: "center",
  background: "var(--surface)",
  color: "var(--ink)",
  textDecoration: "none",
};
