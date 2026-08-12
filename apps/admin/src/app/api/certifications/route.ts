import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/firebase-admin";
import { writeAuditLog } from "@/lib/auditLog";

const PAGE_SIZE = 50;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

// priceAmount is Prisma Decimal — NextResponse.json() can't serialize it raw
// (build spec trap 1.1), so collapse to number|null at the boundary.
function serialize<T extends { priceAmount: Prisma.Decimal | null }>(c: T) {
  return { ...c, priceAmount: c.priceAmount == null ? null : Number(c.priceAmount) };
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  const sp = new URL(request.url).searchParams;
  const q = sp.get("q")?.trim();
  const publishStatus = sp.get("publishStatus") || undefined;
  const priceType = sp.get("priceType") || undefined;
  const category = sp.get("category") || undefined;
  const providerSlug = sp.get("providerSlug") || undefined;
  const needsVerify = sp.get("needsVerify") === "true";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);

  const where: Prisma.CertificationWhereInput = {
    ...(publishStatus ? { publishStatus } : {}),
    ...(priceType ? { priceType } : {}),
    ...(category ? { category } : {}),
    ...(providerSlug ? { providerSlug } : {}),
    // "Needs verifying" = never verified OR verified over 90 days ago.
    ...(needsVerify
      ? { OR: [{ verifiedAt: null }, { verifiedAt: { lt: new Date(Date.now() - NINETY_DAYS_MS) } }] }
      : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { provider: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  // Stalest-first when hunting for rows to verify; otherwise newest-first.
  const orderBy: Prisma.CertificationOrderByWithRelationInput = needsVerify
    ? { verifiedAt: { sort: "asc", nulls: "first" } }
    : { createdAt: "desc" };

  const [certifications, total] = await Promise.all([
    prisma.certification.findMany({
      where,
      orderBy,
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.certification.count({ where }),
  ]);

  return NextResponse.json({
    certifications: certifications.map(serialize),
    total,
    page,
    pageSize: PAGE_SIZE,
  });
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const slug = String(body.slug ?? "").trim();
  const title = String(body.title ?? "").trim();
  const provider = String(body.provider ?? "").trim();
  const url = String(body.url ?? "").trim();
  const category = String(body.category ?? "").trim();

  if (!slug || !title || !provider || !url || !category) {
    return NextResponse.json(
      { error: "slug, title, provider, url and category are required" },
      { status: 400 }
    );
  }
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: "slug must be lowercase, hyphen-separated" }, { status: 400 });
  }

  const existing = await prisma.certification.findUnique({ where: { slug }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: "A certification with this slug already exists" }, { status: 409 });
  }

  const created = await prisma.certification.create({
    data: {
      slug,
      title,
      provider,
      providerSlug: String(body.providerSlug ?? "").trim() || provider.toLowerCase(),
      url,
      category,
      // A manual add is a draft like everything else — publishing is a
      // separate, verified action (see the [id] PATCH publish guard).
      publishStatus: "draft",
    },
  });

  writeAuditLog({
    adminEmail: admin.email,
    action: "certification.create",
    targetType: "certification",
    targetId: created.id,
    metadata: { slug },
  });

  return NextResponse.json(serialize(created), { status: 201 });
}
