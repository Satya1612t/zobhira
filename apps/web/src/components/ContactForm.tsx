"use client";

import { useState } from "react";

const REASONS = [
  { value: "general", label: "General question" },
  { value: "bad-listing", label: "Broken link" },
  { value: "suggestion", label: "Suggestion" },
];

const CONTACT_EMAIL = "naukri.intech@gmail.com";
const MAX_LENGTH = 800;

// No form backend exists yet — this builds a real mailto: link with a
// prefilled subject/body rather than faking a submit that goes nowhere
// (see /DESIGN.md's pattern for every other "no backend yet" interaction
// in this app). `presetReason` lets the two dedicated contact cards below
// jump straight into this same form pre-selected, instead of duplicating
// it three times.
export function ContactForm({ presetReason }: { presetReason?: string }) {
  const [reason, setReason] = useState(presetReason ?? "general");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "");
    const email = String(form.get("email") ?? "");
    const reasonLabel = REASONS.find((r) => r.value === reason)?.label ?? "General question";

    const subject = `[Zobhira] ${reasonLabel}`;
    const body = `${message}\n\n---\nFrom: ${name} (${email})`;
    const mailtoUrl = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
    setSent(true);
  }

  if (sent) {
    return (
      <div className="job-card" style={{ padding: 28, textAlign: "center", borderColor: "var(--color-success)" }}>
        <div style={{ width: 44, height: 44, margin: "0 auto 14px", borderRadius: "var(--radius-full)", background: "var(--color-success-soft)", color: "var(--color-success)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", margin: "0 0 8px" }}>Opening your email client&hellip;</h2>
        <p style={{ fontSize: 13.5, color: "var(--color-text-muted)", margin: 0 }}>
          If nothing happened, email us directly at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--color-accent)", fontWeight: 600 }}>{CONTACT_EMAIL}</a>.
        </p>
        <button type="button" className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => setSent(false)}>
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="job-card" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="field-floating">
        <input id="contact-name" name="name" required placeholder=" " autoComplete="name" className="field-floating-input" />
        <label htmlFor="contact-name" className="field-floating-label">Name</label>
      </div>
      <div className="field-floating">
        <input id="contact-email" name="email" type="email" required placeholder=" " autoComplete="email" className="field-floating-input" />
        <label htmlFor="contact-email" className="field-floating-label">Email address</label>
      </div>
      <div>
        <label htmlFor="contact-reason" style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: "var(--color-text-muted)" }}>
          Reason
        </label>
        <select id="contact-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="input" style={{ borderRadius: "var(--radius-md)", height: 44 }}>
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>
      <div>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={5}
          maxLength={MAX_LENGTH}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What's on your mind?"
          className="input"
          style={{ borderRadius: "var(--radius-md)", resize: "vertical", minHeight: 110 }}
        />
        <div style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
          {message.length} / {MAX_LENGTH}
        </div>
      </div>
      <button type="submit" className="btn btn-primary" style={{ width: "100%", height: 46, borderRadius: "var(--radius-full)" }}>
        Send message
      </button>
      <p style={{ fontSize: 11.5, color: "var(--color-text-muted)", textAlign: "center", margin: 0 }}>
        Opens your email client with this message pre-filled. There&apos;s no live inbox on this page
        yet.
      </p>
    </form>
  );
}
