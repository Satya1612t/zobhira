import Link from "next/link";

// Complements the left Sidebar's primary section nav rather than
// duplicating it — brand (visible even when the sidebar is off-canvas on
// mobile) plus the same quick links the Footer offers, reachable without
// scrolling to the bottom of a long page.
export function Navbar() {
  return (
    <header className="navbar">
      <Link
        href="/"
        style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}
      >
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            background: "var(--accent)",
            color: "var(--accent-ink)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          J
        </span>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--ink)" }}>
          Job Portal
        </span>
      </Link>
      <nav style={{ display: "flex", gap: 18 }}>
        <Link href="/about" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-muted)", textDecoration: "none" }}>
          About
        </Link>
        <Link href="/contact" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-muted)", textDecoration: "none" }}>
          Contact
        </Link>
      </nav>
    </header>
  );
}
