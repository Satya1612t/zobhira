import Link from "next/link";

// "High-Utility Grid" footer, from the Stitch mood-board (Design >
// "Dynamic Recruitment Portal" > "Footer - High-Utility Grid (Web)") —
// ported 1:1 (copy, columns, trust badges, legal bar) except the brand
// name and the icon rows, which now use real social platforms instead of
// the mockup's generic placeholder glyphs.

function InstagramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}
function YouTubeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="4" />
      <path d="M10 9l6 3-6 3V9z" fill="currentColor" stroke="none" />
    </svg>
  );
}
function TelegramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7z" />
    </svg>
  );
}
function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M15 8h-2a2 2 0 0 0-2 2v2H9v3h2v6h3v-6h2l1-3h-3v-2a1 1 0 0 1 1-1h2V8z" fill="currentColor" stroke="none" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4l16 16" />
      <path d="M20 4 4 20" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
function BadgeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6" />
      <path d="M9 13.5 7 22l5-3 5 3-2-8.5" />
    </svg>
  );
}
function GlobeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="2" width="12" height="20" rx="2" />
      <path d="M11 18h2" />
    </svg>
  );
}
function PlayStoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 3 12 9-12 9V3Z" />
      <path d="m15 12 6-3.5v7L15 12Z" />
    </svg>
  );
}
function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

const SOCIALS = [
  { label: "Instagram", href: "#", Icon: InstagramIcon },
  { label: "YouTube", href: "#", Icon: YouTubeIcon },
  { label: "Telegram", href: "#", Icon: TelegramIcon },
  { label: "Facebook", href: "#", Icon: FacebookIcon },
  { label: "X", href: "#", Icon: XIcon },
];

const FOR_EMPLOYERS = [
  { label: "Post a Job", href: "#" },
  { label: "Talent Sourcing", href: "#" },
  { label: "Enterprise Solutions", href: "#" },
  { label: "Recruitment Marketing", href: "#" },
  { label: "Hiring API", href: "#" },
];

const FOR_PROFESSIONALS = [
  { label: "Browse Jobs", href: "/jobs" },
  { label: "Career Advice", href: "#" },
  { label: "Salary Insights", href: "#" },
  { label: "Resume Builder", href: "#" },
  { label: "Skills Verification", href: "#" },
];

const COMPANY = [
  { label: "About Us", href: "/about" },
  { label: "Our Impact", href: "#" },
  { label: "Leadership", href: "#" },
  { label: "Newsroom", href: "#" },
  { label: "Contact Us", href: "/contact" },
];

const LEGAL_LINKS = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "#" },
  { label: "Cookie Policy", href: "#" },
  { label: "Accessibility Statement", href: "#" },
  { label: "Sitemap", href: "#" },
];

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const isInternal = href.startsWith("/");
  if (isInternal) {
    return <Link href={href}>{children}</Link>;
  }
  return <a href={href}>{children}</a>;
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-grid">
          {/* Brand column */}
          <div>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, color: "var(--color-accent)", marginBottom: 10, display: "block" }}>
              Zobhira
            </span>
            <p style={{ color: "var(--ink-muted)", fontSize: 13, lineHeight: 1.6, marginTop: 0, marginBottom: 16 }}>
              The global standard for professional hiring. Built on trust, efficiency, and industrial-grade
              reliability for the world&apos;s leading enterprises.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {SOCIALS.map(({ label, href, Icon }) => (
                <a key={label} href={href} aria-label={label} className="footer-icon-circle">
                  <Icon />
                </a>
              ))}
            </div>
          </div>

          {/* Shortcuts: For Employers */}
          <div>
            <h4 className="footer-heading">For Employers</h4>
            <ul className="footer-links">
              {FOR_EMPLOYERS.map((link) => (
                <li key={link.label}>
                  <FooterLink href={link.href}>{link.label}</FooterLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Shortcuts: For Professionals */}
          <div>
            <h4 className="footer-heading">For Professionals</h4>
            <ul className="footer-links">
              {FOR_PROFESSIONALS.map((link) => (
                <li key={link.label}>
                  <FooterLink href={link.href}>{link.label}</FooterLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Shortcuts: Company */}
          <div>
            <h4 className="footer-heading">Company</h4>
            <ul className="footer-links">
              {COMPANY.map((link) => (
                <li key={link.label}>
                  <FooterLink href={link.href}>{link.label}</FooterLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Download App & Language */}
          <div>
            <h4 className="footer-heading">Download App</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              <a href="#" className="footer-store-btn">
                <PhoneIcon />
                <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                  <span style={{ fontSize: 10, opacity: 0.8 }}>Download on the</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>App Store</span>
                </span>
              </a>
              <a href="#" className="footer-store-btn">
                <PlayStoreIcon />
                <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
                  <span style={{ fontSize: 10, opacity: 0.8 }}>Get it on</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Google Play</span>
                </span>
              </a>
            </div>
            <h4 className="footer-heading" style={{ marginBottom: 8 }}>Language</h4>
            <div style={{ position: "relative" }}>
              <select className="footer-select" defaultValue="en-US">
                <option value="en-US">English (United States)</option>
                <option value="de-DE">Deutsch (Deutschland)</option>
                <option value="fr-FR">Français (France)</option>
                <option value="es-ES">Español (España)</option>
                <option value="ja-JP">日本語 (日本)</option>
              </select>
              <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--ink-faint)" }}>
                <ChevronDownIcon />
              </span>
            </div>
          </div>
        </div>

        {/* Trust indicators & socials */}
        <div className="footer-trust-and-social">
          <div className="footer-trust-row">
            <div className="footer-trust-badge">
              <ShieldIcon />
              <span>Secure Infrastructure</span>
            </div>
            <div className="footer-trust-badge">
              <BadgeIcon />
              <span>ISO Certified</span>
            </div>
            <div className="footer-trust-badge">
              <GlobeIcon />
              <span>Global Presence</span>
            </div>
          </div>
          <div className="footer-social-row">
            {SOCIALS.map(({ label, href, Icon }) => (
              <a key={label} href={href} aria-label={label}>
                <Icon />
              </a>
            ))}
          </div>
        </div>

        {/* Bottom legal bar */}
        <div className="footer-bottom">
          <p style={{ fontSize: 12, color: "var(--ink-muted)", margin: 0 }}>
            © {new Date().getFullYear()} Zobhira Global. All rights reserved.
          </p>
          <div className="footer-legal-links">
            {LEGAL_LINKS.map((link) => (
              <FooterLink key={link.label} href={link.href}>
                {link.label}
              </FooterLink>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
