import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { JOB_SELECT } from "@/lib/jobQuery";
import { JobGridCard } from "@/components/JobGridCard";

// Programmatic SEO landing page for one (designation, city) pair — see
// Prompt 13 §1, "cluster 1." Only reachable when the URL slug matches a
// known designation x city combination (see designationCities.ts); the
// dispatcher in jobs/[id]/page.tsx 404s anything else before this renders.
export async function DesignationCityLanding({ designation, city }: { designation: string; city: string }) {
  const jobs = await prisma.job.findMany({
    where: {
      isActive: true,
      tags: { has: designation },
      location: { contains: city, mode: "insensitive" },
    },
    orderBy: { postedAt: "desc" },
    take: 50,
    select: JOB_SELECT,
  });

  // The dispatcher already checks the count for indexing purposes, but a
  // direct hit with zero matches (e.g. listings expired since the sitemap
  // was generated) still shouldn't render an empty page.
  if (jobs.length === 0) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ItemList",
        itemListElement: jobs.slice(0, 20).map((job, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `https://zobhira.com/jobs/${job.id}`,
          name: job.title,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://zobhira.com" },
          { "@type": "ListItem", position: 2, name: "Jobs", item: "https://zobhira.com/jobs" },
          { "@type": "ListItem", position: 3, name: `${designation} jobs in ${city}` },
        ],
      },
    ],
  };

  return (
    <main className="container" style={{ paddingBlock: 32 }}>
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="Breadcrumb" style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginBottom: 14 }}>
        <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>Home</Link>
        {" / "}
        <Link href="/jobs" style={{ color: "inherit", textDecoration: "none" }}>Jobs</Link>
        {" / "}
        <span style={{ color: "var(--color-text)" }}>{designation} in {city}</span>
      </nav>

      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", fontWeight: 700, margin: "0 0 8px" }}>
        {designation} jobs in {city}
      </h1>
      <p style={{ color: "var(--color-text-muted)", fontSize: 14.5, margin: "0 0 28px" }}>
        {jobs.length.toLocaleString()} open right now, updated today.{" "}
        <Link href={`/jobs?q=${encodeURIComponent(designation)}&location=${encodeURIComponent(city)}`} style={{ color: "var(--color-accent)", fontWeight: 600 }}>
          Search with filters &rarr;
        </Link>
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
        {jobs.map((job) => (
          <JobGridCard key={job.id} job={job} />
        ))}
      </div>
    </main>
  );
}
