import Link from "next/link";
import { PartnerStats } from "@/components/PartnerStats";

export default function PartnerStatsPage() {
  return (
    <div>
      <Link href="/certifications" style={{ fontSize: 13, color: "var(--ink-muted)", textDecoration: "none" }}>
        ← Back to certifications
      </Link>
      <p style={{ color: "var(--ink-muted)", margin: "12px 0 16px", fontSize: 13.5 }}>
        Outbound clicks to partner course pages, grouped by provider. This is the negotiating
        artefact — lead with it when asking a partner for a better rate.
      </p>
      <PartnerStats />
    </div>
  );
}
