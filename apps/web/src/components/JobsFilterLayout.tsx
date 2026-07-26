"use client";

import { useState, type ReactNode } from "react";
import { ANY_LOCATION, ALL_TIME } from "@/lib/jobQuery";

// Styled after the Stitch "Jobs - HireAuthority" mockup's left filter
// sidebar + top search/sort bar — but every field here is one of this
// app's real, already-working filters (see lib/jobQuery.ts::buildJobsWhere)
// rather than the mockup's decorative industry/salary-slider placeholders.
// Scoped to /jobs only: SearchBar.tsx and the plain `.jobs-layout` CSS
// (both still used by /live) are untouched.

const CITIES = ["Bangalore", "Mumbai", "Delhi NCR", "Pune", "Hyderabad", "Chennai", "Kolkata", "Remote"];
const WORKPLACE_TYPES = [
  { value: "", label: "Any" },
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "Onsite" },
];
const EMPLOYMENT_TYPES = [
  { value: "", label: "Any" },
  { value: "Fulltime", label: "Full-time" },
  { value: "Parttime", label: "Part-time" },
  { value: "Contract", label: "Contract" },
  { value: "Internship", label: "Internship" },
  { value: "Intern", label: "Intern" },
];
const EXPERIENCE_LEVELS = [
  { value: "", label: "Any" },
  { value: "fresher", label: "Fresher" },
  { value: "1+", label: "1+ years" },
  { value: "2+", label: "2+ years" },
  { value: "3+", label: "3+ years" },
  { value: "5+", label: "5+ years" },
];

const fieldStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--line)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontFamily: "var(--font-body)",
  fontSize: 13,
  width: "100%",
};

function FilterLabel({ children }: { children: ReactNode }) {
  return <span className="jobs-filter-label">{children}</span>;
}

