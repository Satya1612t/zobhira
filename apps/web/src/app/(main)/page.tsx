import { prisma } from "@/lib/prisma";
import { JOB_SELECT, jobOrderBy, getPopularSearches, getTotalSearchActivity } from "@/lib/jobQuery";
import { CONTEST_SELECT, CONTEST_ORDER_BY } from "@/lib/contestQuery";
import { Hero } from "@/components/home/Hero";
import { TrustBar } from "@/components/home/TrustBar";
import { Services } from "@/components/home/Services";
import { FeaturedRoles } from "@/components/home/FeaturedRoles";
import { Trustability } from "@/components/home/Trustability";
import { LiveContests } from "@/components/home/LiveContests";
import { Community } from "@/components/home/Community";
import { Offers } from "@/components/home/Offers";
import { HomeSignupCta } from "@/components/HomeSignupCta";
import { SHOW_UNRELEASED_NAV } from "@/lib/authNavFlags";

export const dynamic = "force-dynamic";

// Thin Server Component — nine section components, in order, no inline
// style={{}} objects. See 02-homepage.md.
export default async function HomePage() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    jobsCount,
    contestsCount,
    featuredJobs,
    featuredContests,
    companyNames,
    popularSearches,
    totalSearches,
    newTodayCount,
  ] = await Promise.all([
    prisma.job.count({ where: { isActive: true } }),
    prisma.contest.count({ where: { isActive: true } }),
    prisma.job.findMany({ where: { isActive: true }, orderBy: jobOrderBy(), take: 8, select: JOB_SELECT }),
    prisma.contest.findMany({ where: { isActive: true }, orderBy: CONTEST_ORDER_BY, take: 4, select: CONTEST_SELECT }),
    prisma.job.findMany({
      where: { isActive: true },
      distinct: ["company"],
      take: 24,
      select: { company: true },
    }),
    getPopularSearches(6),
    getTotalSearchActivity(),
    prisma.job.count({ where: { isActive: true, firstSeenAt: { gte: startOfToday } } }),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Zobhira",
    url: "https://zobhira.com",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: "https://zobhira.com/jobs?q={search_term_string}" },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <div>
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Hero
        jobsCount={jobsCount}
        contestsCount={contestsCount}
        newTodayCount={newTodayCount}
        tickerJobs={featuredJobs.slice(0, 8)}
        tickerContests={featuredContests.slice(0, 4)}
      />
      <TrustBar companies={companyNames.map((c) => c.company)} />
      <Services />
      <FeaturedRoles jobs={featuredJobs} jobsCount={jobsCount} />
      <Trustability />
      {/* Contests aren't ready for production yet — see authNavFlags.ts. */}
      {SHOW_UNRELEASED_NAV && <LiveContests contests={featuredContests} />}
      <Community popularSearches={popularSearches} totalSearches={totalSearches} />
      <Offers />
      <HomeSignupCta jobsCount={jobsCount} contestsCount={contestsCount} />
    </div>
  );
}
