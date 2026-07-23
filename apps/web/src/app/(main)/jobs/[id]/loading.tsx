const shimmer: React.CSSProperties = {
  background: "linear-gradient(90deg, var(--line) 25%, var(--surface-hover) 37%, var(--line) 63%)",
  backgroundSize: "400% 100%",
  borderRadius: "var(--radius-sm)",
};

export default function Loading() {
  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "40px 24px 64px" }}>
      <div
        className="skeleton-shimmer"
        style={{ ...shimmer, width: 140, height: 14, marginBottom: 20 }}
      />
      <div className="detail-grid">
        <div
          style={{
            padding: "28px 30px",
            borderRadius: "var(--radius)",
            background: "var(--surface)",
            border: "1px solid var(--line)",
          }}
        >
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div className="skeleton-shimmer" style={{ ...shimmer, width: 56, height: 56, borderRadius: 11 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton-shimmer" style={{ ...shimmer, width: "60%", height: 24, marginBottom: 8 }} />
              <div className="skeleton-shimmer" style={{ ...shimmer, width: "35%", height: 15 }} />
            </div>
          </div>
          <div className="skeleton-shimmer" style={{ ...shimmer, width: "50%", height: 12, marginTop: 20 }} />
          <div style={{ marginTop: 26, paddingTop: 22, borderTop: "1px solid var(--line)" }}>
            {[100, 100, 100, 70].map((w, i) => (
              <div key={i} className="skeleton-shimmer" style={{ ...shimmer, width: `${w}%`, height: 13, marginBottom: 10 }} />
            ))}
          </div>
        </div>
        <div
          style={{
            padding: 22,
            borderRadius: "var(--radius)",
            background: "var(--surface)",
            border: "1px solid var(--line)",
          }}
        >
          <div className="skeleton-shimmer" style={{ ...shimmer, width: 72, height: 20, marginBottom: 18 }} />
          <div className="skeleton-shimmer" style={{ ...shimmer, width: "100%", height: 40 }} />
        </div>
      </div>
    </main>
  );
}
