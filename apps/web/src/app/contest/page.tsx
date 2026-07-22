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
    <main style={{ maxWidth: 1040, margin: "0 auto", padding: "22px 10px 40px" }}>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 26,
          fontWeight: 600,
          margin: 0,
          color: "var(--ink)",
        }}
      >
        Contests
      </h1>
      <p style={{ color: "var(--ink-muted)", marginTop: 5, marginBottom: 16, fontSize: 13.5 }}>
        {contests.length} open contest{contests.length === 1 ? "" : "s"} aggregated from DEV
        Community, sorted by soonest deadline.
      </p>

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
