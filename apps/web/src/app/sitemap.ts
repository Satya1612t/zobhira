import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { allListingSlugs, MIN_LISTINGS_TO_INDEX } from "@/lib/designationCities";
import { SHOW_UNRELEASED_NAV } from "@/lib/authNavFlags";

const BASE_URL = "https://zobhira.com";

// No database is reachable during the Docker build stage, so this can't be
// statically generated at build time — see the same note in
// app/(main)/layout.tsx.
export const dynamic = "force-dynamic";

// /login is noindex (see its own metadata), /profile is a static mockup with
// no real per-user content yet, and /progress just redirects out to the
// admin app — none of the three belong in a sitemap search engines crawl.
// /contest is excluded in production too — it 404s there (see
// authNavFlags.ts), so submitting it to search engines would just be
// submitting 404s.
const STATIC_ROUTES: Array<{
  path: string;
  priority: number;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
}> = [
  { path: "/", priority: 1, changeFrequency: "hourly" },
  { path: "/jobs", priority: 0.9, changeFrequency: "hourly" },
  ...(SHOW_UNRELEASED_NAV ? [{ path: "/contest", priority: 0.9, changeFrequency: "hourly" as const }] : []),
  { path: "/today", priority: 0.8, changeFrequency: "hourly" },
  { path: "/certifications", priority: 0.8, changeFrequency: "weekly" },
  { path: "/about", priority: 0.5, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.4, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // `formattedDescription: { not: null }` mirrors the detail page's own
  // visibility gate (jobs/[id]/page.tsx notFound()s a job with no formatted
  // description, same as jobQuery.ts's listing filter). Without it, stub
  // jobs (fetched but not yet formatted) would enter the sitemap and 404
  // when a crawler visits them — a documented cause of soft-404 penalties.
  const VISIBLE_JOB = { isActive: true, formattedDescription: { not: null } } as const;
  const [jobs, contests, activeJobsForCounts, certifications] = await Promise.all([
    prisma.job.findMany({ where: VISIBLE_JOB, select: { id: true, lastScrapedAt: true } }),
    SHOW_UNRELEASED_NAV
      ? prisma.contest.findMany({ where: { isActive: true }, select: { id: true, lastScrapedAt: true } })
      : Promise.resolve([]),
    prisma.job.findMany({ where: VISIBLE_JOB, select: { tags: true, location: true } }),
    // Published only — a draft slug in the sitemap causes the same soft-404
    // penalty the stub-job comment above warns about.
    prisma.certification.findMany({
      where: { publishStatus: "published" },
      select: { slug: true, updatedAt: true },
    }),
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

  const certificationEntries: MetadataRoute.Sitemap = certifications.map((cert) => ({
    url: `${BASE_URL}/certifications/${cert.slug}`,
    lastModified: cert.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticEntries, ...jobEntries, ...contestEntries, ...listingEntries, ...certificationEntries];
}
