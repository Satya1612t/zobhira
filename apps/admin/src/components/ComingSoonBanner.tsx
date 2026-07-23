export function ComingSoonBanner({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 8,
        padding: "56px 24px",
        border: "1px dashed var(--line)",
        borderRadius: "var(--radius)",
        background: "var(--surface)",
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--accent)",
          background: "var(--accent-soft)",
          padding: "4px 10px",
          borderRadius: "var(--radius-full, 999px)",
        }}
      >
        Coming soon
      </span>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600, margin: "6px 0 0", color: "var(--ink)" }}>
        {title}
      </h2>
      <p style={{ margin: 0, maxWidth: 420, fontSize: 13.5, color: "var(--ink-muted)" }}>{description}</p>
    </div>
  );
}
