import Link from "next/link";
import { STREAMS } from "@/lib/streams";

function sectionLabelStyle(compact: boolean): React.CSSProperties {
  return {
    display: "block",
    fontFamily: "var(--font-mono)",
    fontSize: compact ? 9.5 : 10.5,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--ink-faint)",
    marginBottom: compact ? 7 : 10,
  };
}

function streamLink(label: string, query: string, active: boolean, basePath: string, compact: boolean) {
  return (
    <Link
      key={label}
      href={`${basePath}?q=${encodeURIComponent(query)}`}
      className={`stream-link${active ? " stream-link-active" : ""}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: compact ? 6 : 8,
        padding: compact ? "5px 6px" : "7px 8px",
        borderRadius: "var(--radius-sm)",
        textDecoration: "none",
        fontSize: compact ? 12 : 13,
      }}
    >
      <span className="stream-link-dot" style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0 }} />
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
        padding: compact ? 10 : 14,
        borderRadius: "var(--radius)",
        background: "var(--surface)",
        border: "1px solid var(--line)",
        height: "fit-content",
      }}
    >
      <span style={sectionLabelStyle(compact)}>Browse by stream</span>
      <nav style={{ display: "flex", flexDirection: "column" }}>
        {STREAMS.map((s) => streamLink(s.label, s.query, activeQuery === s.query, basePath, compact))}
      </nav>

      {uniqueRecent.length > 0 && (
        <div style={{ marginTop: compact ? 12 : 18, paddingTop: compact ? 10 : 14, borderTop: "1px solid var(--line)" }}>
          <span style={sectionLabelStyle(compact)}>Recent searches</span>
          <nav style={{ display: "flex", flexDirection: "column" }}>
            {uniqueRecent.map((q) => streamLink(q, q, activeQuery === q, basePath, compact))}
          </nav>
        </div>
      )}
    </aside>
  );
}
