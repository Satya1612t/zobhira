// Design-only: no accounts exist yet (see /DESIGN.md) — this page is a
// static mockup of the "Profile with Modern Sidebar" Stitch screen (Design
// > "Dynamic Recruitment Portal"), ported into this app's own design tokens
// with hardcoded sample data, not tied to any real logged-in user.

function LocationIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}
function ExperienceIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
function SalaryIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.5c0-1.4 1.2-2.5 2.5-2.5s2.5.9 2.5 2c0 3-5 1.5-5 4.5 0 1.1 1.2 2 2.5 2s2.5-1.1 2.5-2.5" />
    </svg>
  );
}
function VerifiedIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 2 9.5 4.5 6 4l-1 3.5L1.5 9l1.5 3-1.5 3L4.5 16l1 3.5L9 19l3 1.5 3-1.5 3.5.5 1-3.5L23 15l-1.5-3L23 9l-3.5-1.5-1-3.5-3.5.5L12 2Z" />
      <path d="m9 12 2 2 4-4" stroke="var(--color-surface)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 6 8.5 7 8.5-7" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v11m0 0-4-4m4 4 4-4" />
      <path d="M5 19h14" />
    </svg>
  );
}
function BookmarkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3.5h12v18l-6-4-6 4v-18Z" />
    </svg>
  );
}
function SummaryIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M9 12h6M9 16h6M9 8h2" />
    </svg>
  );
}
function SkillsIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a4 4 0 0 1 2.6 7c1 .5 1.9 1.6 1.9 3v1H7.5v-1c0-1.4.9-2.5 1.9-3A4 4 0 0 1 12 3Z" />
      <path d="M9 21v-3M15 21v-3" />
    </svg>
  );
}
function TrophyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M17 5h2a2 2 0 0 1 2 2 4 4 0 0 1-4 4" />
      <path d="M7 5H5a2 2 0 0 0-2 2 4 4 0 0 0 4 4" />
    </svg>
  );
}
function RocketIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2c3 2 5 6 5 10-1 1-2.5 2-5 2s-4-1-5-2c0-4 2-8 5-10Z" />
      <circle cx="12" cy="9" r="1.5" />
      <path d="M9 15c-2 1-2.5 3-2.5 5 2 0 4-.5 5-2.5M15 15c2 1 2.5 3 2.5 5-2 0-4-.5-5-2.5" />
    </svg>
  );
}
function TimelineIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12h16" />
      <path d="M8 12V6M16 12v6" />
      <circle cx="8" cy="6" r="1.75" fill="currentColor" stroke="none" />
      <circle cx="16" cy="18" r="1.75" fill="currentColor" stroke="none" />
    </svg>
  );
}
function SchoolIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3 10 5-10 5L2 8l10-5Z" />
      <path d="M6 10.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-5.5" />
    </svg>
  );
}

const META = [
  { Icon: LocationIcon, label: "San Francisco, CA (Hybrid)" },
  { Icon: ExperienceIcon, label: "8+ Years Experience" },
  { Icon: SalaryIcon, label: "$140k – $160k Expected" },
];

const SKILLS = [
  { label: "Frontend (React, Vue, TS)", pct: 95 },
  { label: "Backend (Node.js, Go, Python)", pct: 88 },
  { label: "Cloud & DevOps (AWS, Docker, K8s)", pct: 80 },
  { label: "System Architecture", pct: 90 },
];

const ACHIEVEMENTS = [
  {
    Icon: TrophyIcon,
    accent: true,
    title: "1st Place — Global FinTech Hackathon",
    body: "Built a decentralized micro-lending platform in 48 hours using React and Solidity.",
  },
  {
    Icon: RocketIcon,
    accent: false,
    title: "Open Source Contributor: \"QuantumUI\"",
    body: "Core maintainer of a popular enterprise UI library with over 10k GitHub stars.",
  },
];

