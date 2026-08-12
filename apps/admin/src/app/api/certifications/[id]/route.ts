import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/firebase-admin";
import { writeAuditLog } from "@/lib/auditLog";

const LEVELS = new Set(["beginner", "intermediate", "advanced"]);
const PRICE_TYPES = new Set(["free", "freemium", "paid"]);
const PUBLISH_STATUSES = new Set(["draft", "published", "archived"]);
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function serialize<T extends { priceAmount: Prisma.Decimal | null }>(c: T) {
  return { ...c, priceAmount: c.priceAmount == null ? null : Number(c.priceAmount) };
}

function trimmed(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function nullableText(v: unknown): string | null {
  const t = trimmed(v);
  return t || null;
}
function stringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}
function numberOrNull(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  const cert = await prisma.certification.findUnique({ where: { id: params.id } });
  if (!cert) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(serialize(cert));
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  const existing = await prisma.certification.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Slug is immutable once published — a live slug is a URL Google has indexed.
  const nextSlug = trimmed(body.slug) || existing.slug;
  if (nextSlug !== existing.slug) {
    if (existing.publishedAt !== null) {
      return NextResponse.json({ error: "Slug cannot change after publishing" }, { status: 400 });
    }
    if (!SLUG_RE.test(nextSlug)) {
      return NextResponse.json({ error: "slug must be lowercase, hyphen-separated" }, { status: 400 });
    }
    const clash = await prisma.certification.findUnique({ where: { slug: nextSlug }, select: { id: true } });
    if (clash && clash.id !== existing.id) {
      return NextResponse.json({ error: "Another certification already uses this slug" }, { status: 409 });
    }
  }

  const level = LEVELS.has(body.level) ? body.level : existing.level;
  const priceType = PRICE_TYPES.has(body.priceType) ? body.priceType : existing.priceType;
  const publishStatus = PUBLISH_STATUSES.has(body.publishStatus) ? body.publishStatus : existing.publishStatus;
  const priceAmount = body.priceAmount === undefined ? existing.priceAmount : numberOrNull(body.priceAmount);

  // Publishing IS verification, and a paid row with no price can never go live
  // honestly. This guard holds whether we're publishing now or editing a row
  // that is already published.
  if (publishStatus === "published" && priceType === "paid" && (priceAmount === null || priceAmount === undefined)) {
    return NextResponse.json(
      { error: "A paid certification needs a price before it can be published." },
      { status: 400 }
    );
  }

  const data: Prisma.CertificationUpdateInput = {
    slug: nextSlug,
    title: trimmed(body.title) || existing.title,
    provider: trimmed(body.provider) || existing.provider,
    providerSlug: trimmed(body.providerSlug) || existing.providerSlug,
    providerLogoUrl: body.providerLogoUrl === undefined ? existing.providerLogoUrl : nullableText(body.providerLogoUrl),
    summary: body.summary === undefined ? existing.summary : nullableText(body.summary),
    description: body.description === undefined ? existing.description : nullableText(body.description),
    highlights: body.highlights === undefined ? existing.highlights : stringArray(body.highlights),
    category: trimmed(body.category) || existing.category,
    tags: body.tags === undefined ? existing.tags : stringArray(body.tags),
    level,
    priceType,
    priceAmount: priceAmount === null ? null : new Prisma.Decimal(priceAmount),
    priceCurrency: trimmed(body.priceCurrency) || existing.priceCurrency || "INR",
    durationHours: body.durationHours === undefined ? existing.durationHours : (numberOrNull(body.durationHours) ?? null),
    url: trimmed(body.url) || existing.url,
    affiliateUrl: body.affiliateUrl === undefined ? existing.affiliateUrl : nullableText(body.affiliateUrl),
    affiliateNetwork: body.affiliateNetwork === undefined ? existing.affiliateNetwork : nullableText(body.affiliateNetwork),
    isFeatured: body.isFeatured === undefined ? existing.isFeatured : Boolean(body.isFeatured),
    displayOrder: body.displayOrder === undefined ? existing.displayOrder : (numberOrNull(body.displayOrder) ?? existing.displayOrder),
    publishStatus,
    updatedAt: new Date(),
  };

  const wasPublished = existing.publishStatus === "published";
  const nowPublished = publishStatus === "published";

  // Publishing (or re-saving a published row, or an explicit "mark verified")
  // stamps verification in the same write — verification is what publishing
  // means, never a separate button someone forgets.
  let action: "certification.update" | "certification.publish" | "certification.unpublish" = "certification.update";
  if (nowPublished) {
    if (!wasPublished || body.markVerified) {
      data.verifiedAt = new Date();
      data.verifiedBy = admin.email;
    }
    if (!wasPublished) {
      data.publishedAt = existing.publishedAt ?? new Date();
      action = "certification.publish";
    }
  } else if (wasPublished) {
    action = "certification.unpublish";
  } else if (body.markVerified) {
    data.verifiedAt = new Date();
    data.verifiedBy = admin.email;
  }

  const updated = await prisma.certification.update({ where: { id: params.id }, data });

  writeAuditLog({
    adminEmail: admin.email,
    action,
    targetType: "certification",
    targetId: params.id,
    metadata: { slug: updated.slug, publishStatus },
  });

  return NextResponse.json(serialize(updated));
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;

  await prisma.certification.delete({ where: { id: params.id } }).catch(() => null);
  writeAuditLog({
    adminEmail: admin.email,
    action: "certification.delete",
    targetType: "certification",
    targetId: params.id,
  });
  return NextResponse.json({ deleted: true });
}
