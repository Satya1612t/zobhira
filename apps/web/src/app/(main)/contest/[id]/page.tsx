import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CompanyLogo } from "@/components/CompanyLogo";
import { ContestCard } from "@/components/ContestCard";
import { ContestCountdownTiles } from "@/components/ContestCountdownTiles";
import { ContestDetailActions } from "@/components/ContestDetailActions";
import { CONTEST_SELECT } from "@/lib/contestQuery";
import { linkifyText } from "@/lib/linkify";
import { buildIcsDataUri } from "@/lib/ics";

// Was force-dynamic — same ISR reasoning as jobs/[id]/page.tsx: content
// only changes on the next scrape/reap cycle, not per-request.
export const revalidate = 60;

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const contest = await prisma.contest.findUnique({
    where: { id: params.id },
    select: { title: true, organizer: true, summary: true, description: true },
  });
  if (!contest) return { title: "Contest not found" };
  const title = contest.organizer ? `${contest.title} by ${contest.organizer}` : contest.title;
  const desc = contest.summary ?? contest.description;
  return {
    title,
    description: desc ? desc.slice(0, 155) : `${title}, via Zobhira.`,
    alternates: { canonical: `/contest/${params.id}` },
  };
}

const FACT_ICONS: Record<string, string> = {
  deadline: "M12 8v5l3 2M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  prize: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z",
  mode: "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z",
};