const TIMELINE = [
  {
    title: "Lead Software Engineer",
    range: "2021 – Present",
    company: "TechNova Solutions, Inc.",
    active: true,
    bullets: [
      "Spearheaded the migration of a legacy monolithic application to a microservices architecture, reducing latency by 40%.",
      "Managed a team of 6 engineers, conducting code reviews and mentoring junior staff.",
      "Implemented CI/CD pipelines using GitHub Actions, cutting deployment time in half.",
    ],
  },
  {
    title: "Full-Stack Developer",
    range: "2018 – 2021",
    company: "DataStream Analytics",
    active: false,
    bullets: [
      "Developed highly interactive data visualization dashboards using React and D3.js.",
      "Designed RESTful APIs in Node.js to support mobile and web clients.",
      "Optimized PostgreSQL database queries, improving report generation speed by 25%.",
    ],
  },
];

const LANGUAGES = ["English (Native)", "Spanish (Fluent)"];

function SectionHeading({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3
      style={{
        margin: "0 0 14px",
        paddingBottom: 10,
        borderBottom: "1px solid var(--line)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 16,
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        color: "var(--ink)",
      }}
    >
      <span style={{ color: "var(--accent)", display: "flex" }}>{icon}</span>
      {children}
    </h3>
  );
}

export default function ProfilePage() {
  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px 60px" }}>
      <div
        style={{
          padding: "10px 14px",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-md)",
          fontSize: 12.5,
          color: "var(--warn)",
          fontWeight: 600,
          marginBottom: 24,
        }}
      >
        Design preview — sample data, not a real account.
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
        {/* Left content canvas */}
        <div style={{ flex: "2 1 640px", minWidth: 0, display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Header card */}
          <div className="card" style={{ flexDirection: "row", alignItems: "center", gap: 20, padding: 24, flexWrap: "wrap" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDpkGX-KEUd4tNRaO3VDyA_40h3W-rQ3VH995D-onRMzAmHu8uC9SQCguEyXb8gJjGvDLmG4_I7yzotzPYQ9vxTntTfLL0Q_3ztXZfaV74AlU0IEEwmBqs7YjugNW1bc9x-eidOq2f43DERZT2RGJeeqB0BltpfyDhX9ZFGnVNTp5ZnYYas-9bGDGoHMjZkKtvO0ETaTIKJNsDEag-Z1B2iqjeOK40BOdnhoLnAzesygrw_mS1vUzgC0g"
              alt="Alex Mercer"
              style={{ width: 112, height: 112, borderRadius: "var(--radius-md)", objectFit: "cover", border: "1px solid var(--line)", flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: 24 }}>Alex Mercer</h1>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "3px 9px",
                    borderRadius: "var(--radius-full)",
                    background: "var(--color-surface-muted)",
                    border: "1px solid var(--line)",
                    fontSize: 11.5,
                    color: "var(--ink-muted)",
                  }}
                >
                  <span style={{ color: "var(--accent)", display: "flex" }}>
                    <VerifiedIcon />
                  </span>
                  Verified
                </span>
              </div>
              <p style={{ margin: "4px 0 10px", fontSize: 15, fontWeight: 600, color: "var(--accent)" }}>
                Senior Full-Stack Engineer &amp; System Architect
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                {META.map(({ Icon, label }) => (
                  <span key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--ink-muted)" }}>
                    <Icon />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 24 }}>
            {/* Professional Summary */}
            <section className="card" style={{ gridColumn: "1 / -1" }}>
              <SectionHeading icon={<SummaryIcon />}>Professional Summary</SectionHeading>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: "var(--ink-muted)" }}>
                Highly motivated and results-driven Senior Full-Stack Engineer with a proven track record of
                designing, developing, and deploying scalable enterprise applications. Adept at leading
                cross-functional teams to deliver complex software solutions on time and under budget.
                Specializes in cloud-native architectures, modern JavaScript frameworks, and optimizing
                system performance for high-traffic environments. Passionate about mentoring junior
                developers and fostering a culture of continuous learning and engineering excellence.
              </p>
            </section>

            {/* Skills Matrix */}
            <section className="card">
              <SectionHeading icon={<SkillsIcon />}>Skills Matrix</SectionHeading>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {SKILLS.map(({ label, pct }) => (
                  <div key={label}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--ink-muted)", marginBottom: 5 }}>
                      <span>{label}</span>
                      <span>{pct}%</span>
                    </div>
                    <div style={{ width: "100%", height: 6, borderRadius: "var(--radius-full)", background: "var(--color-surface-muted)" }}>
                      <div style={{ width: `${pct}%`, height: "100%", borderRadius: "var(--radius-full)", background: "var(--accent)" }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Portfolio & Achievements */}
            <section className="card">
              <SectionHeading icon={<TrophyIcon />}>Portfolio &amp; Achievements</SectionHeading>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {ACHIEVEMENTS.map(({ Icon, accent, title, body }) => (
                  <div key={title} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span
                      style={{
                        width: 36,
                        height: 36,
                        flexShrink: 0,
                        borderRadius: "var(--radius-sm)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: accent ? "var(--accent-soft)" : "var(--color-surface-muted)",
                        color: accent ? "var(--accent)" : "var(--ink-muted)",
                        border: accent ? "none" : "1px solid var(--line)",
                      }}
                    >
                      <Icon />
                    </span>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{title}</div>
                      <div style={{ fontSize: 12.5, color: "var(--ink-muted)", marginTop: 2 }}>{body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Experience Timeline */}
            <section className="card" style={{ gridColumn: "1 / -1" }}>
              <SectionHeading icon={<TimelineIcon />}>Experience Timeline</SectionHeading>
              <div style={{ display: "flex", flexDirection: "column", gap: 24, borderLeft: "2px solid var(--line)", paddingLeft: 20 }}>
                {TIMELINE.map((item) => (
                  <div key={item.title} style={{ position: "relative" }}>
                    <span
                      style={{
                        position: "absolute",
                        left: -25,
                        top: 3,
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: item.active ? "var(--accent)" : "var(--line)",
                        border: "3px solid var(--surface)",
                      }}
                    />
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{item.title}</h4>
                      <span style={{ fontSize: 11.5, color: "var(--ink-muted)", background: "var(--color-surface-muted)", padding: "2px 8px", borderRadius: "var(--radius-sm)" }}>
                        {item.range}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", marginBottom: 8 }}>{item.company}</div>
                    <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
                      {item.bullets.map((bullet) => (
                        <li key={bullet} style={{ fontSize: 12.5, color: "var(--ink-muted)", lineHeight: 1.6 }}>
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* Right sidebar: actions & meta */}
        <aside style={{ flex: "1 1 280px", minWidth: 260, maxWidth: 320, position: "sticky", top: 22 }}>
          <div className="card" style={{ padding: 22 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                marginBottom: 18,
                borderRadius: "var(--radius-sm)",
                background: "var(--color-surface-muted)",
                border: "1px solid var(--line)",
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Actively Looking</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-muted)" }}>Available in 2 weeks</div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
              <button type="button" className="btn btn-primary" style={{ width: "100%" }}>
                <MailIcon />
                Contact Candidate
              </button>
              <button type="button" className="btn btn-secondary" style={{ width: "100%" }}>
                <DownloadIcon />
                Download Resume
              </button>
              <button type="button" className="btn btn-ghost" style={{ width: "100%", border: "1px solid transparent" }}>
                <BookmarkIcon />
                Save to Shortlist
              </button>
            </div>

            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16, marginBottom: 16 }}>
              <h4 style={{ margin: "0 0 8px", fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>Languages</h4>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {LANGUAGES.map((lang) => (
                  <span key={lang} className="tag tag-outline">
                    {lang}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h4 style={{ margin: "0 0 8px", fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>Education</h4>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ color: "var(--ink-muted)", marginTop: 2 }}>
                  <SchoolIcon />
                </span>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>B.S. Computer Science</div>
                  <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>University of California, Berkeley</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>2014 – 2018</div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
