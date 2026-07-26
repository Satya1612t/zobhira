import Link from "next/link";

// Complements the left Sidebar's primary section nav rather than
// duplicating it — quick links plus the auth entry points (a real /login
// route, not a modal — a modal isn't a linkable/crawlable URL).
export function Navbar() {
  return (
    <header className="navbar">
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <nav style={{ display: "flex", gap: 18 }}>
          <Link href="/about" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-muted)", textDecoration: "none" }}>
            About
          </Link>
          <Link href="/contact" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-muted)", textDecoration: "none" }}>
            Contact
          </Link>
        </nav>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/login" className="btn btn-ghost">
            Log in
          </Link>
          <Link href="/login?tab=signup" className="btn btn-primary">
            Sign up
          </Link>
        </div>
      </div>
    </header>
  );
}
