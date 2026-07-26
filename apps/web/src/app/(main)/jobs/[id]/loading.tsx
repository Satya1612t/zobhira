const shimmer: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--line) 25%, var(--surface-hover) 37%, var(--line) 63%)",
  backgroundSize: "400% 100%",
  borderRadius: "var(--radius-sm)",
};

// Mirrors page.tsx's real layout — same maxWidth/padding as the real page
// (which itself matches /jobs), same "card" class for each section, same
// stats-grid column count and sidebar row count — so nothing jumps/resizes
// once the real content replaces it.
export default function Loading() {
  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "22px 24px 40px" }}>
      <div className="skeleton-shimmer" style={{ ...shimmer, width: 140, height: 14, marginBottom: 16 }} />

      <div className="job-detail-layout">
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Header card */}
          <div className="card" style={{ padding: 28 }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 20, alignItems: "flex-start" }}>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <div className="skeleton-shimmer" style={{ ...shimmer, width: 56, height: 56, borderRadius: 11, flexShrink: 0 }} />
                <div>
                  <div className="skeleton-shimmer" style={{ ...shimmer, width: 90, height: 12, marginBottom: 8 }} />
                  <div className="skeleton-shimmer" style={{ ...shimmer, width: 260, height: 24, marginBottom: 8 }} />
                  <div className="skeleton-shimmer" style={{ ...shimmer, width: 150, height: 15, marginBottom: 10 }} />
                  <div className="skeleton-shimmer" style={{ ...shimmer, width: 130, height: 13 }} />
                </div>
              </div>
              <div style={{ minWidth: 220 }}>
                <div className="skeleton-shimmer" style={{ ...shimmer, width: "100%", height: 40 }} />
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 18,
                marginTop: 24,
                paddingTop: 20,
                borderTop: "1px solid var(--line)",
              }}
            >
              {[0, 1, 2, 3].map((i) => (
                <div key={i}>
                  <div className="skeleton-shimmer" style={{ ...shimmer, width: 60, height: 10, marginBottom: 6 }} />
                  <div className="skeleton-shimmer" style={{ ...shimmer, width: 90, height: 15 }} />
                </div>
              ))}
            </div>
          </div>

          {/* Role overview card */}
          <div className="card" style={{ padding: 28 }}>
            <div className="skeleton-shimmer" style={{ ...shimmer, width: 140, height: 19, marginBottom: 20 }} />
            {[100, 100, 100, 70].map((w, i) => (
              <div key={i} className="skeleton-shimmer" style={{ ...shimmer, width: `${w}%`, height: 13, marginBottom: 10 }} />
            ))}
          </div>

          {/* Tags + tech-stack cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            {[0, 1].map((i) => (
              <div key={i} className="card" style={{ padding: 24 }}>
                <div className="skeleton-shimmer" style={{ ...shimmer, width: 110, height: 11, marginBottom: 14 }} />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[60, 76, 54].map((w, j) => (
                    <div key={j} className="skeleton-shimmer" style={{ ...shimmer, width: w, height: 24, borderRadius: 999 }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="job-detail-sidebar">
          <div className="card" style={{ padding: 20 }}>
            <div className="skeleton-shimmer" style={{ ...shimmer, width: 100, height: 16, marginBottom: 14 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 10px", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)" }}>
                  <div className="skeleton-shimmer" style={{ ...shimmer, width: 36, height: 36, borderRadius: 8, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton-shimmer" style={{ ...shimmer, width: "80%", height: 13, marginBottom: 6 }} />
                    <div className="skeleton-shimmer" style={{ ...shimmer, width: "60%", height: 11 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
