const shimmer: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--line) 25%, var(--surface-hover) 37%, var(--line) 63%)",
  backgroundSize: "400% 100%",
  borderRadius: "var(--radius-sm)",
};

// Mirrors page.tsx's real layout — header band, logo overlap tile, apply
// sidebar card, description lines — so nothing jumps/resizes once the real
// content replaces it.
export default function Loading() {
  return (
    <main>
      <div className="job-detail-header-band edge-arc-bottom">
        <div className="container" style={{ paddingBlock: "20px 44px" }}>
          <div className="skeleton-shimmer" style={{ ...shimmer, width: 140, height: 12, marginBottom: 18 }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <div className="skeleton-shimmer" style={{ ...shimmer, width: 320, height: 30, marginBottom: 10 }} />
              <div className="skeleton-shimmer" style={{ ...shimmer, width: 160, height: 18, marginBottom: 14 }} />
              <div className="skeleton-shimmer" style={{ ...shimmer, width: 260, height: 14 }} />
            </div>
            <div className="skeleton-shimmer" style={{ ...shimmer, width: 72, height: 72, borderRadius: "var(--radius-lg)", flexShrink: 0 }} />
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingBottom: 40 }}>
        <div className="job-detail-layout">
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              {[0, 1].map((i) => (
                <div key={i} className="job-card" style={{ padding: 24 }}>
                  <div className="skeleton-shimmer" style={{ ...shimmer, width: 110, height: 11, marginBottom: 14 }} />
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[60, 76, 54].map((w, j) => (
                      <div key={j} className="skeleton-shimmer" style={{ ...shimmer, width: w, height: 24, borderRadius: "var(--radius-full)" }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="job-card" style={{ padding: 28 }}>
              <div className="skeleton-shimmer" style={{ ...shimmer, width: 140, height: 22, marginBottom: 22 }} />
              {[100, 100, 100, 70].map((w, i) => (
                <div key={i} className="skeleton-shimmer" style={{ ...shimmer, width: `${w}%`, height: 15, marginBottom: 12 }} />
              ))}
            </div>
          </div>

          <aside className="job-detail-sidebar">
            <div className="job-apply-card">
              <div className="skeleton-shimmer" style={{ ...shimmer, width: "100%", height: 48, borderRadius: "var(--radius-full)", marginBottom: 8 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <div className="skeleton-shimmer" style={{ ...shimmer, flex: 1, height: 40 }} />
                <div className="skeleton-shimmer" style={{ ...shimmer, flex: 1, height: 40 }} />
              </div>
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 10 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                    <div className="skeleton-shimmer" style={{ ...shimmer, width: 60, height: 11 }} />
                    <div className="skeleton-shimmer" style={{ ...shimmer, width: 80, height: 13 }} />
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
