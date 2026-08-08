"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";
import { useToast } from "@/components/Toast";

type ScraperSource = {
  name: string;
  family: string;
  enabled: boolean;
  lastError: string | null;
  lastErrorAt: string | null;
};

// Human labels + which bucket each source belongs to, so the flat DB list
// (raw machine names like "smartrecruiters"/"dev_community") reads clearly.
// Order of CATEGORY_ORDER is the display order of the groups.
const CATEGORY_ORDER = ["ATS feed", "Aggregator", "Legacy scraper", "Contest"] as const;
type Category = (typeof CATEGORY_ORDER)[number];

const SOURCE_META: Record<string, { label: string; category: Category }> = {
  greenhouse: { label: "Greenhouse", category: "ATS feed" },
  lever: { label: "Lever", category: "ATS feed" },
  ashby: { label: "Ashby", category: "ATS feed" },
  smartrecruiters: { label: "SmartRecruiters", category: "ATS feed" },
  workable: { label: "Workable", category: "ATS feed" },
  recruitee: { label: "Recruitee", category: "ATS feed" },
  adzuna: { label: "Adzuna", category: "Aggregator" },
  jooble: { label: "Jooble", category: "Aggregator" },
  careerjet: { label: "Careerjet", category: "Aggregator" },
  himalayas: { label: "Himalayas", category: "Legacy scraper" },
  dev_community: { label: "DEV Community", category: "Contest" },
};

function metaFor(source: ScraperSource): { label: string; category: Category } {
  // Fallback for any source not in the map yet (e.g. a newly registered
  // provider) — show its raw name, bucket by family.
  return SOURCE_META[source.name] ?? {
    label: source.name,
    category: source.family === "contest" ? "Contest" : "Legacy scraper",
  };
}

export function AdminSourcesTable() {
  const { showToast } = useToast();
  const [sources, setSources] = useState<ScraperSource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch("/api/sources")
      .then((res) => res.json())
      .then((data: { sources: ScraperSource[] }) => setSources(data.sources))
      .finally(() => setLoading(false));
  }, []);

  async function toggleEnabled(source: ScraperSource) {
    const next = !source.enabled;
    setSources((prev) => prev.map((s) => (s.name === source.name ? { ...s, enabled: next } : s)));
    try {
      const res = await adminFetch(`/api/sources/${source.name}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error();
      showToast(`${source.name} ${next ? "enabled" : "disabled"}.`, "success");
    } catch {
      setSources((prev) => prev.map((s) => (s.name === source.name ? { ...s, enabled: !next } : s)));
      showToast(`Couldn't update "${source.name}". Try again.`, "error");
    }
  }

  if (loading) return null;

  // Group sources by category, in CATEGORY_ORDER; within a group, sort by label.
  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: sources
      .filter((s) => metaFor(s).category === category)
      .sort((a, b) => metaFor(a).label.localeCompare(metaFor(b).label)),
  })).filter((g) => g.items.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {grouped.map(({ category, items }) => (
        <div key={category}>
          <h3
            style={{
              margin: "0 0 8px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
            }}
          >
            {category}
            <span style={{ marginLeft: 8, color: "var(--ink-faint)", fontWeight: 600 }}>{items.length}</span>
          </h3>
          <div
            style={{
              borderRadius: "var(--radius)",
              border: "1px solid var(--line)",
              background: "var(--surface)",
              overflow: "hidden",
            }}
          >
            {items.map((source) => {
              const { label } = metaFor(source);
              return (
                <div
                  key={source.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>{label}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-faint)" }}>
                        {source.name}
                      </span>
                    </div>
                    {source.lastError && (
                      <div style={{ marginTop: 6, fontSize: 12, color: "var(--warn)" }}>
                        {source.lastError}
                        {source.lastErrorAt && (
                          <span style={{ color: "var(--ink-faint)" }}>
                            {" "}
                            · {new Date(source.lastErrorAt).toLocaleString("en-US")}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => toggleEnabled(source)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--line)",
                      background: source.enabled ? "var(--accent)" : "var(--surface-hover)",
                      color: source.enabled ? "var(--accent-ink)" : "var(--ink-faint)",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    {source.enabled ? "Enabled" : "Disabled"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
