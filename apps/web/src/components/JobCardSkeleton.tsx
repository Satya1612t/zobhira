const shimmer: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--line) 25%, var(--surface-hover) 37%, var(--line) 63%)",
  backgroundSize: "400% 100%",
  borderRadius: "var(--radius-sm)",
};

// Mirrors JobCard.tsx's structure row-for-row — same ".job-card" class (so
// padding/radius/border/shadow come from the exact same CSS rule, not a
// hand-copied approximation), same 48px logo, and the same TAGS_ROW_HEIGHT/
// META_ROW_HEIGHT reserved-row heights JobCard uses to keep every real card
// a uniform height — so the skeleton occupies that same footprint and
// content doesn't jump/reflow once real cards replace it.
const TAGS_ROW_HEIGHT = 26;
const META_ROW_HEIGHT = 20;

export function JobCardSkeleton() {
  return (
    <div className="job-card" style={{ marginBottom: 14 }}>
      {/* Single wrapping div, not three separate direct children of
          .job-card — see the equivalent note this used to carry for .card;
          same reasoning still applies. */}
      <div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div className="skeleton-shimmer" style={{ ...shimmer, width: 48, height: 48, borderRadius: "var(--radius-md)", flexShrink: 0 }} />
          <div>
            <div className="skeleton-shimmer" style={{ ...shimmer, width: 200, height: 20, marginBottom: 8 }} />
            <div className="skeleton-shimmer" style={{ ...shimmer, width: 130, height: 14.5 }} />
          </div>
        </div>
        <div style={{ marginTop: 12, height: TAGS_ROW_HEIGHT, display: "flex", gap: 6 }}>
          <div className="skeleton-shimmer" style={{ ...shimmer, width: 64, height: 20, borderRadius: "var(--radius-full)" }} />
          <div className="skeleton-shimmer" style={{ ...shimmer, width: 78, height: 20, borderRadius: "var(--radius-full)" }} />
          <div className="skeleton-shimmer" style={{ ...shimmer, width: 56, height: 20, borderRadius: "var(--radius-full)" }} />
        </div>
        <div style={{ marginTop: 14, height: META_ROW_HEIGHT }}>
          <div className="skeleton-shimmer" style={{ ...shimmer, width: 240, height: 12.5 }} />
        </div>
      </div>
    </div>
  );
}
