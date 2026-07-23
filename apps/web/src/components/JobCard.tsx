"use client";

import { useState } from "react";
import Link from "next/link";
import type { JobListItem } from "@/lib/jobQuery";
import { CompanyLogo } from "./CompanyLogo";
import { extractTechnologies } from "@/lib/jobInsights";

function formatSalary(job: {
  salaryMin: unknown;
  salaryMax: unknown;
  salaryCurrency: string | null;
}): string | null {
  if (!job.salaryMin && !job.salaryMax) return null;
  const currency = job.salaryCurrency ?? "";
  const min = job.salaryMin?.toString();
  const max = job.salaryMax?.toString();
  if (min && max) return `${currency} ${min} - ${max}`;
  return `${currency} ${min ?? max}`;
}

export function JobCard({ job }: { job: JobListItem }) {
  const salary = formatSalary(job);
  const topTechnologies = extractTechnologies(job.description, 3);
  // Cosmetic only — no backend to persist this yet (see /DESIGN.md).
  const [saved, setSaved] = useState(false);

  return (
    <div className="card" style={{ marginBottom: 14, position: "relative" }}>
      <button
        type="button"
        aria-label={saved ? "Unsave" : "Save"}
        onClick={(e) => {
          e.preventDefault();
          setSaved((v) => !v);
        }}
        style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", cursor: "pointer", color: saved ? "var(--color-accent)" : "var(--ink-faint)", padding: 2 }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21 12 16l-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      </button>
      <Link href={`/jobs/${job.id}`} style={{ textDecoration: "none", color: "inherit" }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", minWidth: 0 }}>
          <CompanyLogo logoUrl={job.logoUrl} company={job.company} size={48} />
          <div style={{ minWidth: 0 }}>
            <div className="card-title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {job.title}
            </div>
            <div style={{ color: "var(--ink-muted)", marginTop: 4, fontSize: 13.5 }}>{job.company}</div>
          </div>
        </div>

        {topTechnologies.length > 0 && (
          <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {topTechnologies.map((tech) => (
              <span key={tech} className="tag tag-outline">
                {tech}
              </span>
            ))}
          </div>
        )}

        <div className="card-meta" style={{ marginTop: 14, flexWrap: "wrap" }}>
          <span>{job.location ?? "Location unknown"}</span>
          {job.workplaceType !== "unknown" && <span>· {job.workplaceType}</span>}
          {salary && <span>· {salary}</span>}
          {job.postedAt && <span>· posted {job.postedAt.toLocaleDateString("en-US")}</span>}
          {job.deadlineAt && (
            <span style={{ color: "var(--warn)" }}>· apply by {job.deadlineAt.toLocaleDateString("en-US")}</span>
          )}
        </div>
      </Link>
    </div>
  );
}
