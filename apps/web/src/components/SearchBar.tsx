"use client";

import { useState } from "react";
import { ANY_LOCATION } from "@/lib/jobQuery";

const CITIES = ["Bangalore", "Mumbai", "Delhi NCR", "Pune", "Hyderabad", "Chennai", "Kolkata", "Remote"];

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

export function SearchBar({
  q,
  location,
  workplaceType,
  postedWithin,
  sort,
  experienceLevel,
  action = "/",
  showPostedWithin = true,
}: {
  q?: string;
  location?: string;
  workplaceType?: string;
  postedWithin?: string;
  sort?: string;
  experienceLevel?: string;
  action?: string;
  showPostedWithin?: boolean;
}) {
  const hasAnyFilter = Boolean(
    q || location || workplaceType || postedWithin || experienceLevel || (sort && sort !== "newest")
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
      style={{
        display: "flex",
        gap: 8,
        marginBottom: 16,
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
        <select name="postedWithin" defaultValue={postedWithin ?? ""} style={fieldStyle}>
          <option value="">Any time</option>
          <option value="24h">Past 24 hours</option>
          <option value="week">Past week</option>
          <option value="month">Past month</option>
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
        <option value="newest">Newest first</option>
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
    </form>
  );
}
