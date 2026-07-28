import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { JOB_SELECT, jobOrderBy } from "@/lib/jobQuery";
import { CONTEST_SELECT, CONTEST_ORDER_BY } from "@/lib/contestQuery";
import { JobCard } from "@/components/JobCard";
import { ContestCard } from "@/components/ContestCard";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileStats } from "@/components/profile/ProfileStats";
import { ProfileTabs } from "@/components/profile/ProfileTabs";
import { TABS, type ProfileTabKey } from "@/components/profile/tabs";
import { ApplicationsTab } from "@/components/profile/ApplicationsTab";
import { AlertsTab } from "@/components/profile/AlertsTab";
import { SettingsTab } from "@/components/profile/SettingsTab";
import Image from "next/image";
import { AspectBox } from "@/components/ui/AspectBox";

// No accounts exist yet (see /DESIGN.md) — every tab below renders sample
// data pulled from real jobs/contests in the DB (not invented rows), same
// honesty pattern as everywhere else in the app. Never indexed/followed —
// this is a design preview of a future account page, not real user data.
export const metadata: Metadata = {
  title: "Your profile",
  robots: { index: false, follow: false },
};

export default async function ProfilePage({ searchParams }: { searchParams?: { tab?: string } }) {
  const requestedTab = searchParams?.tab;
  const tab: ProfileTabKey = (TABS.find((t) => t.key === requestedTab)?.key ?? "saved") as ProfileTabKey;

  const [sampleJobs, sampleContests] = await Promise.all([
    prisma.job.findMany({ where: { isActive: true }, orderBy: jobOrderBy(), take: 4, select: JOB_SELECT }),
    prisma.contest.findMany({ where: { isActive: true }, orderBy: CONTEST_ORDER_BY, take: 2, select: CONTEST_SELECT }),
  ]);

  const applications = sampleJobs.map((j, i) => ({
    title: j.title,
    company: j.company,
    status: (["saved", "applied", "interviewing", "closed"] as const)[i % 4],
  }));

  const alerts = [
    { query: "Frontend Engineer", filters: ["Remote", "2+ years"], frequency: "Weekly email" },
    { query: "Data Scientist", filters: ["Bangalore"], frequency: "Weekly email" },
  ];

  return (
    <>
      <ProfileHeader name="Your name" memberSince="July 2026" />

      <main className="container" style={{ paddingBlock: "0 40px" }}>
        <div
          style={{
            padding: "10px 14px",
            background: "var(--color-surface)",
            border: "1px solid var(--color-divider)",
            borderRadius: "var(--radius-md)",
            fontSize: 12.5,
            color: "var(--color-signal-text)",
            fontWeight: 600,
            marginBottom: 20,
          }}
        >
          Design preview — sample data shown, not a real account yet.
        </div>

        <ProfileStats values={{ saved: sampleJobs.length, applications: applications.length, contests: sampleContests.length, searches: alerts.length }} />

        <div style={{ marginTop: 28, marginBottom: 20 }}>
          <ProfileTabs active={tab} />
        </div>

        {tab === "saved" && (
          sampleJobs.length > 0 ? (
            <div>{sampleJobs.map((job) => <JobCard key={job.id} job={job} />)}</div>
          ) : (
            <div className="jobs-empty-state" style={{ textAlign: "center" }}>
              <AspectBox ratio="16/10" style={{ maxWidth: 320, margin: "0 auto 16px" }}>
                <Image src="/illustrations/no-saved-jobs-yet.png" alt="No saved roles yet" fill style={{ objectFit: "contain" }} sizes="320px" />
              </AspectBox>
              <Link href="/jobs" className="btn btn-primary" style={{ textDecoration: "none" }}>
                Browse roles
              </Link>
            </div>
          )
        )}

        {tab === "applications" && <ApplicationsTab applications={applications} />}

        {tab === "contests" && (
          sampleContests.length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
              {sampleContests.map((c) => <ContestCard key={c.id} contest={c} />)}
            </div>
          ) : (
            <div className="jobs-empty-state" style={{ textAlign: "center" }}>
              <p style={{ color: "var(--color-text-muted)", fontSize: 14, margin: "0 0 16px" }}>
                You haven&apos;t entered any contests yet.
              </p>
              <Link href="/contest" className="btn btn-primary" style={{ textDecoration: "none" }}>
                Browse contests
              </Link>
            </div>
          )
        )}

        {tab === "alerts" && <AlertsTab alerts={alerts} />}

        {tab === "settings" && <SettingsTab />}
      </main>
    </>
  );
}
