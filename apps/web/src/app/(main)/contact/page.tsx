import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the Zobhira team in Indore, Madhya Pradesh. Report a broken link, suggest something, or ask a question.",
};

const CONTACT_EMAIL = "naukri.intech@gmail.com";

const METHODS = [
  {
    title: "Found a broken link?",
    body: "Wrong details, or a listing that should've come down already. Tell us and we'll check it.",
    detail: "Use the form, reason: Broken link",
    href: "#contact-form",
    Icon: FlagIcon,
  },
  {
    title: "Want to suggest something?",
    body: "A job board, contest platform, or a feature you wish this had.",
    detail: "Use the form, reason: Suggestion",
    href: "#contact-form",
    Icon: LightbulbIcon,
  },
  {
    title: "Just want to talk?",
    body: "Usually answered within two working days.",
    detail: CONTACT_EMAIL,
    href: `mailto:${CONTACT_EMAIL}`,
    Icon: MailIcon,
  },
];

const FAQ = [
  { q: "Do I need an account to search?", a: "No. Every job and contest search works with no account at all. Sign in only if you want to save roles or get alerts." },
  { q: "How often are listings updated?", a: "New listings show up most mornings. Most refresh multiple times a day." },
  { q: "Why don't you show where a listing came from?", a: "A listing is judged on its own merits, not where it was found." },
  { q: "A listing looks fake or expired, what do I do?", a: "Use the \"Found a broken link?\" option in the form below with the job or contest URL. We check link health daily, but a direct report is faster." },
  { q: "Can my company post a job directly?", a: "Not yet. Get in touch if you'd like to talk about it." },
];

function MailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}
function FlagIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3v18" />
      <path d="M5 4h13l-3 4 3 4H5" />
    </svg>
  );
}
function LightbulbIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.5 1 2.5h6c0-1 .4-1.9 1-2.5A6 6 0 0 0 12 3Z" />
    </svg>
  );
}
function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="faq-chevron">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export default function ContactPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ContactPage",
        name: "Contact Zobhira",
        url: "https://zobhira.com/contact",
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    ],
  };

  return (
    <main className="container" style={{ paddingBlock: 40 }}>
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", fontWeight: 700, margin: "0 0 12px" }}>
        Say hello
      </h1>
      <p style={{ color: "var(--color-text-muted)", fontSize: 14.5, lineHeight: 1.6, margin: "0 0 32px", maxWidth: "60ch" }}>
        Questions about a listing, your account, or the platform in general. We reply within two
        working days.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "5fr 7fr", gap: 40 }} className="contact-grid">
        <div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 32 }}>
            {METHODS.map((m) => (
              <a key={m.title} href={m.href} className="shape-blob job-card" style={{ padding: 20, display: "flex", gap: 14, textDecoration: "none", color: "inherit" }}>
                <div style={{ width: 44, height: 44, flexShrink: 0, borderRadius: "var(--radius-arch)", background: "var(--color-accent-tint)", color: "var(--color-accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <m.Icon />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{m.title}</div>
                  <p style={{ fontSize: 12.5, color: "var(--color-text-muted)", margin: "4px 0 6px", lineHeight: 1.5 }}>{m.body}</p>
                  <div style={{ fontSize: 12.5, color: "var(--color-accent)", fontWeight: 600 }}>{m.detail}</div>
                </div>
              </a>
            ))}
          </div>

          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", fontWeight: 700, margin: "0 0 12px" }}>
            Frequently asked
          </h2>
          <div className="faq-accordion">
            {FAQ.map((item) => (
              <details key={item.q} className="faq-item">
                <summary>
                  {item.q}
                  <ChevronIcon />
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>

        <div id="contact-form">
          <ContactForm />
        </div>
      </div>
    </main>
  );
}
