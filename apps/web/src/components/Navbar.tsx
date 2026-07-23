import Link from "next/link";

// Complements the left Sidebar's primary section nav rather than
// duplicating it — brand (visible even when the sidebar is off-canvas on
// mobile) plus quick links, plus the auth entry points (a real /login
// route, not a modal — a modal isn't a linkable/crawlable URL).
//
// sidebarOpen: on mobile the Sidebar becomes an off-canvas drawer with its
// own brand logo; while it's open, this navbar's logo is redundant (two
// logos on screen at once), so it's hidden until the drawer closes.
export function Navbar({ sidebarOpen = false }: { sidebarOpen?: boolean }) {
  return (
    <header className="navbar">
      {/* visibility (not conditional rendering) — .navbar uses
          justify-content: space-between, so removing this element entirely
          would collapse the gap and jump the right-side links/buttons to
          the far left instead of just losing the logo. */}
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          textDecoration: "none",
          visibility: sidebarOpen ? "hidden" : "visible",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/zobhira-logo-light.png" alt="Zobhira" style={{ height: 36, width: "auto" }} />
      </Link>
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
