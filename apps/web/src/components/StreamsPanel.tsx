import Link from "next/link";
import { STREAMS } from "@/lib/streams";

function sectionLabelStyle(compact: boolean): React.CSSProperties {
  return {
    display: "block",
    fontFamily: "var(--font-mono)",
    fontSize: compact ? 9.5 : 10.5,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--color-text-muted)",
    marginBottom: compact ? 8 : 10,
  };
}

function streamChip(label: string, query: string, active: boolean, basePath: string) {
  return (
    <Link
      key={label}
      href={`${basePath}?q=${encodeURIComponent(query)}`}
      className="chip stream-chip"
      style={{
        background: active ? "var(--color-accent-soft)" : "var(--color-surface-muted)",
        color: active ? "var(--color-accent)" : "var(--color-text-muted)",
        textDecoration: "none",
      }}
    >
      {label}
    </Link>
  );
}

export function StreamsPanel({
  activeQuery,
  basePath = "/",
  recentSearches = [],
  compact = false,
}: {
  activeQuery?: string;
  basePath?: string;
  recentSearches?: string[];
  // Smaller padding/font/gaps — used on /jobs, where this panel shares a
  // three-column layout with a filter sidebar instead of /live's plain
  // two-column one. Defaults to false so /live's rendering is unchanged.
  compact?: boolean;
}) {
  // Skip anything that's already one of the curated streams (case
  // insensitive) so a search for "Data Scientist" doesn't show up twice.
  const streamQueries = new Set(STREAMS.map((s) => s.query.toLowerCase()));
  const uniqueRecent = recentSearches.filter((q) => !streamQueries.has(q.toLowerCase()));

  return (
    <aside
      style={{
        padding: compact ? 14 : 18,
        borderRadius: "var(--radius-lg)",
        background: "var(--color-surface)",
        border: "1px solid var(--color-divider)",
        boxShadow: "var(--shadow-sm)",
        height: "fit-content",
      }}
    >
      <span style={sectionLabelStyle(compact)}>Browse by stream</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {STREAMS.map((s) => streamChip(s.label, s.query, activeQuery === s.query, basePath))}
      </div>

      {uniqueRecent.length > 0 && (
        <div style={{ marginTop: compact ? 14 : 18, paddingTop: compact ? 12 : 14, borderTop: "1px solid var(--color-divider)" }}>
          <span style={sectionLabelStyle(compact)}>Recent searches</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {uniqueRecent.slice(0, 8).map((q) => streamChip(q, q, activeQuery === q, basePath))}
          </div>
        </div>
      )}
    </aside>
  );
}
