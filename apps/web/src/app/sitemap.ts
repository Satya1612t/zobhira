import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { allListingSlugs, MIN_LISTINGS_TO_INDEX } from "@/lib/designationCities";

const BASE_URL = "https://zobhira.com";

// /login is noindex (see its own metadata), /profile is a static mockup with
// no real per-user content yet, and /progress just redirects out to the
// admin app — none of the three belong in a sitemap search engines crawl.
const STATIC_ROUTES: Array<{
  path: string;
  priority: number;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
}> = [
  { path: "/", priority: 1, changeFrequency: "hourly" },
  { path: "/jobs", priority: 0.9, changeFrequency: "hourly" },
  { path: "/contest", priority: 0.9, changeFrequency: "hourly" },
  { path: "/today", priority: 0.8, changeFrequency: "hourly" },
  { path: "/about", priority: 0.5, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.4, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [jobs, contests, activeJobsForCounts] = await Promise.all([
    prisma.job.findMany({ where: { isActive: true }, select: { id: true, lastScrapedAt: true } }),
    prisma.contest.findMany({ where: { isActive: true }, select: { id: true, lastScrapedAt: true } }),
    prisma.job.findMany({ where: { isActive: true }, select: { tags: true, location: true } }),
  ]);

  // One in-memory pass over every active job rather than 58 x 12 separate
  // count() queries — designation x city landing pages only enter the
  // sitemap once they clear MIN_LISTINGS_TO_INDEX (see designationCities.ts).
  const listingEntries: MetadataRoute.Sitemap = allListingSlugs()
    .filter(({ designation, city }) => {
      const count = activeJobsForCounts.filter(
        (job) => job.tags.includes(designation) && job.location?.toLowerCase().includes(city.toLowerCase())
      ).length;
      return count >= MIN_LISTINGS_TO_INDEX;
    })
    .map(({ slug }) => ({
      url: `${BASE_URL}/jobs/${slug}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.5,
    }));

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: `${BASE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));

  const jobEntries: MetadataRoute.Sitemap = jobs.map((job) => ({
    url: `${BASE_URL}/jobs/${job.id}`,
    lastModified: job.lastScrapedAt,
    changeFrequency: "daily",
    priority: 0.6,
  }));

  const contestEntries: MetadataRoute.Sitemap = contests.map((contest) => ({
    url: `${BASE_URL}/contest/${contest.id}`,
    lastModified: contest.lastScrapedAt,
    changeFrequency: "daily",
    priority: 0.6,
  }));

  return [...staticEntries, ...jobEntries, ...contestEntries, ...listingEntries];
}
