import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ContestFeed } from "@/components/ContestFeed";
import Image from "next/image";
import { AspectBox } from "@/components/ui/AspectBox";
import { buildContestsWhere, CONTEST_SELECT, CONTEST_ORDER_BY, type ContestSearchParams } from "@/lib/contestQuery";
import { SHOW_UNRELEASED_NAV } from "@/lib/authNavFlags";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Open hackathons and coding contests",
  description: "Hackathons and coding contests with deadlines that haven't passed, updated every morning on Zobhira. Closed contests are removed automatically.",
};

export default async function ContestPage({
  searchParams,
}: {
  searchParams: ContestSearchParams;
}) {
  // Contests aren't ready for production yet — same gate as the nav links
  // that point here (Navbar/Sidebar/Footer), so a direct/shared URL can't
  // reach a page that's hidden everywhere else. See authNavFlags.ts.
  if (!SHOW_UNRELEASED_NAV) notFound();

  const { platform } = searchParams;
  const where = buildContestsWhere({ platform });

  const contests = await prisma.contest.findMany({
    where,
    orderBy: CONTEST_ORDER_BY,
    take: 50,
    select: CONTEST_SELECT,
  });

  const jsonLd = contests.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: contests.slice(0, 20).map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://zobhira.com/contest/${c.id}`,
      name: c.title,
    })),
  } : null;

  return (
    <>
      <section className="section--dark edge-diagonal-top deco-grain" data-theme="dark" style={{ position: "relative", overflow: "hidden", paddingBlock: "clamp(48px, 7vw, 80px)" }}>
        <div className="deco-blur-orb deco-blur-orb--signal" style={{ top: "-100px", right: "-60px" }} aria-hidden="true" />
        <div className="deco-blur-orb deco-blur-orb--accent" style={{ bottom: "-140px", left: "-100px" }} aria-hidden="true" />
        <div className="container" style={{ position: "relative" }}>
          <span className="kicker">OPEN FOR ENTRY</span>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", fontWeight: 700, margin: "10px 0 10px", color: "var(--color-text-onDark)" }}>
            Contests you can still enter
          </h1>
          <p style={{ color: "var(--color-text-onDark-muted)", fontSize: "var(--text-base)", maxWidth: "56ch", margin: "0 0 16px" }}>
            Hackathons and coding contests with deadlines that haven&apos;t passed. Closed ones
            come off the same day.
          </p>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--color-signal)" }}>
            {contests.length} open contest{contests.length === 1 ? "" : "s"} &middot; sorted by soonest deadline
          </span>
        </div>
      </section>

      <main className="container" style={{ paddingBlock: 32 }}>
        {jsonLd && (
          // eslint-disable-next-line react/no-danger
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        )}

        {contests.length === 0 ? (
          <div className="jobs-empty-state" style={{ maxWidth: 480, margin: "40px auto" }}>
            <AspectBox ratio="16/10" style={{ maxWidth: 360, margin: "0 auto 20px" }}>
              <Image src="/illustrations/no-contest-found.png" alt="No contests open right now" fill style={{ objectFit: "contain" }} sizes="360px" />
            </AspectBox>
            <p style={{ textAlign: "center", fontWeight: 600, marginBottom: 6 }}>Nothing open right now.</p>
            <p style={{ textAlign: "center", color: "var(--color-text-muted)", fontSize: 13.5, marginBottom: 16 }}>
              New contests get added most mornings. Meanwhile, have a look at jobs.
            </p>
            <div style={{ textAlign: "center" }}>
              <Link href="/jobs" className="btn btn-primary" style={{ textDecoration: "none" }}>
                Browse jobs
              </Link>
            </div>
          </div>
        ) : (
          <ContestFeed initialContests={contests} filters={{ platform }} />
        )}
      </main>
    </>
  );
}
