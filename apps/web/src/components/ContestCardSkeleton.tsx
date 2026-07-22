const shimmer: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--line) 25%, var(--surface-hover) 37%, var(--line) 63%)",
  backgroundSize: "400% 100%",
  borderRadius: "var(--radius-sm)",
};

// Dimension-matched to ContestCard.tsx from day one (the lesson learned
// fixing JobCardSkeleton after the fact — don't defer it here).
export function ContestCardSkeleton() {
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
      <div style={{ marginTop: 12 }}>
        <div className="skeleton-shimmer" style={{ ...shimmer, width: 100, height: 20, borderRadius: 5 }} />
      </div>
      <div style={{ marginTop: 14 }}>
        <div className="skeleton-shimmer" style={{ ...shimmer, width: 240, height: 12.5 }} />
      </div>
    </div>
  );
}
