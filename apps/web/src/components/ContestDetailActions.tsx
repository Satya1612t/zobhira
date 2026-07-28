"use client";

import { useState } from "react";

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 10.5 15.4 6.5M8.6 13.5l6.8 4" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

// "Register" never names the aggregation source — same brand rule as job
// detail's "Apply on company site". The .ics link is a plain data: URI
// anchor built server-side (see lib/ics.ts), so "add to calendar" needs no
// backend endpoint or client JS of its own — only Share does.
export function ContestDetailActions({
  sourceUrl,
  icsHref,
  icsFilename,
}: {
  sourceUrl: string;
  icsHref: string | null;
  icsFilename: string;
}) {
  const [shared, setShared] = useState(false);

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ url: window.location.href });
      } catch {
        // Cancelled — not an error.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShared(true);
      setTimeout(() => setShared(false), 1800);
    } catch {
      // Clipboard API unavailable.
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary job-apply-cta">
        Register now
      </a>
      <div style={{ display: "flex", gap: 8 }}>
        {icsHref && (
          <a href={icsHref} download={icsFilename} className="btn btn-secondary" style={{ flex: 1, textDecoration: "none" }}>
            <CalendarIcon />
            Add to calendar
          </a>
        )}
        <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={handleShare}>
          <ShareIcon />
          {shared ? "Copied!" : "Share"}
        </button>
      </div>
    </div>
  );
}
