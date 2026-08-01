import type { Metadata } from "next";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { PageHero } from "@/components/PageHero";
import { Trustability } from "@/components/home/Trustability";
import { HomeSignupCta } from "@/components/HomeSignupCta";
import { Reveal } from "@/components/ui/Reveal";
import { CountUp } from "@/components/ui/CountUp";

export const metadata: Metadata = {
  title: "About Zobhira",
  description: "Why we built a job board that deletes its own listings.",
};

const LEADERSHIP = [
  { name: "Nikhil Singh", role: "Founder & CEO", color: "#003366", photo: "/team/nikhil-singh.jpg" },
  { name: "Rafiya Memon", role: "Platform Manager", color: "#3a5f94", photo: "/team/rafiya-memon.jpg" },
];

const PILLARS = [
  {
    title: "Jobs",
    body: "Search technical roles in one place, apply to the ones that fit, and move toward the hike or the title you're after.",
    Icon: BriefcaseIcon,
  },
  {
    title: "Contests",
    body: "Enter hackathons and coding contests still open for entry. Every contest you finish is a project you can point to, the portfolio builds itself as you go.",
    Icon: TrophyIcon,
  },
];

const DONT_DO = [
  { title: "We don't charge you", body: "Free to search, always. No account required, no paywall, no fee to apply." },
  { title: "We don't sell your data", body: "Search history stays on this site to power the \"Recent searches\" panel. It's never sold or shared with advertisers." },
  { title: "We don't leave closed jobs up", body: "Expired contests are deleted, not hidden. Stale jobs get deactivated on a schedule, not left up to look bigger than we are." },
];

const PRINCIPLES = [
  { n: "01", title: "Real listings, checked daily", body: "Link-health checks run on a schedule. A listing that stops resolving gets deactivated automatically." },
  { n: "02", title: "One search, not ten tabs", body: "Everything flows into the same board, so you check one place instead of five." },
  { n: "03", title: "No bias toward any platform", body: "We never show which platform a listing came from. The listing is judged on its own merits." },
  { n: "04", title: "Free to search, always", body: "No account is required to search. Sign in only if you want saved roles and alerts." },
];

function BriefcaseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 12h18" />
    </svg>
  );
}
function TrophyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M17 5h2a2 2 0 0 1 2 2 4 4 0 0 1-4 4" />
      <path d="M7 5H5a2 2 0 0 0-2 2 4 4 0 0 0 4 4" />
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
function MapIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

