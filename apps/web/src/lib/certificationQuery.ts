import type { Prisma } from "@prisma/client";

// Explicit select from day one (jobQuery.ts's JOB_SELECT had to be retrofitted
// painfully — start correct here). `url` and `affiliateUrl` are BOTH selected
// so we can collapse them, but they are NEVER exposed separately to a
// component: mapCertification() below turns them into one `link` field. If a
// component ever renders `url` while an affiliate link exists, the click earns
// nothing and nobody notices for months (build spec rule 0.4).
export const CERTIFICATION_SELECT = {
  id: true,
  slug: true,
  title: true,
  provider: true,
  providerSlug: true,
  providerLogoUrl: true,
  summary: true,
  description: true,
  highlights: true,
  category: true,
  tags: true,
  level: true,
  priceType: true,
  priceAmount: true,
  priceCurrency: true,
  durationHours: true,
  url: true,
  affiliateUrl: true,
  isFeatured: true,
  updatedAt: true,
} satisfies Prisma.CertificationSelect;

type CertificationRow = Prisma.CertificationGetPayload<{ select: typeof CERTIFICATION_SELECT }>;

// The client-visible shape: no raw url/affiliateUrl, a single collapsed link,
// priceAmount as a plain number (it's a Prisma Decimal on the row — trap 1.1).
export type CertificationItem = {
  id: string;
  slug: string;
  title: string;
  provider: string;
  providerSlug: string;
  providerLogoUrl: string | null;
  summary: string | null;
  description: string | null;
  highlights: string[];
  category: string;
  tags: string[];
  level: string;
  priceType: string;
  priceAmount: number | null;
  priceCurrency: string | null;
  durationHours: number | null;
  link: string;
  isAffiliate: boolean;
  isFeatured: boolean;
  updatedAt: Date;
};

// The single source of truth for which link a click uses. Always affiliate
// first, plain URL as fallback — so the feature ships and earns without a
// second deploy once a network approves us.
export function partnerLink(c: { url: string; affiliateUrl: string | null }): string {
  return c.affiliateUrl ?? c.url;
}

export function mapCertification(row: CertificationRow): CertificationItem {
  const { url, affiliateUrl, priceAmount, ...rest } = row;
  return {
    ...rest,
    link: partnerLink({ url, affiliateUrl }),
    isAffiliate: affiliateUrl != null,
    priceAmount: priceAmount == null ? null : Number(priceAmount),
  };
}

export type CertificationSearchParams = {
  priceType?: string;
  category?: string;
  level?: string;
};

// Base clause is publishStatus:'published' — NOT isActive. A draft must be
// unreachable even by direct URL.
export function buildCertificationsWhere({
  priceType,
  category,
  level,
}: CertificationSearchParams): Prisma.CertificationWhereInput {
  return {
    publishStatus: "published",
    ...(priceType ? { priceType } : {}),
    ...(category ? { category } : {}),
    ...(level ? { level } : {}),
  };
}

// Featured first, then curator's manual order, then newest. Matches the
// admin's intent — displayOrder is how a human ranks the catalogue.
export const CERTIFICATION_ORDER_BY: Prisma.CertificationOrderByWithRelationInput[] = [
  { isFeatured: "desc" },
  { displayOrder: "asc" },
  { createdAt: "desc" },
];
