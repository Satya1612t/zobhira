import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileTabs } from "@/components/profile/ProfileTabs";
import { TABS, type ProfileTabKey } from "@/components/profile/tabs";
import { SettingsTab } from "@/components/profile/SettingsTab";
import { ProfileEditor, type EditorProfile } from "@/components/profile/ProfileEditor";
import { SignOutButton } from "@/components/auth/SignOutButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your profile",
  robots: { index: false, follow: false },
};

const s = (v: unknown): string => (typeof v === "string" ? v : "");
function entries(v: unknown): Record<string, string>[] {
  return Array.isArray(v) ? (v as Record<string, string>[]) : [];
}

function EmptyState({ text, cta }: { text: string; cta?: { href: string; label: string } }) {
  return (
    <div className="jobs-empty-state" style={{ textAlign: "center", padding: "40px 0" }}>
      <p style={{ color: "var(--color-text-muted)", fontSize: 14, margin: "0 0 16px" }}>{text}</p>
      {cta && <Link href={cta.href} className="btn btn-primary" style={{ textDecoration: "none" }}>{cta.label}</Link>}
    </div>
  );
}

export default async function ProfilePage({ searchParams }: { searchParams?: { tab?: string } }) {
  const current = await getCurrentUser();
  if (!current) redirect("/login");

  const tab: ProfileTabKey = (TABS.find((t) => t.key === searchParams?.tab)?.key ?? "resume") as ProfileTabKey;

  const [user, profile, skills] = await Promise.all([
    prisma.user.findUnique({ where: { id: current.id }, select: { fullName: true, email: true, phone: true, city: true, createdAt: true } }),
    prisma.userProfile.findUnique({ where: { userId: current.id } }),
    prisma.userSkill.findMany({ where: { userId: current.id }, select: { canonical: true } }),
  ]);

  const links = (profile?.links ?? {}) as Record<string, unknown>;
  const initial: EditorProfile = {
    basics: { fullName: s(user?.fullName), email: user?.email ?? null, phone: s(user?.phone), city: s(user?.city) },
    headline: s(profile?.headline),
    summary: s(profile?.summary),
    links: { github: s(links.github), linkedin: s(links.linkedin), portfolio: s(links.portfolio) },
    education: entries(profile?.education),
    experience: entries(profile?.experience),
    projects: entries(profile?.projects),
    achievements: entries(profile?.achievements),
    skills: skills.map((sk) => sk.canonical),
  };

  const displayName = user?.fullName || (user?.email ? user.email.split("@")[0] : "Your profile");
  const memberSince = user?.createdAt
    ? user.createdAt.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "";

  return (
    <>
      <ProfileHeader name={displayName} memberSince={memberSince} />

      <main className="container" style={{ paddingBlock: "0 40px" }}>
        <div style={{ marginTop: 20, marginBottom: 20 }}>
          <ProfileTabs active={tab} />
        </div>

        {tab === "resume" && <ProfileEditor initial={initial} />}

        {/* saved / applications / contests / alerts have no backing tables yet
            (build spec §2.3) — honest empty states, never invented rows. */}
        {tab === "saved" && <EmptyState text="You haven't saved any roles yet." cta={{ href: "/jobs", label: "Browse roles" }} />}
        {tab === "applications" && <EmptyState text="Application tracking is coming soon." />}
        {tab === "contests" && <EmptyState text="You haven't entered any contests yet." cta={{ href: "/jobs", label: "Browse roles" }} />}
        {tab === "alerts" && <EmptyState text="Job alerts are coming soon." />}

        {tab === "settings" && (
          <div>
            <SettingsTab />
            <div style={{ marginTop: 24 }}>
              <SignOutButton />
            </div>
          </div>
        )}
      </main>
    </>
  );
}
