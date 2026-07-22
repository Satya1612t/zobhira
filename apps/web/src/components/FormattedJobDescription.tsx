"use client";

import { useEffect, useState } from "react";
import { linkifyText } from "@/lib/linkify";

export function FormattedJobDescription({
  jobId,
  description,
  formattedDescription,
  highlights: initialHighlights,
}: {
  jobId: string;
  description: string | null;
  formattedDescription: string | null;
  highlights: string[];
}) {
  const [formatted, setFormatted] = useState(formattedDescription);
  const [highlights, setHighlights] = useState(initialHighlights);
  const [loading, setLoading] = useState(false);

  // Already cached (a previous viewer triggered the LLM call) — render
  // instantly, no fetch needed. Only the first-ever viewer of a job pays
  // the ~30-90s LLM latency; every viewer after that gets this for free.
  useEffect(() => {
    if (formatted || !description) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/jobs/${jobId}/format-description`, { method: "POST" })
      .then((res) => res.json())
      .then((data: { formatted_description?: string; highlights?: string[] }) => {
        if (cancelled) return;
        if (data.formatted_description) setFormatted(data.formatted_description);
        if (Array.isArray(data.highlights)) setHighlights(data.highlights);
      })
      .catch(() => {
        // Silently keep showing the raw description — never block or
        // error out the page over a best-effort enhancement.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!description) {
    return (
      <div
        style={{
          marginTop: 26,
          paddingTop: 22,
          borderTop: "1px solid var(--line)",
          color: "var(--ink-faint)",
          fontSize: 14,
        }}
      >
        No description available yet — see the original posting for full details.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 26, paddingTop: 22, borderTop: "1px solid var(--line)" }}>
      {loading && (
        <div
          className="skeleton-shimmer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            padding: "5px 12px",
            borderRadius: 999,
            background: "linear-gradient(90deg, var(--accent-soft) 25%, var(--surface-hover) 37%, var(--accent-soft) 63%)",
            backgroundSize: "400% 100%",
            color: "var(--accent)",
            marginBottom: 16,
          }}
        >
          ✨ Formatting with AI…
        </div>
      )}

      {highlights.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--ink-faint)",
              marginBottom: 7,
            }}
          >
            Key highlights
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {highlights.map((highlight) => (
              <span
                key={highlight}
                style={{
                  fontSize: 12.5,
                  padding: "4px 11px",
                  borderRadius: 999,
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                  border: "1px solid var(--line)",
                  fontWeight: 600,
                }}
              >
                ✓ {highlight}
              </span>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          lineHeight: 1.7,
          whiteSpace: "pre-wrap",
          overflowWrap: "break-word",
          color: "var(--ink)",
          fontSize: 14.5,
        }}
      >
        {linkifyText(formatted ?? description)}
      </div>
    </div>
  );
}
