"use client";

import { useEffect, useState } from "react";
import { linkifyText } from "@/lib/linkify";

type StructuredDescription = {
  overview: string | null;
  responsibilities: string[];
  requirements: string[];
  niceToHave: string[];
  benefits: string[];
  details: string[];
};

const SECTION_LABELS: Record<keyof Omit<StructuredDescription, "overview">, string> = {
  responsibilities: "Responsibilities",
  requirements: "Requirements",
  niceToHave: "Nice to have",
  benefits: "Benefits",
  details: "Additional details",
};

// `formatted_description` holds either the new structured JSON (see
// services/scraper/utils/job_formatter.py) or, for rows formatted before
// that change (or when every LLM provider failed and only the
// deterministic empty-label cleanup ran), plain reformatted text — both
// are valid, real cached states, not an error condition, so this has to
// handle both rather than assuming the newer shape everywhere.
function parseStructured(formatted: string): StructuredDescription | null {
  let data: unknown;
  try {
    data = JSON.parse(formatted);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const isStrArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
  if (
    !("overview" in d) &&
    !isStrArray(d.responsibilities) &&
    !isStrArray(d.requirements) &&
    !isStrArray(d.niceToHave) &&
    !isStrArray(d.benefits) &&
    !isStrArray(d.details)
  ) {
    return null;
  }
  return {
    overview: typeof d.overview === "string" ? d.overview : null,
    responsibilities: isStrArray(d.responsibilities) ? d.responsibilities : [],
    requirements: isStrArray(d.requirements) ? d.requirements : [],
    niceToHave: isStrArray(d.niceToHave) ? d.niceToHave : [],
    benefits: isStrArray(d.benefits) ? d.benefits : [],
    details: isStrArray(d.details) ? d.details : [],
  };
}

function BulletSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginTop: 20 }}>
      <h3 style={{ margin: "0 0 10px", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--ink)" }}>
        {title}
      </h3>
      <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((item, i) => (
          <li key={i} style={{ color: "var(--ink)", fontSize: 14.5, lineHeight: 1.6 }}>
            {linkifyText(item)}
          </li>
        ))}
      </ul>
    </div>
  );
}

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

  // Already cached (a previous viewer triggered the LLM call) — render
  // instantly, no fetch needed. Only the first-ever viewer of a job pays
  // the ~30-90s LLM latency; every viewer after that gets this for free.
  // No loading indicator shown for this — it just swaps in silently
  // whenever it resolves, same as it would on a page refresh.
  useEffect(() => {
    if (formatted || !description) return;
    let cancelled = false;
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

  const structured = formatted ? parseStructured(formatted) : null;

  return (
    <div style={{ marginTop: 26, paddingTop: 22, borderTop: "1px solid var(--line)" }}>
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

      {structured ? (
        <div>
          {structured.overview && (
            <div style={{ lineHeight: 1.7, whiteSpace: "pre-wrap", overflowWrap: "break-word", color: "var(--ink)", fontSize: 14.5 }}>
              {linkifyText(structured.overview)}
            </div>
          )}
          <BulletSection title={SECTION_LABELS.responsibilities} items={structured.responsibilities} />
          <BulletSection title={SECTION_LABELS.requirements} items={structured.requirements} />
          <BulletSection title={SECTION_LABELS.niceToHave} items={structured.niceToHave} />
          <BulletSection title={SECTION_LABELS.benefits} items={structured.benefits} />
          <BulletSection title={SECTION_LABELS.details} items={structured.details} />
        </div>
      ) : (
        // Plain text: either a pre-existing (old-format) cached row, or the
        // deterministic-only fallback (empty-label lines stripped, but no
        // LLM categorization — see job_formatter.py's `fallback` return).
        <div style={{ lineHeight: 1.7, whiteSpace: "pre-wrap", overflowWrap: "break-word", color: "var(--ink)", fontSize: 14.5 }}>
          {linkifyText(formatted ?? description)}
        </div>
      )}
    </div>
  );
}
