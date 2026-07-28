"use client";

import { useState } from "react";
import { ReportListingModal } from "@/components/ReportListingModal";

function ExternalLinkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="job-apply-cta-icon">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
    </svg>
  );
}
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

// Save state is local/cosmetic — no backend to persist it yet (see
// /DESIGN.md). "Apply now," never "Apply on company site" — the latter
// hints at where the listing came from, which stays a filter field only.
export function JobDetailActions({ sourceUrl, title }: { sourceUrl: string; title?: string }) {
  const [saved, setSaved] = useState(false);
  const [shared, setShared] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ url: window.location.href });
      } catch {
        // User cancelled the native share sheet — not an error.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShared(true);
      setTimeout(() => setShared(false), 1800);
    } catch {
      // Clipboard API unavailable — nothing more we can do without a backend.
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary job-apply-cta"
      >
        Apply now
        <ExternalLinkIcon />
      </a>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ flex: 1 }}
          aria-label={saved ? "Unsave" : "Save"}
          onClick={() => setSaved((v) => !v)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: saved ? "var(--color-accent)" : undefined }}>
            <path d="M19 21 12 16l-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          {saved ? "Saved" : "Save"}
        </button>
        <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={handleShare}>
          <ShareIcon />
          {shared ? "Copied!" : "Share"}
        </button>
      </div>
      {title && (
        <button
          type="button"
          onClick={() => setReportOpen(true)}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--color-text-muted)", textDecoration: "underline", textUnderlineOffset: 3, padding: "4px 0" }}
        >
          Report a problem with this listing
        </button>
      )}
      {title && (
        <ReportListingModal open={reportOpen} onClose={() => setReportOpen(false)} listingTitle={title} listingUrl={sourceUrl} />
      )}
    </div>
  );
}
