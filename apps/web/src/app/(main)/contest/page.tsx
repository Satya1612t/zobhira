import { prisma } from "@/lib/prisma";
import { ContestFeed } from "@/components/ContestFeed";
import { buildContestsWhere, CONTEST_SELECT, CONTEST_ORDER_BY, type ContestSearchParams } from "@/lib/contestQuery";

export const dynamic = "force-dynamic";

export default async function ContestPage({
  searchParams,
}: {
  searchParams: ContestSearchParams;
}) {
  const { platform } = searchParams;
  const where = buildContestsWhere({ platform });

  const contests = await prisma.contest.findMany({
    where,
    orderBy: CONTEST_ORDER_BY,
    take: 50,
    select: CONTEST_SELECT,
  });

  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 24px 60px" }}>
      <h1 style={{ margin: "0 0 8px", fontSize: 32 }}>Live contests &amp; hackathons</h1>
      <p style={{ color: "var(--ink-muted)", marginTop: 0, marginBottom: 24, fontSize: 15, maxWidth: "60ch" }}>
        Compete in real-world challenges, sharpen your skills, and get noticed — refreshed on a
        daily schedule.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
        <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
          {contests.length} open contest{contests.length === 1 ? "" : "s"} · sorted by soonest deadline
        </span>
      </div>

      {contests.length === 0 ? (
        <p
          style={{
            color: "var(--ink-muted)",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius)",
            padding: 20,
          }}
        >
          No open contests found right now. Check back after the next scheduled scrape.
        </p>
      ) : (
        <ContestFeed initialContests={contests} filters={{ platform }} />
      )}
    </main>
  );
}
