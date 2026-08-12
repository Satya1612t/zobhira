import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CERTIFICATION_SELECT, mapCertification } from "@/lib/certificationQuery";
import { CertificationDetailActions } from "@/components/CertificationDetailActions";
import { CompanyLogo } from "@/components/CompanyLogo";
import { SHOW_CERTIFICATIONS } from "@/lib/authNavFlags";

export const dynamic = "force-dynamic";

const PRICE_LABEL: Record<string, string> = { free: "Free", freemium: "Free to learn", paid: "Paid" };

function priceText(priceType: string, priceAmount: number | null, currency: string | null): string {
  if (priceType !== "paid") return PRICE_LABEL[priceType] ?? priceType;
  if (priceAmount == null) return "Paid";
  const cur = currency ?? "INR";
  return cur === "INR" ? `₹${priceAmount.toLocaleString("en-IN")}` : `${cur} ${priceAmount.toLocaleString()}`;
}

async function getCert(slug: string) {
  const row = await prisma.certification.findFirst({
    where: { slug, publishStatus: "published" },
    select: CERTIFICATION_SELECT,
  });
  return row ? mapCertification(row) : null;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  if (!SHOW_CERTIFICATIONS) return { title: "Certification not found" };
  const cert = await getCert(params.slug);
  if (!cert) return { title: "Certification not found" };
  return {
    title: `${cert.title} — ${cert.provider}`,
    description: cert.summary ?? `${cert.title} by ${cert.provider}. ${PRICE_LABEL[cert.priceType] ?? ""} certification for students in India.`,
  };
}

export default async function CertificationDetailPage({ params }: { params: { slug: string } }) {
  // Gated off production until certifications ship — see authNavFlags.ts.
  if (!SHOW_CERTIFICATIONS) notFound();

  const cert = await getCert(params.slug);
  if (!cert) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: cert.title,
    description: cert.description ?? cert.summary ?? cert.title,
    provider: { "@type": "Organization", name: cert.provider },
    // Only emit an offer when a verified price exists — never an offer with no price.
    ...(cert.priceAmount != null
      ? { offers: { "@type": "Offer", price: cert.priceAmount, priceCurrency: cert.priceCurrency ?? "INR" } }
      : {}),
  };

  return (
    <main className="container" style={{ paddingBlock: 32, maxWidth: 820 }}>
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Link href="/certifications" style={{ fontSize: 13.5, color: "var(--color-text-muted)", textDecoration: "none" }}>
        ← All certifications
      </Link>

      <div style={{ display: "flex", gap: 16, alignItems: "center", margin: "18px 0 8px" }}>
        <div className="job-card-logo-tile" style={{ width: 56, height: 56, flexShrink: 0 }}>
          <CompanyLogo logoUrl={cert.providerLogoUrl} company={cert.provider} size={56} />
        </div>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-2xl)", fontWeight: 700, margin: 0, color: "var(--color-text)" }}>
            {cert.title}
          </h1>
          <div style={{ color: "var(--color-text-muted)", fontSize: 14, marginTop: 2 }}>{cert.provider}</div>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "12px 0 20px" }}>
        <span
          className="tag"
          style={{
            fontWeight: 600,
            color: cert.priceType === "paid" ? "var(--color-text-muted)" : "var(--color-success)",
            borderColor: cert.priceType === "paid" ? "var(--color-divider)" : "var(--color-success)",
          }}
        >
          {priceText(cert.priceType, cert.priceAmount, cert.priceCurrency)}
        </span>
        <span className="tag tag-neutral" style={{ textTransform: "capitalize" }}>{cert.level}</span>
        {cert.durationHours != null && <span className="tag tag-neutral">{cert.durationHours} hours</span>}
      </div>

      <div style={{ marginBottom: 24, maxWidth: 380 }}>
        <CertificationDetailActions certificationId={cert.id} link={cert.link} isAffiliate={cert.isAffiliate} />
      </div>

      {cert.description && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.65, color: "var(--color-text)" }}>
            {cert.description}
          </p>
        </div>
      )}

      {cert.highlights.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", fontWeight: 600, marginBottom: 10 }}>
            What you get
          </h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {cert.highlights.map((h) => (
              <li key={h} style={{ display: "flex", gap: 8, fontSize: 14.5, color: "var(--color-text)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 3 }}>
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}

      {cert.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {cert.tags.map((tag) => (
            <span key={tag} className="tag tag-outline">{tag}</span>
          ))}
        </div>
      )}
    </main>
  );
}
