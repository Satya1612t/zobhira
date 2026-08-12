import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveCanonicalSkills, recordSkillMisses } from "@/lib/skillVocab";

export const runtime = "nodejs";

// jsonb has no column limits, so nothing else stops a 5 MB profile — cap here.
const MAX_ENTRIES = 20;
const MAX_SKILLS = 50;
const SHORT = 200;
const LONG = 2000;

function clamp(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
function nullable(v: unknown, max: number): string | null {
  const s = clamp(v, max);
  return s || null;
}

// Each section entry is reduced to its allowed keys, clamped, and dropped if it
// has no meaningful content (keyed on `required`).
function sanitizeEntries(
  raw: unknown,
  fields: { key: string; max: number }[],
  required: string,
): Record<string, string>[] {
  if (!Array.isArray(raw)) return [];
  const out: Record<string, string>[] = [];
  for (const item of raw.slice(0, MAX_ENTRIES)) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const entry: Record<string, string> = {};
    for (const f of fields) {
      const val = clamp(rec[f.key], f.max);
      if (val) entry[f.key] = val;
    }
    if (entry[required]) out.push(entry);
  }
  return out;
}

const SECTION_FIELDS = {
  education: [
    { key: "school", max: SHORT }, { key: "degree", max: SHORT }, { key: "field", max: SHORT },
    { key: "start", max: 40 }, { key: "end", max: 40 }, { key: "grade", max: 60 },
  ],
  experience: [
    { key: "company", max: SHORT }, { key: "role", max: SHORT },
    { key: "start", max: 40 }, { key: "end", max: 40 }, { key: "description", max: LONG },
  ],
  projects: [
    { key: "name", max: SHORT }, { key: "description", max: LONG },
    { key: "link", max: 300 }, { key: "tech", max: SHORT },
  ],
  achievements: [
    { key: "title", max: SHORT }, { key: "detail", max: LONG },
  ],
} as const;

async function loadProfile(userId: string) {
  const [user, profile, skills] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, email: true, phone: true, city: true } }),
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.userSkill.findMany({ where: { userId }, select: { canonical: true, proficiency: true } }),
  ]);
  return {
    basics: {
      fullName: user?.fullName ?? null,
      email: user?.email ?? null,
      phone: user?.phone ?? null,
      city: user?.city ?? null,
    },
    headline: profile?.headline ?? null,
    summary: profile?.summary ?? null,
    links: profile?.links ?? {},
    education: profile?.education ?? [],
    experience: profile?.experience ?? [],
    projects: profile?.projects ?? [],
    achievements: profile?.achievements ?? [],
    skills: skills.map((s) => s.canonical),
  };
}

export async function GET() {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json(await loadProfile(current.id));
}

export async function PUT(request: Request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const links = {
    github: nullable(body.links?.github, 300),
    linkedin: nullable(body.links?.linkedin, 300),
    portfolio: nullable(body.links?.portfolio, 300),
  };

  const profileData = {
    headline: nullable(body.headline, SHORT),
    summary: nullable(body.summary, LONG),
    links: links as Prisma.InputJsonValue,
    education: sanitizeEntries(body.education, [...SECTION_FIELDS.education], "school") as Prisma.InputJsonValue,
    experience: sanitizeEntries(body.experience, [...SECTION_FIELDS.experience], "company") as Prisma.InputJsonValue,
    projects: sanitizeEntries(body.projects, [...SECTION_FIELDS.projects], "name") as Prisma.InputJsonValue,
    achievements: sanitizeEntries(body.achievements, [...SECTION_FIELDS.achievements], "title") as Prisma.InputJsonValue,
  };

  // Skills: resolve to canonical vocabulary; record unknown terms as misses
  // (never store raw free text — that would fork the vocabulary).
  const rawSkills = Array.isArray(body.skills)
    ? body.skills.map((s: unknown) => String(s)).slice(0, MAX_SKILLS)
    : [];
  const { canonical, unknown } = await resolveCanonicalSkills(rawSkills);
  if (unknown.length) void recordSkillMisses(unknown.join(","));

  const writes: Prisma.PrismaPromise<unknown>[] = [
    prisma.userProfile.upsert({
      where: { userId: current.id },
      update: { ...profileData, updatedAt: new Date() },
      create: { userId: current.id, ...profileData },
    }),
    prisma.user.update({
      where: { id: current.id },
      data: {
        fullName: nullable(body.basics?.fullName, SHORT),
        phone: nullable(body.basics?.phone, 40),
        city: nullable(body.basics?.city, SHORT),
      },
    }),
    prisma.userSkill.deleteMany({ where: { userId: current.id } }),
  ];
  if (canonical.length) {
    writes.push(
      prisma.userSkill.createMany({
        data: canonical.map((c) => ({ userId: current.id, canonical: c })),
        skipDuplicates: true,
      })
    );
  }
  await prisma.$transaction(writes);

  const saved = await loadProfile(current.id);
  return NextResponse.json({ ...saved, unknownSkills: unknown });
}
