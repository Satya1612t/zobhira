import type { ReactNode } from "react";
import { unstable_cache } from "next/cache";
import { AppShell } from "@/components/AppShell";
import { Footer } from "@/components/Footer";
import { prisma } from "@/lib/prisma";

// force-dynamic here (not just the unstable_cache below) because there's no
// database reachable during the Docker build stage — it's an isolated build
// context with no network path to the postgres service — so any attempt at
// build-time static generation for a page under this layout fails outright,
// even pages with no Prisma calls of their own, since they still inherit
// this layout's data fetch. unstable_cache still caches the actual query
// result for 5 minutes at the data layer, so this only gives up the HTML
// shell being statically served, not the DB-query caching.
export const dynamic = "force-dynamic";

// Cached, not a live per-request fetch — counts revalidate every 5 minutes,
// which is plenty fresh for a sidebar chip.
const getSidebarCounts = unstable_cache(
  async () => {
    const [jobsCount, contestsCount] = await Promise.all([
      prisma.job.count({ where: { isActive: true } }),
      prisma.contest.count({ where: { isActive: true } }),
    ]);
    return { jobsCount, contestsCount };
  },
  ["sidebar-counts"],
  { revalidate: 300 }
);

export default async function MainLayout({ children }: { children: ReactNode }) {
  const { jobsCount, contestsCount } = await getSidebarCounts();

  return (
    <AppShell footer={<Footer />} jobsCount={jobsCount} contestsCount={contestsCount}>
      {children}
    </AppShell>
  );
}
