"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ANY_LOCATION, ALL_TIME } from "@/lib/jobQuery";

// Styled after the Stitch "Jobs - HireAuthority" mockup's left filter
// sidebar + top search/sort bar — but every field here is one of this
// app's real, already-working filters (see lib/jobQuery.ts::buildJobsWhere)
// rather than the mockup's decorative industry/salary-slider placeholders.
// Scoped to /jobs only. The plain `.jobs-layout` CSS this file doesn't use
// is dead now too — /live moved to a timeline layout (Prompt 07) and no
// longer renders a two-column search+results page.
//
// HARD RULE (see 04-jobs-listing.md): every <input>/<select> name/value
// below is unchanged from before this redesign pass — only markup/CSS
// changed. jobQuery.ts's buildJobsWhere is the single source of truth for
// filter behavior and isn't touched here.

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
  padding: "9px 10px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-divider)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  fontFamily: "var(--font-body)",
  fontSize: 13,
  width: "100%",
};

function FilterLabel({ children }: { children: ReactNode }) {
  return <span className="jobs-filter-label">{children}</span>;
}

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="jobs-filter-section" open>
      <summary className="jobs-filter-summary">
        <FilterLabel>{title}</FilterLabel>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="jobs-filter-chevron">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div style={{ marginTop: 8 }}>{children}</div>
    </details>
  );
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

// Builds a query string equal to every currently-active filter EXCEPT the
// one being removed — a real <a>, not client JS, so removing a filter chip
// still goes through the exact same server-rendered GET request path.
function hrefWithout(action: string, current: Record<string, string | undefined>, omitKey: string): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (key === omitKey || !value) continue;
    params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${action}?${qs}` : action;
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
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    if (!mobileFiltersOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileFiltersOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [mobileFiltersOpen]);

  const currentParams = {
    q, location, workplaceType,
    postedWithin: postedWithin && postedWithin !== "week" ? postedWithin : undefined,
    sort: sort && sort !== "newest" ? sort : undefined,
    experienceLevel, company, tags, employmentType,
    hasSalary: hasSalary === "true" ? "true" : undefined,
    salaryMin,
  };
  const activeChips = Object.entries(currentParams)
    .filter(([, v]) => Boolean(v))
    .map(([key, value]) => ({ key, value: value as string }));
  const hasAnyFilter = activeChips.length > 0;

  return (
    <form method="get" action={action}>
      {/* Top bar: keyword search + sort */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", gap: 8, flex: "1 1 260px", minWidth: 200 }}>
          <div className="jobs-search-input-wrap" style={{ flex: 1 }}>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              className="jobs-search-input-icon"
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
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ flexShrink: 0, borderRadius: "var(--radius-full)" }}>
            Search
          </button>
          <button
            type="button"
            className="btn btn-secondary jobs-mobile-filter-btn"
            onClick={() => setMobileFiltersOpen(true)}
          >
            Filters{hasAnyFilter ? ` (${activeChips.length})` : ""}
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 12.5, color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>Sort by:</span>
          <select name="sort" defaultValue={sort ?? "newest"} style={{ ...fieldStyle, width: "auto" }}>
            <option value="newest">Best match</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </div>

      {hasAnyFilter && (
        <div className="cluster" style={{ marginBottom: 16 }}>
          {activeChips.map(({ key, value }) => (
            <a key={key} href={hrefWithout(action, currentParams, key)} className="filter-chip">
              {value}
              <span aria-hidden="true">&times;</span>
            </a>
          ))}
          <a href={action} style={{ fontSize: 12.5, color: "var(--color-text-muted)", fontWeight: 600, textDecoration: "none" }}>
            Clear all
          </a>
        </div>
      )}

      <div className="jobs-filter-layout">
        <div className={`jobs-filter-backdrop${mobileFiltersOpen ? " jobs-filter-backdrop-open" : ""}`} onClick={() => setMobileFiltersOpen(false)} />
        <aside className={`jobs-filter-sidebar${mobileFiltersOpen ? " jobs-filter-sheet-open" : ""}`}>
          <div className="jobs-filter-sheet-handle" />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--color-text)" }}>
              Filters
            </span>
            {hasAnyFilter && (
              <a href={action} style={{ fontSize: 12, color: "var(--color-accent)", fontWeight: 600, textDecoration: "none" }}>
                Clear all
              </a>
            )}
          </div>

          <div className="jobs-filter-scroll">
            <FilterSection title="Location">
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
            </FilterSection>

            <FilterSection title="Workplace type">
              <PillGroup name="workplaceType" options={WORKPLACE_TYPES} value={workplaceType} />
            </FilterSection>

            <FilterSection title="Posted within">
              <select name="postedWithin" defaultValue={postedWithin ?? "week"} style={fieldStyle}>
                <option value="24h">Past 24 hours</option>
                <option value="week">Past week</option>
                <option value="month">Past month</option>
                <option value={ALL_TIME}>All time</option>
              </select>
            </FilterSection>

            <FilterSection title="Experience level">
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {EXPERIENCE_LEVELS.map((opt) => (
                  <label key={opt.value || "any"} className="jobs-filter-check">
                    <input
                      type="radio"
                      name="experienceLevel"
                      value={opt.value}
                      defaultChecked={(experienceLevel ?? "") === opt.value}
                    />
                    <span className="jobs-filter-check-box" aria-hidden="true" />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </FilterSection>

            <FilterSection title="Employment type">
              <PillGroup name="employmentType" options={EMPLOYMENT_TYPES} value={employmentType} />
            </FilterSection>

            <FilterSection title="Company">
              <input type="text" name="company" placeholder="e.g. Google" defaultValue={company} style={fieldStyle} />
            </FilterSection>

            <FilterSection title="Skills">
              <input
                type="text" name="tags" placeholder="python, react…" defaultValue={tags}
                style={fieldStyle}
              />
            </FilterSection>

            <FilterSection title="Salary (min, annual)">
              <input
                type="number" name="salaryMin" placeholder="e.g. 1200000" defaultValue={salaryMin} min={0}
                style={fieldStyle}
              />
              <label className="jobs-filter-check" style={{ marginTop: 10 }}>
                <input type="checkbox" name="hasSalary" value="true" defaultChecked={hasSalary === "true"} />
                <span className="jobs-filter-check-box jobs-filter-check-box--square" aria-hidden="true" />
                <span>Salary disclosed only</span>
              </label>
            </FilterSection>
          </div>

          <div className="jobs-filter-footer">
            <button type="submit" className="btn btn-primary" style={{ width: "100%" }} onClick={() => setMobileFiltersOpen(false)}>
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
