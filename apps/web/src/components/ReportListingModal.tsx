"use client";

import { useId, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

const REASONS = [
  "Link is broken or expired",
  "Listing details don't match the original post",
  "Duplicate of another listing",
  "Looks fake or spam",
];

const CONTACT_EMAIL = "naukri.intech@gmail.com";

// No link-health backend endpoint from this app yet — builds a real
// mailto: with the listing's own title/URL prefilled, same honesty
// pattern as ContactForm.tsx, rather than a submit that silently goes
// nowhere. Link-health itself already runs on a schedule (see /DESIGN.md);
// this is the direct-report path for when it hasn't caught something yet.
export function ReportListingModal({
  open,
  onClose,
  listingTitle,
  listingUrl,
}: {
  open: boolean;
  onClose: () => void;
  listingTitle: string;
  listingUrl: string;
}) {
  const titleId = useId();
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState("");
  const showToast = useToast();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const subject = `[Zobhira] Bad listing report`;
    const body = `Listing: ${listingTitle}\nURL: ${listingUrl}\nReason: ${reason}\n\nNote:\n${note}`;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    showToast("Opening your email client to send the report", "success");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} size="sm">
      <form onSubmit={handleSubmit} style={{ padding: 24 }}>
        <h2 id={titleId} style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", margin: "0 0 6px" }}>
          Report this listing
        </h2>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "0 0 18px" }}>
          {listingTitle}
        </p>

        <fieldset style={{ border: "none", padding: 0, margin: "0 0 16px" }}>
          <legend style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>Reason</legend>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {REASONS.map((r) => (
              <label key={r} className="jobs-filter-check">
                <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} />
                <span className="jobs-filter-check-box" aria-hidden="true" />
                <span>{r}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label htmlFor="report-note" style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
          Additional details (optional)
        </label>
        <textarea
          id="report-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="input"
          style={{ borderRadius: "var(--radius-md)", resize: "vertical", marginBottom: 18 }}
        />

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Send report
          </button>
        </div>
      </form>
    </Modal>
  );
}
