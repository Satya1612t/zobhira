"use client";

import { useState } from "react";

// Design-only: no accounts exist yet (see /DESIGN.md) — this page is a
// static mockup of the profile layout with hardcoded sample data, not tied
// to any real logged-in user.
const SAMPLE_APPLIED = [
  { id: "1", title: "Frontend Engineer", company: "Zeta Labs" },
  { id: "2", title: "Platform Engineer", company: "Northwind" },
];
const SAMPLE_SAVED = [
  { id: "3", title: "Senior React Developer", company: "Orbital" },
  { id: "4", title: "Backend Engineer (Go)", company: "Meridian" },
];

export default function ProfilePage() {
  const [tab, setTab] = useState<"applied" | "saved">("applied");
  const rows = tab === "applied" ? SAMPLE_APPLIED : SAMPLE_SAVED;

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 60px" }}>
      <div
        style={{
          padding: "10px 14px",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-md)",
          fontSize: 12.5,
          color: "var(--warn)",
          fontWeight: 600,
          marginBottom: 24,
        }}
      >
        Design preview — sample data, not a real account.
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap", marginBottom: 28 }}>
        <div style={{ width: 96, height: 96, flexShrink: 0, borderRadius: "var(--radius-md)", background: "var(--color-surface-muted)", border: "1px solid var(--color-divider)" }} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ margin: "0 0 4px", fontSize: 24 }}>Aditi Rao</h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-muted)" }}>
            Frontend Engineer &middot; Bangalore &middot; Open to remote
          </p>
        </div>
        <button type="button" className="btn btn-secondary">
          Edit profile
        </button>
      </div>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 28 }}>
        <div>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 22, color: "var(--color-accent)" }}>{SAMPLE_APPLIED.length}</div>
          <div style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>Applications</div>
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 22, color: "var(--color-accent)" }}>{SAMPLE_SAVED.length}</div>
          <div style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>Saved roles</div>
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 22, color: "var(--color-accent)" }}>37</div>
          <div style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>Profile views</div>
        </div>
      </div>

      <div className="seg" role="radiogroup" style={{ marginBottom: 18, width: "fit-content" }}>
        <label className="seg-opt">
          <input type="radio" name="ptab" checked={tab === "applied"} onChange={() => setTab("applied")} />
          Applied
        </label>
        <label className="seg-opt">
          <input type="radio" name="ptab" checked={tab === "saved"} onChange={() => setTab("saved")} />
          Saved
        </label>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((row) => (
          <div
            key={row.id}
            className="card"
            style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: "14px 18px" }}
          >
            <span
              style={{
                width: 38,
                height: 38,
                flexShrink: 0,
                borderRadius: "var(--radius-sm)",
                background: "var(--color-accent-soft)",
                color: "var(--color-accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {row.company[0]}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="card-title" style={{ fontSize: 15 }}>{row.title}</div>
              <div style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>{row.company}</div>
            </div>
            <span className={tab === "applied" ? "tag tag-accent" : "tag tag-outline"}>
              {tab === "applied" ? "Applied" : "Saved"}
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}