function PillGroup({
  name,
  options,
  value,
}: {
  name: string;
  options: { value: string; label: string }[];
  value?: string;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map((opt) => (
        <label key={opt.value || "any"} className="jobs-pill">
          <input type="radio" name={name} value={opt.value} defaultChecked={(value ?? "") === opt.value} />
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

export function JobsFilterLayout({
  q,
  location,
  workplaceType,
  postedWithin,
  sort,
  experienceLevel,
  company,
  tags,
  employmentType,
  hasSalary,
  salaryMin,
  action = "/jobs",
  streamsPanel,
  children,
}: {
  q?: string;
  location?: string;
  workplaceType?: string;
  postedWithin?: string;
  sort?: string;
  experienceLevel?: string;
  company?: string;
  tags?: string;
  employmentType?: string;
  hasSalary?: string;
  salaryMin?: string;
  action?: string;
  streamsPanel: ReactNode;
  children: ReactNode;
}) {
  const isPresetCity = location ? CITIES.includes(location) : false;
  const isAnyLocation = location === ANY_LOCATION;
  const [locationMode, setLocationMode] = useState<"preset" | "other">(
    location && !isPresetCity && !isAnyLocation ? "other" : "preset"
  );

  const hasAnyFilter = Boolean(
    q || location || workplaceType || (postedWithin && postedWithin !== "week") ||
      experienceLevel || (sort && sort !== "newest") || company || tags ||
      employmentType || hasSalary === "true" || salaryMin
  );

  return (
    <form method="get" action={action}>
      {/* Top bar: keyword search + sort — same as Stitch's "Search & Sort
          Header", positioned above the middle column rather than the
          sidebar since it's the primary, most-used control. */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", gap: 8, flex: "1 1 260px", minWidth: 200 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ink-faint)" }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              name="q"
              placeholder="Search job titles, companies, or keywords…"
              defaultValue={q}
              className="jobs-search-input"
              style={{ ...fieldStyle, padding: "13px 10px 13px 32px", border: "1px solid var(--ink)" }}
            />
          </div>
          <button
            type="submit"
            style={{
              padding: "0 40px", borderRadius: "var(--radius-sm)", border: "none",
              background: "var(--accent)", color: "var(--accent-ink)", fontWeight: 600,
              fontSize: 12.5, cursor: "pointer", flexShrink: 0,
            }}
          >
            Search
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 12.5, color: "var(--ink-faint)", whiteSpace: "nowrap" }}>Sort by:</span>
          <select name="sort" defaultValue={sort ?? "newest"} style={{ ...fieldStyle, width: "auto" }}>
            <option value="newest">Best match</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </div>

      <div className="jobs-filter-layout">
        <aside className="jobs-filter-sidebar">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--ink)" }}>
              Filters
            </span>
            {hasAnyFilter && (
              <a href={action} style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
                Clear all
              </a>
            )}
          </div>

          <div className="jobs-filter-scroll">
          <div className="jobs-filter-section" style={{ paddingTop: 0, borderTop: "none" }}>
            <FilterLabel>Location</FilterLabel>
            <select
              defaultValue={isPresetCity ? location : isAnyLocation ? ANY_LOCATION : ""}
              name={locationMode === "other" ? undefined : "location"}
              onChange={(e) => setLocationMode(e.target.value === "Other" ? "other" : "preset")}
              style={fieldStyle}
            >
              <option value="">India (all cities)</option>
              {CITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value={ANY_LOCATION}>Any location (worldwide)</option>
              <option value="Other">Other…</option>
            </select>
            {locationMode === "other" && (
              <input
                type="text"
                name="location"
                placeholder="City or place"
                defaultValue={isPresetCity || isAnyLocation ? "" : location}
                style={{ ...fieldStyle, marginTop: 6 }}
              />
            )}
          </div>

          <div className="jobs-filter-section">
            <FilterLabel>Workplace type</FilterLabel>
            <PillGroup name="workplaceType" options={WORKPLACE_TYPES} value={workplaceType} />
          </div>

          <div className="jobs-filter-section">
            <FilterLabel>Posted within</FilterLabel>
            <select name="postedWithin" defaultValue={postedWithin ?? "week"} style={fieldStyle}>
              <option value="24h">Past 24 hours</option>
              <option value="week">Past week</option>
              <option value="month">Past month</option>
              <option value={ALL_TIME}>All time</option>
            </select>
          </div>

          <div className="jobs-filter-section">
            <FilterLabel>Experience level</FilterLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {EXPERIENCE_LEVELS.map((opt) => (
                <label key={opt.value || "any"} className="jobs-filter-check">
                  <input
                    type="radio"
                    name="experienceLevel"
                    value={opt.value}
                    defaultChecked={(experienceLevel ?? "") === opt.value}
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="jobs-filter-section">
            <FilterLabel>Employment type</FilterLabel>
            <PillGroup name="employmentType" options={EMPLOYMENT_TYPES} value={employmentType} />
          </div>

          <div className="jobs-filter-section">
            <FilterLabel>Company</FilterLabel>
            <input type="text" name="company" placeholder="e.g. Google" defaultValue={company} style={fieldStyle} />
          </div>

          <div className="jobs-filter-section">
            <FilterLabel>Skills</FilterLabel>
            <input
              type="text" name="tags" placeholder="python, react…" defaultValue={tags}
              style={fieldStyle}
            />
          </div>

          <div className="jobs-filter-section">
            <FilterLabel>Salary (min, annual)</FilterLabel>
            <input
              type="number" name="salaryMin" placeholder="e.g. 1200000" defaultValue={salaryMin} min={0}
              style={fieldStyle}
            />
            <label className="jobs-filter-check" style={{ marginTop: 8 }}>
              <input type="checkbox" name="hasSalary" value="true" defaultChecked={hasSalary === "true"} />
              <span>Salary disclosed only</span>
            </label>
          </div>
          </div>

          <div
            style={{
              flexShrink: 0,
              marginTop: 4,
              paddingTop: 10,
              borderTop: "1px solid var(--line)",
            }}
          >
            <button
              type="submit"
              style={{
                width: "100%", padding: "9px 0", borderRadius: "var(--radius-sm)", border: "none",
                background: "var(--accent)", color: "var(--accent-ink)", fontWeight: 600, fontSize: 13,
                cursor: "pointer",
              }}
            >
              Apply filters
            </button>
          </div>
        </aside>

        <div>{children}</div>

        <div className="jobs-streams-panel-compact">{streamsPanel}</div>
      </div>
    </form>
  );
}
