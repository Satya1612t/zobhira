"use client";

import { useState } from "react";

// Design-only: "Quick Apply" is a visual shell — no /api/jobs/[id]/apply
// backend exists yet (see /DESIGN.md). Submitting shows the mockup's
// success state locally; nothing is uploaded or persisted.
export function ApplyModal({
  jobTitle,
  company,
  onClose,
}: {
  jobTitle: string;
  company: string;
  onClose: () => void;
}) {
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        style={{ width: "min(440px, 100%)", position: "relative" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer", color: "var(--color-text)" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>

        {submitted ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 14px" }}>
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <div className="dialog-title">Application sent</div>
            <p className="dialog-body">{company} will be in touch if it&apos;s a match.</p>
            <button type="button" className="btn btn-secondary" style={{ marginTop: 8 }} onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="dialog-title">Apply to {jobTitle}</div>
            <div style={{ fontSize: 13, color: "color-mix(in srgb, var(--color-text) 65%, transparent)", marginTop: -8 }}>
              {company} &middot; Quick Apply via Zobhira
            </div>
            <form
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
              onSubmit={(e) => {
                e.preventDefault();
                setSubmitted(true);
              }}
            >
              <div className="field">
                <label>Full name</label>
                <input className="input" type="text" placeholder="Your name" />
              </div>
              <div className="field">
                <label>Email</label>
                <input className="input" type="email" placeholder="you@example.com" />
              </div>
              <div className="field">
                <label>Resume</label>
                <div style={{ border: "1px dashed var(--color-divider)", borderRadius: "var(--radius-md)", padding: 20, textAlign: "center", cursor: "pointer" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 6px", display: "block" }}>
                    <path d="M12 3v12" />
                    <path d="m7 8 5-5 5 5" />
                    <path d="M5 21h14" />
                  </svg>
                  <span style={{ fontSize: 13, color: "color-mix(in srgb, var(--color-text) 65%, transparent)" }}>
                    Drop your resume here, or click to browse
                  </span>
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-block">
                Submit application
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
