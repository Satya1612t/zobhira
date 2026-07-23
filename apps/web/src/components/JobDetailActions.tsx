"use client";

import { useState } from "react";
import { ApplyModal } from "./ApplyModal";

// Design-only: bookmark state is local, Quick Apply opens the (also
// static) ApplyModal — see /DESIGN.md. Neither persists anywhere.
export function JobDetailActions({ jobTitle, company }: { jobTitle: string; company: string }) {
  const [saved, setSaved] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);

  return (
    <>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="btn btn-primary btn-block"
          style={{ flex: 1 }}
          onClick={() => setApplyOpen(true)}
        >
          Quick Apply
        </button>
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
      {applyOpen && <ApplyModal jobTitle={jobTitle} company={company} onClose={() => setApplyOpen(false)} />}
    </>
  );
}
