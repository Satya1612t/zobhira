import Link from "next/link";
import { STREAMS } from "@/lib/streams";

const sectionLabelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-mono)",
  fontSize: 10.5,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--ink-faint)",
  marginBottom: 10,
};

function streamLink(label: string, query: string, active: boolean, basePath: string) {
  return (
    <Link
      key={label}
      href={`${basePath}?q=${encodeURIComponent(query)}`}
      className={`stream-link${active ? " stream-link-active" : ""}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 8px",
        borderRadius: "var(--radius-sm)",
        textDecoration: "none",
        fontSize: 13,
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
}: {
  activeQuery?: string;
  basePath?: string;
  recentSearches?: string[];
}) {
  // Skip anything that's already one of the curated streams (case
  // insensitive) so a search for "Data Scientist" doesn't show up twice.
  const streamQueries = new Set(STREAMS.map((s) => s.query.toLowerCase()));
  const uniqueRecent = recentSearches.filter((q) => !streamQueries.has(q.toLowerCase()));

  return (
    <aside
      style={{
        padding: 14,
        borderRadius: "var(--radius)",
        background: "var(--surface)",
        border: "1px solid var(--line)",
        height: "fit-content",
      }}
    >
      <span style={sectionLabelStyle}>Browse by stream</span>
      <nav style={{ display: "flex", flexDirection: "column" }}>
        {STREAMS.map((s) => streamLink(s.label, s.query, activeQuery === s.query, basePath))}
      </nav>

      {uniqueRecent.length > 0 && (
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
          <span style={sectionLabelStyle}>Recent searches</span>
          <nav style={{ display: "flex", flexDirection: "column" }}>
            {uniqueRecent.map((q) => streamLink(q, q, activeQuery === q, basePath))}
          </nav>
        </div>
      )}
    </aside>
  );
}
