export default function AboutPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px 64px" }}>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 26,
          fontWeight: 600,
          margin: "0 0 16px",
          color: "var(--ink)",
        }}
      >
        About Job Portal
      </h1>
      <div style={{ color: "var(--ink)", fontSize: 14.5, lineHeight: 1.7 }}>
        <p>
          Job Portal aggregates technical job listings from Y Combinator / Work at a Startup,
          RemoteOK, Talentd, and LinkedIn into one searchable board, curated for India-based and
          remote roles.
        </p>
        <p>
          Listings are collected on a scheduled basis rather than on-demand, so what you see here
          reflects the most recent scrape for each source rather than a live query against those
          sites directly.
        </p>
      </div>
    </main>
  );
}
