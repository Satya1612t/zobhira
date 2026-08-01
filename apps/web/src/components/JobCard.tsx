"use client";

import { useState } from "react";
import Link from "next/link";
import type { JobListItem } from "@/lib/jobQuery";
import { CompanyLogo } from "./CompanyLogo";
import { useToast } from "@/components/ui/Toast";

// IST calendar date (YYYY-MM-DD), not raw elapsed time — so "today" lines
// up with the same IST-day boundary the rest of the app uses (see the
// dispatch route's same-day logic), instead of drifting on a UTC midnight.
function istDateKey(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

// Same IST calendar day as now: "Today" if under an hour old, otherwise
// "{h}h ago". Any earlier day: the actual date, not a day count — a job
// posted "3d ago" reads worse than just seeing "Jul 29".
function relativePostedTime(date: Date): string {
  if (istDateKey(date) !== istDateKey(new Date())) {
    return date.toLocaleDateString("en-US", { timeZone: "Asia/Kolkata", month: "short", day: "numeric", year: "numeric" });
  }
  const hours = Math.max(0, Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60)));
  return hours < 1 ? "Today" : `${hours}h ago`;
}

// Every card gets the same total height regardless of how much optional
// content a given job actually has (tags) — each row below reserves its
// own fixed height and clips overflow rather than growing/shrinking the
// card, so a dense listing page reads as a uniform grid instead of a
// ragged one.
const TAGS_ROW_HEIGHT = 26;
const META_ROW_HEIGHT = 20;

export function JobCard({ job }: { job: JobListItem }) {
  // Real, DB-persisted skill/designation tags (services/scraper/utils/
  // skill_tagger.py) — same "Skill Required" data the detail page shows, not the
  // narrow hardcoded tech-keyword regex scan extractTechnologies() does.
  const topTags = job.tags.slice(0, 4);
  const overflowCount = Math.max(0, job.tags.length - 4);
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
          {topTags.map((tag) => (
            <span key={tag} className="tag tag-outline">
              {tag}
            </span>
          ))}
          {overflowCount > 0 && <span className="tag tag-neutral">+{overflowCount}</span>}
        </div>

        <div className="job-card-footer" style={{ marginTop: 14, height: META_ROW_HEIGHT }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--color-text-muted)" }}>
            {/* Some sources (YCombinator) never provide a real posted date —
                fall back to our own scrape date (firstSeenAt), formatted
                exactly the same way, rather than showing nothing. */}
            PostedAt - {relativePostedTime(job.postedAt ?? job.firstSeenAt)}
          </span>
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
