"use client";

import { useState } from "react";

// Save state is local/cosmetic — no backend to persist it yet (see
// /DESIGN.md). "Quick Apply" used to open a fake modal with a form that
// went nowhere (no /api/jobs/[id]/apply backend exists); it's now just the
// real apply link — same destination as "View original posting" below it
// on the page, just styled as the primary action.
export function JobDetailActions({ sourceUrl }: { sourceUrl: string }) {
  const [saved, setSaved] = useState(false);

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary btn-block"
        style={{ flex: 1, textAlign: "center", textDecoration: "none" }}
      >
        Apply now
      </a>
      <button
        type="button"
        className="btn btn-secondary btn-icon"
        aria-label={saved ? "Unsave" : "Save"}
        style={{ color: saved ? "var(--color-accent)" : undefined }}
        onClick={() => setSaved((v) => !v)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21 12 16l-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    </div>
  );
}
