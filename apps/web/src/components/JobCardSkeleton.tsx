const shimmer: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--line) 25%, var(--surface-hover) 37%, var(--line) 63%)",
  backgroundSize: "400% 100%",
  borderRadius: "var(--radius-sm)",
};

// Mirrors JobCard.tsx's structure row-for-row — same "card" class (so
// padding/radius/border/shadow come from the exact same CSS rule, not a
// hand-copied approximation), same 48px logo, and the same TAGS_ROW_HEIGHT/
// META_ROW_HEIGHT reserved-row heights JobCard uses to keep every real card
// a uniform height — so the skeleton occupies that same footprint and
// content doesn't jump/reflow once real cards replace it.
const TAGS_ROW_HEIGHT = 26;
const META_ROW_HEIGHT = 20;

export function JobCardSkeleton() {
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      {/* Single wrapping div, not three separate direct children of
          .card — that class sets `gap: 8px` between its flex children,
          which JobCard.tsx avoids by wrapping header/tags/meta inside one
          <Link>. Skipping this wrapper here would let that gap apply
          twice (once between each pair), adding 16px the real card
          doesn't have — live-confirmed this exact 16px mismatch before
          adding the wrapper back. */}
      <div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div className="skeleton-shimmer" style={{ ...shimmer, width: 48, height: 48, borderRadius: 10, flexShrink: 0 }} />
          <div>
            <div className="skeleton-shimmer" style={{ ...shimmer, width: 200, height: 18.5, marginBottom: 8 }} />
            <div className="skeleton-shimmer" style={{ ...shimmer, width: 130, height: 14.5 }} />
          </div>
        </div>
        <div style={{ marginTop: 12, height: TAGS_ROW_HEIGHT, display: "flex", gap: 6 }}>
          <div className="skeleton-shimmer" style={{ ...shimmer, width: 64, height: 20, borderRadius: 5 }} />
          <div className="skeleton-shimmer" style={{ ...shimmer, width: 78, height: 20, borderRadius: 5 }} />
          <div className="skeleton-shimmer" style={{ ...shimmer, width: 56, height: 20, borderRadius: 5 }} />
        </div>
        <div style={{ marginTop: 14, height: META_ROW_HEIGHT }}>
          <div className="skeleton-shimmer" style={{ ...shimmer, width: 240, height: 12.5 }} />
        </div>
      </div>
    </div>
  );
}
