import Link from "next/link";
import { unstable_cache } from "next/cache";
import { getTopLocations } from "@/lib/jobQuery";
import { SHOW_UNRELEASED_NAV, SHOW_CERTIFICATIONS } from "@/lib/authNavFlags";

// Cached (5 min) rather than a live per-request fetch — Footer renders on
// every page via the shared (main) layout, so an uncached Prisma call here
// would force even the static About/Privacy/Terms pages into dynamic
// rendering. See (main)/layout.tsx's getSidebarCounts for the same pattern.
const getCachedTopLocations = unstable_cache(() => getTopLocations(6), ["footer-top-locations"], { revalidate: 300 });

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

const SOCIALS = [
  { label: "Instagram", href: "#", Icon: InstagramIcon },
  { label: "YouTube", href: "#", Icon: YouTubeIcon },
  { label: "Telegram", href: "#", Icon: TelegramIcon },
  { label: "X", href: "#", Icon: XIcon },
];

const FIND_WORK = [
  { label: "All jobs", href: "/jobs" },
  { label: "Fresher roles", href: "/jobs?experienceLevel=fresher" },
  { label: "Remote roles", href: "/jobs?workplaceType=remote" },
  ...(SHOW_CERTIFICATIONS ? [{ label: "Certifications", href: "/certifications" }] : []),
];

const COMPETE = [
  ...(SHOW_UNRELEASED_NAV ? [{ label: "Contests", href: "/contest" }] : []),
  { label: "Added today", href: "/today" },
];

const COMPANY = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const isInternal = href.startsWith("/");
  if (isInternal) return <Link href={href}>{children}</Link>;
  return <a href={href}>{children}</a>;
}

function FooterColumn({ heading, links }: { heading: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h4 className="footer-heading">{heading}</h4>
      <ul className="footer-links">
        {links.map((link) => (
          <li key={link.label}>
            <FooterLink href={link.href}>{link.label}</FooterLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function Footer() {
  const topLocations = await getCachedTopLocations();
  const byCity = topLocations.map((city) => ({ label: city, href: `/jobs?location=${encodeURIComponent(city)}` }));

  return (
    <footer className="footer section--dark edge-diagonal-top deco-grain" data-theme="dark">
      <div className="footer-inner" style={{ position: "relative" }}>
        <div className="footer-grid">
          <div>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, color: "var(--color-text-onDark)", marginBottom: 10, display: "block" }}>
              Zobhira
            </span>
            <p style={{ color: "var(--color-text-onDark-muted)", fontSize: 13, lineHeight: 1.6, marginTop: 0, marginBottom: 16, maxWidth: "32ch" }}>
              New job and contest openings, updated every morning on one searchable board.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {SOCIALS.map(({ label, href, Icon }) => (
                <a key={label} href={href} aria-label={label} className="footer-icon-circle">
                  <Icon />
                </a>
              ))}
            </div>
          </div>

          <FooterColumn heading="Find work" links={FIND_WORK} />
          <FooterColumn heading="Compete" links={COMPETE} />
          {byCity.length > 0 && <FooterColumn heading="Popular cities" links={byCity} />}
          <FooterColumn heading="Company" links={COMPANY} />

          <div>
            <h4 className="footer-heading">Stay updated</h4>
            <p style={{ color: "var(--color-text-onDark-muted)", fontSize: 12.5, lineHeight: 1.5, margin: "0 0 12px" }}>
              One email a week with new roles.
            </p>
            <form method="get" action="/login" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input type="hidden" name="tab" value="signup" />
              <input
                className="input"
                type="email"
                name="email"
                placeholder="you@example.com"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid var(--color-divider-onDark)", color: "var(--color-text-onDark)" }}
              />
              <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
                Get job alerts
              </button>
            </form>
          </div>
        </div>

        <div className="footer-trust-and-social">
          <div className="footer-trust-row">
            <div className="footer-trust-badge">
              <ShieldIcon />
              <span>Secure infrastructure</span>
            </div>
            <div className="footer-trust-badge">
              <span>Free to use, no account needed to search</span>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p style={{ fontSize: 12, color: "var(--color-text-onDark-muted)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <span className="footer-pulse-dot" aria-hidden="true" />
            Board updated daily &middot; &copy; {new Date().getFullYear()} Zobhira. All rights reserved.
          </p>
          <div className="footer-legal-links">
            <FooterLink href="/privacy">Privacy Policy</FooterLink>
            <FooterLink href="/terms">Terms of Service</FooterLink>
          </div>
        </div>
      </div>
    </footer>
  );
}
