export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 24px 64px" }}>
      <div style={{ maxWidth: "70ch" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 26,
            fontWeight: 600,
            margin: "0 0 16px",
            color: "var(--ink)",
          }}
        >
          Privacy
        </h1>
        <div style={{ color: "var(--ink)", fontSize: 14.5, lineHeight: 1.7 }}>
          <p>
            This site has no user accounts, login, or tracking of individual visitors. The only
            data it stores from your usage is the text of searches you run, kept so the "Recent
            searches" panel can show them again later — no other identifying information is
            attached to a search.
          </p>
          <p>
            Job listing data itself is aggregated from public job boards and hiring platforms on
            a schedule and stored to power search — see the About page for details.
          </p>
          <p style={{ color: "var(--ink-faint)", fontSize: 13 }}>
            This is a placeholder policy reflecting the app's current, actual behavior — update it
            if that behavior changes.
          </p>
        </div>
      </div>
    </main>
  );
}