export default async function ContestDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const contest = await prisma.contest.findUnique({ where: { id }, select: CONTEST_SELECT });

  // Expired contests are deleted outright (not deactivated) — a missing ID
  // here means it genuinely no longer exists, so a real 404 (Next's
  // closest equivalent to 410 from a page component) is correct, not an
  // empty-but-200 render.
  if (!contest) notFound();

  const deadline = contest.deadlineAt ? new Date(contest.deadlineAt) : null;
  const daysLeft = deadline ? Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const showUrgencyStrip = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;

  const relatedContests =
    contest.tags.length > 0
      ? await prisma.contest.findMany({
          where: { isActive: true, id: { not: contest.id }, tags: { hasSome: contest.tags } },
          orderBy: { deadlineAt: { sort: "asc", nulls: "last" } },
          take: 3,
          select: CONTEST_SELECT,
        })
      : [];

  const icsHref = deadline
    ? buildIcsDataUri({
        uid: contest.id,
        title: contest.title,
        description: contest.summary ?? undefined,
        url: contest.sourceUrl,
        start: contest.startsAt ? new Date(contest.startsAt) : deadline,
        end: deadline,
      })
    : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Event",
        name: contest.title,
        eventStatus: "https://schema.org/EventScheduled",
        ...(contest.startsAt ? { startDate: new Date(contest.startsAt).toISOString() } : {}),
        ...(deadline ? { endDate: deadline.toISOString() } : {}),
        eventAttendanceMode:
          contest.mode === "online"
            ? "https://schema.org/OnlineEventAttendanceMode"
            : contest.mode === "offline"
              ? "https://schema.org/OfflineEventAttendanceMode"
              : contest.mode === "hybrid"
                ? "https://schema.org/MixedEventAttendanceMode"
                : undefined,
        ...(contest.mode === "online" || contest.mode === "hybrid"
          ? { location: { "@type": "VirtualLocation", url: contest.sourceUrl } }
          : {}),
        ...(contest.organizer ? { organizer: { "@type": "Organization", name: contest.organizer } } : {}),
        ...(contest.prizeAmount
          ? { offers: { "@type": "Offer", price: contest.prizeAmount.toString(), priceCurrency: contest.prizeCurrency ?? "INR" } }
          : {}),
        url: `https://zobhira.com/contest/${contest.id}`,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://zobhira.com" },
          { "@type": "ListItem", position: 2, name: "Contests", item: "https://zobhira.com/contest" },
          { "@type": "ListItem", position: 3, name: contest.title },
        ],
      },
    ],
  };

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="job-detail-header-band edge-arc-bottom deco-grain" style={{ background: "var(--gradient-accent)" }}>
        <div className="container" style={{ position: "relative", paddingBlock: "24px 48px" }}>
          <Link href="/contest" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.85)", fontSize: 13.5, textDecoration: "none", marginBottom: 16 }}>
            &larr; Back to contests
          </Link>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 16, alignItems: "center", minWidth: 0 }}>
              <div style={{ background: "#fff", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-md)" }}>
                <CompanyLogo logoUrl={contest.logoUrl} company={contest.organizer ?? contest.title} size={64} />
              </div>
              <div style={{ minWidth: 0 }}>
                <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", fontWeight: 700, margin: "0 0 6px", color: "#fff" }}>
                  {contest.title}
                </h1>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", color: "rgba(255,255,255,0.8)", fontSize: 13.5 }}>
                  {contest.organizer && <span>{contest.organizer}</span>}
                  {contest.mode !== "unknown" && <span style={{ textTransform: "capitalize" }}>{contest.mode.replace("_", " ")}</span>}
                </div>
              </div>
            </div>
            {deadline && <ContestCountdownTiles deadline={deadline} />}
          </div>
        </div>
      </div>

      <main className="container" style={{ paddingBlock: 32 }}>
        <div className="job-detail-layout">
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {(contest.prizeSummary || contest.highlights.length > 0) && (
              <div className="job-card" style={{ padding: 24 }}>
                {contest.prizeSummary && (
                  <div style={{ marginBottom: contest.highlights.length > 0 ? 18 : 0 }}>
                    <span className="kicker">Prize</span>
                    <p style={{ margin: "6px 0 0", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-xl)", color: "var(--color-signal-text)" }}>
                      {contest.prizeSummary}
                    </p>
                  </div>
                )}
                {contest.highlights.length > 0 && (
                  <div>
                    <span className="kicker">Key facts</span>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px 16px", marginTop: 10 }}>
                      {contest.highlights.map((highlight) => (
                        <div key={highlight} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13.5 }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                          {highlight}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {contest.tags.length > 0 && (
              <div className="cluster">
                {contest.tags.map((tag) => (
                  <span key={tag} className="tag tag-accent">{tag}</span>
                ))}
              </div>
            )}

            <div className="job-card" style={{ padding: 28 }}>
              <h2 style={{ margin: "0 0 16px", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "var(--text-xl)", color: "var(--color-text)" }}>
                About this contest
              </h2>
              {contest.summary || contest.description ? (
                <div className="job-desc-prose">
                  <p>{linkifyText(contest.summary ?? contest.description ?? "")}</p>
                  {contest.summary && contest.description && contest.description !== contest.summary && (
                    <details style={{ marginTop: 14 }}>
                      <summary style={{ cursor: "pointer", fontSize: 12.5, color: "var(--color-text-muted)", fontWeight: 600 }}>
                        Show original description
                      </summary>
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)", whiteSpace: "pre-wrap", color: "var(--color-text-muted)", fontSize: 13.5 }}>
                        {linkifyText(contest.description ?? "")}
                      </div>
                    </details>
                  )}
                </div>
              ) : (
                <p style={{ color: "var(--ink-faint)", fontSize: 14 }}>
                  No description available. See the official page for full details.
                </p>
              )}
            </div>

            {relatedContests.length > 0 && (
              <div>
                <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-xl)", margin: "8px 0 16px" }}>
                  Related contests
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
                  {relatedContests.map((related) => (
                    <ContestCard key={related.id} contest={related} />
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="job-detail-sidebar">
            <div className="job-apply-card">
              {showUrgencyStrip && (
                <div className="job-deadline-strip">
                  Closes in {daysLeft === 0 ? "today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"}`}
                </div>
              )}
              <ContestDetailActions
                sourceUrl={contest.sourceUrl}
                icsHref={icsHref}
                icsFilename={`${contest.title.slice(0, 40).replace(/[^a-z0-9]+/gi, "-")}.ics`}
              />
              <p style={{ fontSize: 11.5, color: "var(--color-text-muted)", textAlign: "center", margin: "12px 0 0", lineHeight: 1.5 }}>
                Not affiliated. Registration happens on the official contest site.
              </p>
            </div>
          </aside>
        </div>
      </main>

      {/* Reuses job-detail's fixed mobile action bar CSS (.job-mobile-apply-bar
          hides everything after the first .job-apply-cta, so only Register
          shows) — the sidebar's full apply card is hidden below 1024px by
          that same shared rule, so this is the only Register entry point on
          mobile; without it the CTA would simply disappear there. */}
      <div className="job-mobile-apply-bar">
        <ContestDetailActions
          sourceUrl={contest.sourceUrl}
          icsHref={null}
          icsFilename=""
        />
      </div>
    </>
  );
}
