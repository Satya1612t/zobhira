"use client";

import { useId, useState } from "react";

function strengthOf(value: string): number {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 8) score++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  return score;
}

const STRENGTH_COLOR = ["var(--color-error)", "var(--color-error)", "var(--color-signal)", "var(--color-signal)", "var(--color-success)"];
const STRENGTH_LABEL = ["", "Weak", "Fair", "Good", "Strong"];

export function PasswordFieldV2({
  label,
  autoComplete,
  showStrength = false,
  validate,
}: {
  label: string;
  autoComplete: string;
  showStrength?: boolean;
  validate?: (value: string) => string | null;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const strength = strengthOf(value);

  return (
    <div className="field-floating">
      <input
        id={id}
        type={visible ? "text" : "password"}
        placeholder=" "
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={(e) => validate && setError(validate(e.target.value))}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`field-floating-input${error ? " field-floating-input--error" : ""}`}
        style={{ paddingRight: 44 }}
      />
      <label htmlFor={id} className="field-floating-label">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="field-password-toggle"
      >
        <span key={visible ? "on" : "off"} className="field-password-toggle-icon">
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
        </span>
      </button>
      {error && (
        <p id={errorId} role="alert" className="field-floating-error">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16h.01" />
          </svg>
          {error}
        </p>
      )}
      {showStrength && value && (
        <div className="field-strength">
          <div className="field-strength-bars">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="field-strength-bar" style={{ background: i < strength ? STRENGTH_COLOR[strength] : "var(--color-divider)" }} />
            ))}
          </div>
          <span className="field-strength-label" style={{ color: STRENGTH_COLOR[strength] }}>
            {STRENGTH_LABEL[strength]}
          </span>
        </div>
      )}
    </div>
  );
}
