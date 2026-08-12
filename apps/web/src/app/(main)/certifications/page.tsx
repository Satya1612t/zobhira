import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SHOW_CERTIFICATIONS } from "@/lib/authNavFlags";
import { CertificationFeed } from "@/components/CertificationFeed";
import {
  buildCertificationsWhere,
  CERTIFICATION_SELECT,
  CERTIFICATION_ORDER_BY,
  mapCertification,
  type CertificationSearchParams,
} from "@/lib/certificationQuery";

// No database is reachable during the Docker build stage (see sitemap.ts).
export const dynamic = "force-dynamic";

// The free angle is the SEO play — queries like "free AI certification for
// students" have real volume and weak incumbents.
export const metadata: Metadata = {
  title: "Free & paid certifications for students in India",
  description:
    "A hand-picked list of free and paid certifications — AI, data, cloud, web and more. Only options worth your time, checked by a human, with the free ones surfaced first.",
};

const PRICE_FILTERS = [
  { value: "free", label: "Free" },
  { value: "freemium", label: "Free to learn" },
  { value: "paid", label: "Paid" },
];
const LEVEL_FILTERS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

function buildHref(current: CertificationSearchParams, key: keyof CertificationSearchParams, value: string): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) if (v) params.set(k, v);
  if (params.get(key) === value) params.delete(key);
  else params.set(key, value);
  const s = params.toString();
  return s ? `/certifications?${s}` : "/certifications";
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: "6px 13px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
    textDecoration: "none",
    border: `1px solid ${active ? "var(--color-accent)" : "var(--color-divider)"}`,
    background: active ? "var(--color-accent)" : "var(--color-surface)",
    color: active ? "var(--color-text-onDark, #fff)" : "var(--color-text-muted)",
  };
}

function FilterRow({
  title,
  options,
  paramKey,
  current,
}: {
  title: string;
  options: { value: string; label: string }[];
  paramKey: keyof CertificationSearchParams;
  current: CertificationSearchParams;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--color-text-muted)", marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {options.map((o) => (
          <Link key={o.value} href={buildHref(current, paramKey, o.value)} style={pillStyle(current[paramKey] === o.value)}>
            {o.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default async function CertificationsPage({ searchParams }: { searchParams: CertificationSearchParams }) {
  // Certifications aren't ready for production yet — same gate as the nav
  // links that point here (Navbar/Sidebar/Footer) and the sitemap. See
  // authNavFlags.ts.
  if (!SHOW_CERTIFICATIONS) notFound();

  const { priceType, category, level } = searchParams;
  const where = buildCertificationsWhere({ priceType, category, level });

  const [rows, categoryRows] = await Promise.all([
    prisma.certification.findMany({ where, orderBy: CERTIFICATION_ORDER_BY, take: 50, select: CERTIFICATION_SELECT }),
    prisma.certification.findMany({
      where: { publishStatus: "published" },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    }),
  ]);

  const certifications = rows.map(mapCertification);
  const categoryFilters = categoryRows.map((c) => ({ value: c.category, label: c.category }));

  return (
    <>
      <section className="section--dark edge-diagonal-top deco-grain" data-theme="dark" style={{ position: "relative", overflow: "hidden", paddingBlock: "clamp(48px, 7vw, 80px)" }}>
        <div className="deco-blur-orb deco-blur-orb--accent" style={{ bottom: "-140px", left: "-100px" }} aria-hidden="true" />
        <div className="container" style={{ position: "relative" }}>
          <span className="kicker">CERTIFICATIONS</span>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", fontWeight: 700, margin: "10px 0 10px", color: "var(--color-text-onDark)" }}>
            Free certifications worth doing (and the paid ones worth paying for)
          </h1>
          <p style={{ color: "var(--color-text-onDark-muted)", fontSize: "var(--text-base)", maxWidth: "58ch", margin: 0 }}>
            A short, hand-checked list — AI, data, cloud and web. We surface the free and
            free-to-learn options first, so a tight budget is never the reason you skip a credential.
          </p>
        </div>
      </section>

      <main className="container" style={{ paddingBlock: 32 }}>
        <div style={{ marginBottom: 24 }}>
          <FilterRow title="Price" options={PRICE_FILTERS} paramKey="priceType" current={searchParams} />
          {categoryFilters.length > 0 && (
            <FilterRow title="Category" options={categoryFilters} paramKey="category" current={searchParams} />
          )}
          <FilterRow title="Level" options={LEVEL_FILTERS} paramKey="level" current={searchParams} />
        </div>

        <CertificationFeed initialCertifications={certifications} filters={{ priceType, category, level }} />
      </main>
    </>
  );
}
