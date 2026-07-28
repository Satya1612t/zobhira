import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { JOB_SELECT } from "@/lib/jobQuery";
import { CONTEST_SELECT } from "@/lib/contestQuery";
import { TimelineEntry, type TimelineItem } from "@/components/live/TimelineEntry";
import { CountUp } from "@/components/ui/CountUp";

export const metadata: Metadata = {
  title: "Added today",
  description: "Everything new on Zobhira in the last 24 hours, in the order it landed. You're seeing it early.",
};

// Cached, not force-dynamic — a 60s revalidate is fresh enough for "what
// landed recently" without hitting Postgres on every single view.
export const revalidate = 60;

const WINDOW_HOURS = 48; // covers Today + Yesterday grouping

function dayLabel(date: Date): string {
  const now = new Date();
  const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (isSameDay(date, now)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Asia/Kolkata" });
}

export default async function TodayPage() {
  const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000);

  const [recentJobs, recentContests] = await Promise.all([
    prisma.job.findMany({
      where: { isActive: true, firstSeenAt: { gte: since } },
      orderBy: { firstSeenAt: "desc" },
      take: 40,
      select: { ...JOB_SELECT, firstSeenAt: true },
    }),
    prisma.contest.findMany({
      where: { isActive: true, firstSeenAt: { gte: since } },
      orderBy: { firstSeenAt: "desc" },
      take: 20,
      select: { ...CONTEST_SELECT, firstSeenAt: true },
    }),
  ]);

  const items: TimelineItem[] = [
    ...recentJobs.map((j): TimelineItem => ({ kind: "job", id: j.id, title: j.title, company: j.company, logoUrl: j.logoUrl, location: j.location, at: j.firstSeenAt })),
    ...recentContests.map((c): TimelineItem => ({ kind: "contest", id: c.id, title: c.title, organizer: c.organizer, logoUrl: c.logoUrl, prizeSummary: c.prizeSummary, at: c.firstSeenAt })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const last24hCount = items.filter((i) => Date.now() - i.at.getTime() < 24 * 60 * 60 * 1000).length;

  // Group into Today/Yesterday/etc. buckets, preserving the already-sorted
  // (newest-first) order within each.
  const groups: { label: string; items: TimelineItem[] }[] = [];
  for (const item of items) {
    const label = dayLabel(item.at);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup?.label === label) lastGroup.items.push(item);
    else groups.push({ label, items: [item] });
  }

  const jsonLd = items.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.slice(0, 20).map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://zobhira.com/${item.kind === "job" ? "jobs" : "contest"}/${item.id}`,
      name: item.title,
    })),
  } : null;

  return (
    <>
      <section className="section--dark deco-grain" data-theme="dark" style={{ paddingBlock: "clamp(40px, 6vw, 64px)" }}>
        {jsonLd && (
          // eslint-disable-next-line react/no-danger
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        )}
        <div className="container">
          <span className="chip chip--success" style={{ marginBottom: 12 }}>
            <span className="footer-pulse-dot" aria-hidden="true" style={{ marginRight: 4 }} />
            Today
          </span>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", fontWeight: 700, margin: "0 0 8px", color: "var(--color-text-onDark)" }}>
            Added today
          </h1>
          <p style={{ color: "var(--color-text-onDark-muted)", fontSize: 14.5, margin: "0 0 16px" }}>
            Everything new in the last 24 hours. You&apos;re seeing it early.
          </p>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-2xl)", color: "var(--color-signal)" }}>
            <CountUp value={last24hCount} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--color-text-onDark-muted)", marginLeft: 10 }}>
              new in the last 24 hours
            </span>
          </div>
        </div>
      </section>

      <main className="container" style={{ paddingBlock: 32, maxWidth: 760 }}>
        {items.length === 0 ? (
          <div className="jobs-empty-state" style={{ textAlign: "center" }}>
            <p style={{ color: "var(--color-text-muted)", fontSize: 14.5, margin: "0 0 16px" }}>
              Nothing new in the last 24 hours. Check back tonight.
            </p>
            <Link href="/jobs" className="btn btn-primary" style={{ textDecoration: "none" }}>
              Browse all roles
            </Link>
          </div>
        ) : (
          <div className="timeline">
            {groups.map((group) => (
              <div key={group.label}>
                <div className="timeline-day-label">{group.label}</div>
                {group.items.map((item) => (
                  <TimelineEntry key={`${item.kind}-${item.id}`} item={item} />
                ))}
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
