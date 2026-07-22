import Link from "next/link";

const LINKS = [
  { label: "About Us", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Privacy Policy", href: "/privacy" },
];

export function Footer() {
  return (
    <footer
      style={{
        marginTop: 40,
        borderTop: "1px solid var(--line)",
        background: "var(--surface)",
        padding: "20px 24px",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <span style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
        © {new Date().getFullYear()} Job Portal
      </span>
      <nav style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-muted)", textDecoration: "none" }}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