export default async function AboutPage() {
  const [jobsCount, contestsCount, companies] = await Promise.all([
    prisma.job.count({ where: { isActive: true } }),
    prisma.contest.count({ where: { isActive: true } }),
    prisma.job.groupBy({ by: ["company"], where: { isActive: true } }),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Zobhira",
    url: "https://zobhira.com",
    description: "Zobhira is a free, searchable board of open jobs and contests, updated every morning for students and working professionals.",
    founder: { "@type": "Person", name: "Nikhil Singh", jobTitle: "Founder & CEO" },
    address: {
      "@type": "PostalAddress",
      streetAddress: "Vijay Nagar",
      addressLocality: "Indore",
      addressRegion: "Madhya Pradesh",
      addressCountry: "IN",
    },
    contactPoint: [
      { "@type": "ContactPoint", contactType: "customer support", telephone: "+91-9131753246" },
      { "@type": "ContactPoint", contactType: "customer support", telephone: "+91-7000232707", email: "naukri.intech@gmail.com" },
    ],
  };

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <PageHero
        kicker="ABOUT ZOBHIRA"
        title="Job hunting shouldn't take ten browser tabs."
        sub="One page that only shows what's actually open, updated every morning."
      />

      <main className="container" style={{ paddingBlock: 40 }}>
        {/* The problem, in two columns */}
        <Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.4fr)", gap: 40, marginBottom: 56 }}>
            <div className="deco-dotgrid" style={{ padding: 24, borderRadius: "var(--radius-lg)", background: "var(--color-surface)", border: "1px solid var(--color-divider)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-2xl)", color: "var(--color-accent)" }}>
                    <CountUp value={jobsCount} suffix="+" />
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>live roles on the board right now</div>
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-2xl)", color: "var(--color-accent)" }}>
                    <CountUp value={contestsCount} />
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>open contests, checked daily</div>
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-2xl)", color: "var(--color-accent)" }}>
                    <CountUp value={companies.length} suffix="+" />
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>companies represented</div>
                </div>
              </div>
            </div>

            <div style={{ maxWidth: "68ch" }}>
              <div style={{ color: "var(--color-text)", fontSize: "var(--text-base)", lineHeight: 1.75 }}>
                <p>
                  Zobhira started because finding a job in India means checking the same ten sites
                  every morning, most of which show you jobs that closed weeks ago.
                </p>
              </div>
              <blockquote
                style={{
                  margin: "20px 0",
                  paddingLeft: 20,
                  borderLeft: "3px solid var(--color-signal)",
                  fontFamily: "var(--font-display)",
                  fontSize: "var(--text-xl)",
                  fontWeight: 600,
                  lineHeight: 1.4,
                  color: "var(--color-text)",
                }}
              >
                We wanted one page that only shows what&apos;s actually open, updated every
                morning, so you can apply while you&apos;re still early.
              </blockquote>
              <div style={{ color: "var(--color-text)", fontSize: "var(--text-base)", lineHeight: 1.75 }}>
                <p>It&apos;s free, and it stays free.</p>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Three pillars */}
        <Reveal>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", fontWeight: 700, margin: "0 0 20px" }}>
            What you&apos;ll find here
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 56 }}>
            {PILLARS.map(({ title, body, Icon }) => (
              <div key={title} className="job-card" style={{ padding: 22 }}>
                <div style={{ width: 44, height: 44, borderRadius: "var(--radius-arch)", background: "var(--color-accent-tint)", color: "var(--color-accent)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                  <Icon />
                </div>
                <h3 style={{ fontSize: "var(--text-base)", fontWeight: 700, margin: "0 0 6px" }}>{title}</h3>
                <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--color-text-muted)", margin: 0 }}>{body}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </main>

      {/* How it works — the exact same component the homepage uses, not a
          rewritten copy, per the pack's "one mechanism explained once" rule. */}
      <Trustability />

      <main className="container" style={{ paddingBlock: 56 }}>
        {/* What we don't do */}
        <Reveal>
          <span className="kicker">WHAT WE DON&apos;T DO</span>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", fontWeight: 700, margin: "10px 0 20px" }}>
            The short list of things we refuse to do
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 56 }}>
            {DONT_DO.map((item) => (
              <div key={item.title} className="job-card" style={{ padding: 22, borderLeft: "3px solid var(--color-success)" }}>
                <h3 style={{ fontSize: 14.5, fontWeight: 700, margin: "0 0 8px" }}>{item.title}</h3>
                <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--color-text-muted)", margin: 0 }}>{item.body}</p>
              </div>
            ))}
          </div>
        </Reveal>

        {/* Principles */}
        <Reveal>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", fontWeight: 700, margin: "0 0 20px" }}>
            Principles
          </h2>
          <div style={{ display: "flex", flexDirection: "column", marginBottom: 56 }}>
            {PRINCIPLES.map((p) => (
              <div key={p.n} style={{ display: "flex", gap: 20, padding: "20px 0", borderTop: "1px solid var(--color-divider)" }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-xl)", color: "var(--color-signal-text)", flexShrink: 0, width: 40 }}>
                  {p.n}
                </span>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>{p.title}</h3>
                  <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--color-text-muted)", margin: 0, maxWidth: "60ch" }}>{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* Team */}
        <Reveal>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", fontWeight: 700, margin: "0 0 8px" }}>
            Who&apos;s behind it
          </h2>
          <p style={{ color: "var(--color-text-muted)", fontSize: 13.5, margin: "0 0 20px" }}>
            A small team, run out of Indore.
          </p>
          <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginBottom: 56 }}>
            {LEADERSHIP.map(({ name, role, color, photo }) => (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {photo ? (
                  <div className="shape-arch" style={{ width: 76, height: 76, flexShrink: 0, boxShadow: "0 0 0 1px var(--line)", position: "relative", overflow: "hidden" }}>
                    <Image src={photo} alt={name} fill sizes="76px" style={{ objectFit: "cover" }} />
                  </div>
                ) : (
                  <div className="shape-arch" style={{ width: 76, height: 76, flexShrink: 0, boxShadow: "0 0 0 1px var(--line)", background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26 }}>
                    {name[0]}
                  </div>
                )}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{name}</div>
                  <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{role}</div>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        {/* Location & contact */}
        <Reveal>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-xl)", fontWeight: 700, margin: "0 0 12px" }}>
            Where to find us
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "var(--ink-faint)", display: "flex" }}><MapIcon /></span>
              Vijay Nagar, Indore, Madhya Pradesh, India
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ color: "var(--ink-faint)", display: "flex" }}><PhoneIcon /></span>
              <a href="tel:+919131753246" style={{ color: "var(--ink)", textDecoration: "none" }}>+91 91317 53246</a>
              <span style={{ color: "var(--ink-faint)" }}>&middot;</span>
              <a href="tel:+917000232707" style={{ color: "var(--ink)", textDecoration: "none" }}>+91 70002 32707</a>
            </div>
          </div>
        </Reveal>
      </main>

      <HomeSignupCta jobsCount={jobsCount} contestsCount={contestsCount} />
    </>
  );
}
