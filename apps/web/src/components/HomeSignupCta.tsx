// A plain GET form to the real /login page (tab=signup, email prefilled
// via query string) — no client JS needed, and it's a real crawlable URL
// rather than a modal. See /DESIGN.md.
export function HomeSignupCta() {
  return (
    <div className="card" style={{ padding: 36 }}>
      <span
        style={{
          display: "block",
          fontSize: 12,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          fontWeight: 700,
          color: "var(--color-accent)",
          marginBottom: 10,
        }}
      >
        Create your account
      </span>
      <h3 style={{ margin: "0 0 10px", fontSize: 24 }}>Create a free profile</h3>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--color-text-muted)", maxWidth: "60ch", margin: "0 0 20px" }}>
        Save roles, one-click apply, and get matched to contests in your stack. No recruiter spam
        — you control what gets shared.
      </p>
      <form method="get" action="/login" style={{ display: "flex", gap: 10, maxWidth: 460, flexWrap: "wrap" }}>
        <input type="hidden" name="tab" value="signup" />
        <input className="input" type="email" name="email" placeholder="you@example.com" style={{ flex: 1, minWidth: 180 }} />
        <button type="submit" className="btn btn-primary">
          Sign up
        </button>
      </form>
    </div>
  );
}
