const shimmer: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--line) 25%, var(--surface-hover) 37%, var(--line) 63%)",
  backgroundSize: "400% 100%",
  borderRadius: "var(--radius-sm)",
};

// Dimension-matched to ContestCard.tsx — same top strip + progress bar
// placeholders so the layout doesn't shift once real cards replace this.
export function ContestCardSkeleton() {
  return (
    <div className="contest-card">
      <div className="skeleton-shimmer" style={{ ...shimmer, height: 4, borderRadius: 0 }} />
      <div className="contest-card-body">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div className="skeleton-shimmer" style={{ ...shimmer, width: 40, height: 40, borderRadius: "var(--radius-md)", flexShrink: 0 }} />
            <div>
              <div className="skeleton-shimmer" style={{ ...shimmer, width: 160, height: 18, marginBottom: 6 }} />
              <div className="skeleton-shimmer" style={{ ...shimmer, width: 100, height: 12 }} />
            </div>
          </div>
          <div className="skeleton-shimmer" style={{ ...shimmer, width: 64, height: 20, borderRadius: "var(--radius-full)", flexShrink: 0 }} />
        </div>
        <div className="skeleton-shimmer" style={{ ...shimmer, height: 3, borderRadius: "var(--radius-full)" }} />
        <div className="skeleton-shimmer" style={{ ...shimmer, width: 120, height: 28, borderRadius: "var(--radius-full)" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[0, 1].map((i) => (
            <div key={i} className="skeleton-shimmer" style={{ ...shimmer, width: `${80 - i * 15}%`, height: 12 }} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: "auto", paddingTop: 12 }}>
          {[64, 56, 48].map((w, i) => (
            <div key={i} className="skeleton-shimmer" style={{ ...shimmer, width: w, height: 22, borderRadius: "var(--radius-full)" }} />
          ))}
        </div>
      </div>
    </div>
  );
}
