import type { ReactNode } from "react";
import { unstable_cache } from "next/cache";
import { AppShell } from "@/components/AppShell";
import { Footer } from "@/components/Footer";
import { prisma } from "@/lib/prisma";

// Cached, not a live per-request fetch — this layout wraps every page,
// including the static About/Privacy/Terms/Contact pages, so an uncached
// Prisma call here would force all of them into dynamic rendering. Counts
// revalidate every 5 minutes, which is plenty fresh for a sidebar chip.
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
