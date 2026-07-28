"use client";

import { useId, useState, type InputHTMLAttributes } from "react";

// Real <label htmlFor>, not a placeholder pretending to be one — floating
// purely via CSS (:focus/:not(:placeholder-shown)), so it works with
// autofill and screen readers exactly like a normal label. Validation is
// on blur only, never on every keystroke.
export function FloatingInput({
  label,
  validate,
  ...props
}: {
  label: string;
  validate?: (value: string) => string | null;
} & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const errorId = `${id}-error`;
  const [error, setError] = useState<string | null>(null);

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    if (validate) setError(validate(e.target.value));
    props.onBlur?.(e);
  }

  return (
    <div className="field-floating">
      <input
        {...props}
        id={id}
        placeholder=" "
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`field-floating-input${error ? " field-floating-input--error" : ""}`}
        onBlur={handleBlur}
      />
      <label htmlFor={id} className="field-floating-label">
        {label}
      </label>
      {error && (
        <p id={errorId} role="alert" className="field-floating-error">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16h.01" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}
