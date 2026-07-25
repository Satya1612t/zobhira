"use client";

import { useState } from "react";
import { ANY_LOCATION, ALL_TIME } from "@/lib/jobQuery";

const CITIES = ["Bangalore", "Mumbai", "Delhi NCR", "Pune", "Hyderabad", "Chennai", "Kolkata", "Remote"];
const EMPLOYMENT_TYPES = [
  { value: "Fulltime", label: "Full-time" },
  { value: "Parttime", label: "Part-time" },
  { value: "Contract", label: "Contract" },
  { value: "Internship", label: "Internship" },
  { value: "Intern", label: "Intern" },
];

const fieldStyle: React.CSSProperties = {
  padding: "9px 10px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--line)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontFamily: "var(--font-body)",
  fontSize: 13,
  flexShrink: 0,
};

const checkboxLabelStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 13,
  color: "var(--ink)",
  fontFamily: "var(--font-body)",
  padding: "9px 10px",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
  cursor: "pointer",
  flexShrink: 0,
  whiteSpace: "nowrap",
};

export function SearchBar({
  q,
  location,
  workplaceType,
  postedWithin,
  sort,
  experienceLevel,
  company,
  tags,
  employmentType,
  source,
  hasSalary,
  salaryMin,
  hideIncomplete,
  action = "/",
  showPostedWithin = true,
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
  source?: string | string[];
  hasSalary?: string;
  salaryMin?: string;
  hideIncomplete?: string;
  action?: string;
  showPostedWithin?: boolean;
}) {
  const sourceList = Array.isArray(source) ? source : source ? [source] : [];
  const hasAdvancedFilter = Boolean(
    company || tags || employmentType || sourceList.length || hasSalary === "true" || salaryMin || hideIncomplete === "true"
  );
  const hasAnyFilter = Boolean(
    q ||
      location ||
      workplaceType ||
      (postedWithin && postedWithin !== "week") ||
      experienceLevel ||
      (sort && sort !== "newest") ||
      hasAdvancedFilter
  );
  const isPresetCity = location ? CITIES.includes(location) : false;
  const isAnyLocation = location === ANY_LOCATION;
  const [locationMode, setLocationMode] = useState<"preset" | "other">(
    location && !isPresetCity && !isAnyLocation ? "other" : "preset"
  );

  return (
    <form
      method="get"
      action={action}
      style={{ marginBottom: 16 }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "nowrap",
          overflowX: "auto",
          paddingBottom: 2,
        }}
      >
        <input
          type="text"
          name="q"
          placeholder="Title or keyword"
          defaultValue={q}
          style={{ ...fieldStyle, flex: "1 1 140px", minWidth: 120 }}
        />

        <select
          defaultValue={isPresetCity ? location : isAnyLocation ? ANY_LOCATION : ""}
          name={locationMode === "other" ? undefined : "location"}
          onChange={(e) => setLocationMode(e.target.value === "Other" ? "other" : "preset")}
          style={fieldStyle}
        >
          <option value="">India (all cities)</option>
          {CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
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
            style={{ ...fieldStyle, flex: "1 1 120px", minWidth: 100 }}
          />
        )}

        <select name="workplaceType" defaultValue={workplaceType ?? ""} style={fieldStyle}>
          <option value="">Any workplace type</option>
          <option value="remote">Remote</option>
          <option value="hybrid">Hybrid</option>
          <option value="onsite">Onsite</option>
        </select>

        {showPostedWithin && (
          <select name="postedWithin" defaultValue={postedWithin ?? "week"} style={fieldStyle}>
            <option value="24h">Past 24 hours</option>
            <option value="week">Past week</option>
            <option value="month">Past month</option>
            <option value={ALL_TIME}>All time</option>
          </select>
        )}

        <select name="experienceLevel" defaultValue={experienceLevel ?? ""} style={fieldStyle}>
          <option value="">Any experience</option>
          <option value="fresher">Fresher</option>
          <option value="1+">1+ years</option>
          <option value="2+">2+ years</option>
          <option value="3+">3+ years</option>
          <option value="5+">5+ years</option>
        </select>

        <select name="sort" defaultValue={sort ?? "newest"} style={fieldStyle}>
          <option value="newest">Best match</option>
          <option value="oldest">Oldest first</option>
        </select>

        <button
          type="submit"
          style={{
            padding: "9px 18px",
            borderRadius: "var(--radius-sm)",
            border: "none",
            background: "var(--accent)",
            color: "var(--accent-ink)",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          Search
        </button>

        {hasAnyFilter && (
          <a
            href={action}
            style={{
              padding: "9px 14px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--line)",
              background: "var(--surface)",
              color: "var(--ink-muted)",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              flexShrink: 0,
              whiteSpace: "nowrap",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Reset
          </a>
        )}
      </div>

      <details open={hasAdvancedFilter} style={{ marginTop: 10 }}>
        <summary
          style={{
            cursor: "pointer",
            fontSize: 12.5,
            fontWeight: 600,
            color: "var(--ink-muted)",
            userSelect: "none",
          }}
        >
          More filters{hasAdvancedFilter ? " (active)" : ""}
        </summary>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginTop: 10,
          }}
        >
          <input
            type="text"
            name="company"
            placeholder="Company"
            defaultValue={company}
            style={{ ...fieldStyle, flex: "1 1 140px", minWidth: 120 }}
          />

          <input
            type="text"
            name="tags"
            placeholder="Skills (comma-separated, e.g. python, react)"
            defaultValue={tags}
            style={{ ...fieldStyle, flex: "1 1 220px", minWidth: 180 }}
          />

          <select name="employmentType" defaultValue={employmentType ?? ""} style={fieldStyle}>
            <option value="">Any employment type</option>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <input
            type="number"
            name="salaryMin"
            placeholder="Min salary"
            defaultValue={salaryMin}
            min={0}
            style={{ ...fieldStyle, width: 110 }}
          />

          <label style={checkboxLabelStyle}>
            <input type="checkbox" name="hasSalary" value="true" defaultChecked={hasSalary === "true"} />
            Salary disclosed
          </label>

          {/* "Hide incomplete listings" and the per-source checkboxes were
              removed from this UI — still supported as URL params
              (hideIncomplete/source) for any existing bookmarked/shared
              links, just no longer exposed as filter controls here. */}
        </div>
      </details>
    </form>
  );
}
