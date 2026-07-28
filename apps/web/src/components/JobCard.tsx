"use client";

import { useState } from "react";
import Link from "next/link";
import type { JobListItem } from "@/lib/jobQuery";
import { CompanyLogo } from "./CompanyLogo";
import { extractTechnologies } from "@/lib/jobInsights";
import { useToast } from "@/components/ui/Toast";

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

function daysAgo(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

// Every card gets the same total height regardless of how much optional
// content a given job actually has (tags, salary, deadline) — each row
// below reserves its own fixed height and clips overflow rather than
// growing/shrinking the card, so a dense listing page reads as a uniform
// grid instead of a ragged one.
const TAGS_ROW_HEIGHT = 26;
const META_ROW_HEIGHT = 20;

export function JobCard({ job }: { job: JobListItem }) {
  const salary = formatSalary(job);
  const topTechnologies = extractTechnologies(job.description, 4);
  const overflowCount = Math.max(0, extractTechnologies(job.description, 99).length - 4);
  // Cosmetic only — no backend to persist this yet (see /DESIGN.md). The
  // toast is real feedback even though the save itself isn't persisted.
  const [saved, setSaved] = useState(false);
  const showToast = useToast();

  return (
    <div className="job-card" style={{ marginBottom: 14, position: "relative" }}>
      <button
        type="button"
        aria-label={saved ? "Unsave" : "Save"}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setSaved((v) => {
            showToast(v ? "Removed from saved roles" : "Saved to your roles", "success");
            return !v;
          });
        }}
        className="job-card-save-btn"
        style={{ color: saved ? "var(--color-accent)" : "var(--color-text-muted)" }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21 12 16l-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      </button>
      <Link href={`/jobs/${job.id}`} style={{ textDecoration: "none", color: "inherit" }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", minWidth: 0 }}>
          <div className="job-card-logo-tile">
            <CompanyLogo logoUrl={job.logoUrl} company={job.company} size={48} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: "var(--text-lg)",
                lineHeight: 1.25,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: "var(--color-text)",
              }}
            >
              {job.title}
            </div>
            <div
              style={{
                color: "var(--color-text-muted)",
                marginTop: 4,
                fontSize: 13.5,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {job.company}
              {job.location && <span> &middot; {job.location}</span>}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12, height: TAGS_ROW_HEIGHT, overflow: "hidden", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {topTechnologies.map((tech) => (
            <span key={tech} className="tag tag-outline">
              {tech}
            </span>
          ))}
          {overflowCount > 0 && <span className="tag tag-neutral">+{overflowCount}</span>}
          {job.workplaceType !== "unknown" && <span className="tag tag-accent" style={{ textTransform: "capitalize" }}>{job.workplaceType}</span>}
          {salary && <span className="tag tag-neutral">{salary}</span>}
        </div>

        <div className="job-card-footer" style={{ marginTop: 14, height: META_ROW_HEIGHT }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--color-text-muted)" }}>
            {job.postedAt ? daysAgo(job.postedAt) : ""}
          </span>
          {job.deadlineAt && (
            <span style={{ fontSize: 12, color: "var(--color-error)" }}>
              Apply by {job.deadlineAt.toLocaleDateString("en-US", { timeZone: "Asia/Kolkata" })}
            </span>
          )}
          <span className="job-card-arrow" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </div>
      </Link>
    </div>
  );
}
