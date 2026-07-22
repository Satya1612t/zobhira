export default function ContactPage() {
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
        Contact
      </h1>
      <div style={{ color: "var(--ink)", fontSize: 14.5, lineHeight: 1.7 }}>
        <p>
          This page is a placeholder — add a real contact channel here (email, form, or issue
          tracker link) once one exists for this project.
        </p>
      </div>
    </main>
  );
}
