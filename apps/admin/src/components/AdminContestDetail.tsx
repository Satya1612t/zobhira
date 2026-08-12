"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminFetch } from "@/lib/adminFetch";
import { useToast } from "@/components/Toast";

type AdminContest = {
  id: string;
  title: string;
  platform: string;
  organizer: string | null;
  mode: string;
  prizeAmount: number | null;
  prizeCurrency: string | null;
  prizeSummary: string | null;
  source: string;
  sourceUrl: string;
  description: string | null;
  summary: string | null;
  highlights: string[];
  tags: string[];
  startsAt: string | null;
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

// One row of the field list — the `visible` badge mirrors AdminJobDetail:
// it tells the admin, field by field, whether it's part of apps/web's
// CONTEST_SELECT + actually rendered on the public contest page, or whether
// it's scraper/admin-internal and never shown to a visitor. Note: platform/
// source ARE in CONTEST_SELECT but are deliberately never surfaced to
// visitors (the third-party-branding invariant in CLAUDE.md), so they're
// marked "Admin only" here.
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

export function AdminContestDetail({ id }: { id: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [contest, setContest] = useState<AdminContest | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFoundState, setNotFoundState] = useState(false);

  useEffect(() => {
    adminFetch(`/api/contests/${id}`)
      .then((res) => {
        if (res.status === 404) {
          setNotFoundState(true);
          return null;
        }
        return res.json();
      })
      .then((data) => data && setContest(data))
      .finally(() => setLoading(false));
  }, [id]);

  async function toggleActive() {
    if (!contest) return;
    const next = !contest.isActive;
    setContest({ ...contest, isActive: next });
    try {
      const res = await adminFetch(`/api/contests/${contest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) throw new Error();
      showToast(`${contest.title} ${next ? "activated" : "deactivated"}.`, "success");
    } catch {
      setContest({ ...contest, isActive: !next });
      showToast("Couldn't update. Try again.", "error");
    }
  }

  async function deleteContest() {
    if (!contest) return;
    if (!confirm(`Delete "${contest.title}"? This cannot be undone.`)) return;
    try {
      const res = await adminFetch(`/api/contests/${contest.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast(`Deleted "${contest.title}".`, "success");
      router.push("/contests");
    } catch {
      showToast("Couldn't delete. Try again.", "error");
    }
  }

  if (loading) return null;
  if (notFoundState || !contest) {
    return (
      <div style={{ padding: 20, color: "var(--ink-faint)", fontSize: 13.5 }}>
        Contest not found. <Link href="/contests" style={{ color: "var(--accent)" }}>Back to contests</Link>
      </div>
    );
  }

  const prize =
    contest.prizeAmount !== null
      ? `${contest.prizeCurrency ?? ""} ${contest.prizeAmount}`.trim()
      : null;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link href="/contests" style={{ fontSize: 12.5, color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
          ← All contests
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
            {contest.title}
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--ink-muted)" }}>
            {contest.organizer ?? "Organizer unknown"} · {contest.mode !== "unknown" ? contest.mode.replace("_", " ") : "mode unknown"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <a href={contest.sourceUrl} target="_blank" rel="noreferrer" className="admin-btn-outline" style={btnOutline}>
            View source ↗
          </a>
          <button onClick={toggleActive} style={{ ...btnBase, background: contest.isActive ? "var(--surface-hover)" : "var(--accent)", color: contest.isActive ? "var(--ink)" : "var(--accent-ink)" }}>
            {contest.isActive ? "Deactivate" : "Activate"}
          </button>
          <button onClick={deleteContest} style={{ ...btnBase, background: "var(--surface)", color: "var(--warn)", border: "1px solid var(--warn)" }}>
            Delete
          </button>
        </div>
      </div>

      <Section title="Shown to users — core">
        <Field label="Title" value={contest.title} visible />
        <Field label="Organizer" value={fmt(contest.organizer)} visible note="Only rendered on the public page when set." />
        <Field label="Mode" value={contest.mode} visible note={contest.mode === "unknown" ? "Hidden when \"unknown\" — public page only renders this line if set." : undefined} />
        <Field label="Starts" value={fmtDate(contest.startsAt)} visible note="Feeds the countdown + calendar (.ics) export." />
        <Field label="Deadline" value={fmtDate(contest.deadlineAt)} visible note="Drives the countdown tiles and the urgency strip." />
        <Field label="Logo" value={contest.logoUrl ? <img src={contest.logoUrl} alt="" style={{ height: 28, borderRadius: 6 }} /> : "No logo — initial-tile fallback shown"} visible />
        <Field label="Tags" value={contest.tags.length ? contest.tags.join(", ") : "—"} visible note="Rendered as the chip row + drives related contests." />
      </Section>

      <Section title="Shown to users — prize & description">
        <Field label="Prize summary" value={fmt(contest.prizeSummary)} visible note="The headline prize text on the public page." />
        <Field label="Summary" value={<span style={{ whiteSpace: "pre-wrap" }}>{fmt(contest.summary)}</span>} visible note='Shown as "About this contest"; the public page prefers this over the raw description.' />
        <Field label="Description" value={<span style={{ whiteSpace: "pre-wrap" }}>{fmt(contest.description)}</span>} visible note='Raw scraped text, offered behind "Show original description" when a summary exists.' />
        <Field label="Highlights" value={contest.highlights.length ? contest.highlights.map((h) => <div key={h}>· {h}</div>) : "—"} visible note='Rendered as the "Key facts" grid.' />
        <Field label="Register link" value={<span style={{ wordBreak: "break-all" }}>{contest.sourceUrl}</span>} visible note="Used as the Register button's href — the raw URL itself isn't printed as text on the public page." mono />
      </Section>

      <Section title="Admin-only — not shown on the public site">
        <Field label="Active" value={contest.isActive ? "Active — visible in listings" : "Inactive — hidden from listings"} visible={false} note="Controls whether this contest appears at all, but isn't rendered as a field itself." />
        <Field label="Platform" value={contest.platform} visible={false} note="In CONTEST_SELECT but deliberately never surfaced to visitors (no platform badges on /contest)." />
        <Field label="Source" value={contest.source} visible={false} note="Ingestion origin — deliberately never surfaced to visitors." />
        <Field label="Prize amount" value={prize ?? "—"} visible={false} note="Only feeds the structured JSON-LD offer, not shown as visible text." />
        <Field label="Extraction method" value={contest.extractionMethod} visible={false} />
        <Field label="First seen" value={fmtDate(contest.firstSeenAt)} visible={false} />
        <Field label="Last scraped" value={fmtDate(contest.lastScrapedAt)} visible={false} />
        <Field label="Dedup key" value={contest.dedupKey} visible={false} mono />
        <Field label="Contest ID" value={contest.id} visible={false} mono note="Used in the public URL (/contest/{id}) but not displayed as text." />
      </Section>

      <Section title="Raw scrape payload">
        <details style={{ padding: 14 }}>
          <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "var(--ink-muted)" }}>
            {contest.raw ? "Show raw JSON" : "No raw payload stored"}
          </summary>
          {contest.raw ? (
            <pre style={{ marginTop: 10, padding: 12, background: "var(--surface-hover)", borderRadius: "var(--radius-sm)", fontSize: 11.5, overflowX: "auto", maxHeight: 400 }}>
              {JSON.stringify(contest.raw, null, 2)}
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
