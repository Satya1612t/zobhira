"use client";

import { useId, useState } from "react";

// The one genuinely interactive piece on the otherwise-static /login page —
// a real show/hide toggle needs no backend, so it's wired up for real
// rather than left decorative (see /DESIGN.md).
export function PasswordField({ label, placeholder }: { label: string; placeholder: string }) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)", display: "flex" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        </span>
        <input
          className="input"
          id={id}
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          style={{ paddingLeft: 36, paddingRight: 36, height: 40 }}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", display: "flex", padding: 2 }}
        >
          {visible ? (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3l18 18" />
              <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
              <path d="M9.9 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a13.9 13.9 0 0 1-3.2 4M6.5 6.6C3.7 8.3 2 12 2 12s3.5 7 10 7a10 10 0 0 0 3.4-.6" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
