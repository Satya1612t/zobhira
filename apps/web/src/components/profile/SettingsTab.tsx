"use client";

import { useId, useState } from "react";
import { Modal } from "@/components/ui/Modal";

function SettingsRow({ label, helper, control }: { label: string; helper: string; control: React.ReactNode }) {
  return (
    <div className="settings-row">
      <div>
        <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--color-text)" }}>{label}</div>
        <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>{helper}</div>
      </div>
      <div style={{ flexShrink: 0 }}>{control}</div>
    </div>
  );
}

function DeleteAccountCard() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const inputId = useId();
  const canDelete = confirmText.trim().toLowerCase() === "delete";

  return (
    <>
      <div className="settings-danger-card">
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--color-error)" }}>Delete account</div>
          <div style={{ fontSize: 12.5, color: "var(--color-text-muted)", marginTop: 2 }}>
            Permanently removes your saved roles, applications, and alerts. This can&apos;t be undone.
          </div>
        </div>
        <button type="button" className="btn" style={{ border: "1px solid var(--color-error)", color: "var(--color-error)", flexShrink: 0 }} onClick={() => setOpen(true)}>
          Delete account
        </button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="delete-account-title">
        <div style={{ padding: 24 }}>
          <h2 id="delete-account-title" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-xl)", margin: "0 0 8px", color: "var(--color-error)" }}>
            Delete your account?
          </h2>
          <p style={{ fontSize: 13.5, color: "var(--color-text-muted)", margin: "0 0 16px", lineHeight: 1.5 }}>
            This permanently removes everything tied to your account. Type <strong>delete</strong> to
            confirm.
          </p>
          <label htmlFor={inputId} style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            Type &quot;delete&quot; to confirm
          </label>
          <input
            id={inputId}
            className="input"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
          />
          <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn"
              disabled={!canDelete}
              style={{ background: "var(--color-error)", color: "#fff", opacity: canDelete ? 1 : 0.45, cursor: canDelete ? "pointer" : "not-allowed" }}
            >
              Delete permanently
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export function SettingsTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div className="job-card" style={{ padding: "4px 20px" }}>
        <SettingsRow
          label="Email notifications"
          helper="Weekly digest of new roles matching your alerts"
          control={<input type="checkbox" defaultChecked style={{ accentColor: "var(--color-accent)", width: 18, height: 18 }} />}
        />
        <SettingsRow
          label="Profile visibility"
          helper="Whether your saved-role activity is used to improve suggestions"
          control={<input type="checkbox" defaultChecked style={{ accentColor: "var(--color-accent)", width: 18, height: 18 }} />}
        />
        <SettingsRow
          label="Language"
          helper="Display language for the site"
          control={
            <select className="input" style={{ width: "auto" }} defaultValue="en">
              <option value="en">English</option>
            </select>
          }
        />
      </div>

      <div style={{ marginTop: 20 }}>
        <DeleteAccountCard />
      </div>
    </div>
  );
}
