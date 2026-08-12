import Link from "next/link";
import type { CertificationItem } from "@/lib/certificationQuery";
import { CompanyLogo } from "./CompanyLogo";

function priceLabel(c: CertificationItem): string {
  if (c.priceType === "free") return "Free";
  if (c.priceType === "freemium") return "Free to learn";
  if (c.priceAmount == null) return "Paid";
  const cur = c.priceCurrency ?? "INR";
  return cur === "INR" ? `₹${c.priceAmount.toLocaleString("en-IN")}` : `${cur} ${c.priceAmount.toLocaleString()}`;
}

// Free/freemium get the success colour (the whole SEO play is the free
// angle); paid stays neutral. Featured uses --color-signal, sparingly.
function stripColor(c: CertificationItem): string {
  if (c.isFeatured) return "var(--color-signal)";
  if (c.priceType === "paid") return "var(--color-divider)";
  return "var(--color-success)";
}

export function CertificationCard({ cert }: { cert: CertificationItem }) {
  const overflowTags = Math.max(0, cert.tags.length - 3);
  const isFree = cert.priceType !== "paid";

  return (
    <Link
      href={`/certifications/${cert.slug}`}
      className="contest-card shape-squircle"
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <div className="contest-card-strip" style={{ background: stripColor(cert) }} />
      <div className="contest-card-body">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
            <div className="job-card-logo-tile" style={{ width: 40, height: 40 }}>
              <CompanyLogo logoUrl={cert.providerLogoUrl} company={cert.provider} size={40} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="contest-card-title">{cert.title}</div>
              <div className="contest-card-organizer">{cert.provider}</div>
            </div>
          </div>
          <span
            className="tag"
            style={{
              flexShrink: 0,
              color: isFree ? "var(--color-success)" : "var(--color-text-muted)",
              borderColor: isFree ? "var(--color-success)" : "var(--color-divider)",
              fontWeight: 600,
            }}
          >
            {priceLabel(cert)}
          </span>
        </div>

        {cert.summary && (
          <p style={{ margin: "12px 0 0", fontSize: 13.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
            {cert.summary}
          </p>
        )}

        {cert.highlights.length > 0 && (
          <ul className="contest-highlights">
            {cert.highlights.slice(0, 3).map((h) => (
              <li key={h}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {h}
              </li>
            ))}
          </ul>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: "auto", paddingTop: 12 }}>
          <span className="tag tag-neutral" style={{ textTransform: "capitalize" }}>{cert.level}</span>
          {cert.durationHours != null && <span className="tag tag-neutral">{cert.durationHours}h</span>}
          {cert.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="tag tag-outline">{tag}</span>
          ))}
          {overflowTags > 0 && <span className="tag tag-outline">+{overflowTags}</span>}
        </div>
      </div>
    </Link>
  );
}
