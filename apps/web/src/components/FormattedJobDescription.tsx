"use client";

import { useEffect, useRef, useState } from "react";
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
    <div className="job-desc-section">
      <h3 className="job-desc-heading">{title}</h3>
      <ul className="job-desc-list">
        {items.map((item, i) => (
          <li key={i}>{linkifyText(item)}</li>
        ))}
      </ul>
    </div>
  );
}

export function FormattedJobDescription({
  jobId,
  description,
  formattedDescription,
}: {
  jobId: string;
  description: string | null;
  formattedDescription: string | null;
}) {
  const [formatted, setFormatted] = useState(formattedDescription);
  const [justSwapped, setJustSwapped] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isLong, setIsLong] = useState(false);

  // Already cached (a previous viewer triggered the LLM call) — render
  // instantly, no fetch needed. Only the first-ever viewer of a job pays
  // the ~30-90s LLM latency; every viewer after that gets this for free.
  useEffect(() => {
    if (formatted || !description) return;
    let cancelled = false;
    fetch(`/api/jobs/${jobId}/format-description`, { method: "POST" })
      .then((res) => res.json())
      .then((data: { formatted_description?: string }) => {
        if (cancelled) return;
        if (data.formatted_description) {
          setFormatted(data.formatted_description);
          setJustSwapped(true);
        }
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

  useEffect(() => {
    setIsLong((contentRef.current?.scrollHeight ?? 0) > 900);
  }, [formatted, description]);

  if (!description) {
    return (
      <div style={{ marginTop: 26, paddingTop: 22, borderTop: "1px solid var(--line)", color: "var(--ink-faint)", fontSize: 14 }}>
        No description available yet. See the original posting for full details.
      </div>
    );
  }

  const structured = formatted ? parseStructured(formatted) : null;

  return (
    <div style={{ marginTop: 26, paddingTop: 22, borderTop: "1px solid var(--line)" }}>
      {!formatted && (
        <p className="job-desc-formatting-note">
          Formatting this description
          <span className="job-desc-dots"><span>.</span><span>.</span><span>.</span></span>
        </p>
      )}

      <div className={`job-desc-collapse${!expanded && isLong ? " job-desc-collapse--closed" : ""}`}>
        <div ref={contentRef} className={`job-desc-prose${justSwapped ? " job-desc-cross-fade" : ""}`}>
          {structured ? (
            <div>
              {structured.overview && <p>{linkifyText(structured.overview)}</p>}
              <BulletSection title={SECTION_LABELS.responsibilities} items={structured.responsibilities} />
              <BulletSection title={SECTION_LABELS.requirements} items={structured.requirements} />
              <BulletSection title={SECTION_LABELS.niceToHave} items={structured.niceToHave} />
              <BulletSection title={SECTION_LABELS.benefits} items={structured.benefits} />
              <BulletSection title={SECTION_LABELS.details} items={structured.details} />
            </div>
          ) : (
            <p style={{ whiteSpace: "pre-wrap", overflowWrap: "break-word" }}>{linkifyText(formatted ?? description)}</p>
          )}
        </div>
        {!expanded && isLong && <div className="job-desc-fade-mask mask-fade-b" />}
      </div>
      {isLong && (
        <button type="button" className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show less" : "Read full description"}
        </button>
      )}
    </div>
  );
}
