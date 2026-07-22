const shimmer: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--line) 25%, var(--surface-hover) 37%, var(--line) 63%)",
  backgroundSize: "400% 100%",
  borderRadius: "var(--radius-sm)",
};

// Mirrors JobCard.tsx's structure row-for-row (same padding, logo size,
// font-driven line heights, and the tech-chip row) so the skeleton occupies
// the same footprint as the real card it's standing in for — otherwise
// content jumps/reflows once real cards replace it.
export function JobCardSkeleton() {
  return (
    <div
      style={{
        display: "block",
        padding: "22px 24px",
        marginBottom: 14,
        borderRadius: "var(--radius)",
        background: "var(--surface)",
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <div className="skeleton-shimmer" style={{ ...shimmer, width: 52, height: 52, borderRadius: 10, flexShrink: 0 }} />
        <div>
          <div className="skeleton-shimmer" style={{ ...shimmer, width: 200, height: 18.5, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ ...shimmer, width: 130, height: 14.5 }} />
        </div>
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 6 }}>
        <div className="skeleton-shimmer" style={{ ...shimmer, width: 64, height: 20, borderRadius: 5 }} />
        <div className="skeleton-shimmer" style={{ ...shimmer, width: 78, height: 20, borderRadius: 5 }} />
        <div className="skeleton-shimmer" style={{ ...shimmer, width: 56, height: 20, borderRadius: 5 }} />
      </div>
      <div style={{ marginTop: 14 }}>
        <div className="skeleton-shimmer" style={{ ...shimmer, width: 240, height: 12.5 }} />
      </div>
    </div>
  );
}
