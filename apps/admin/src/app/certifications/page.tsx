import { CertificationsManager } from "@/components/CertificationsManager";

export default function CertificationsPage() {
  return (
    <div>
      <p style={{ color: "var(--ink-muted)", marginTop: 0, marginBottom: 16, fontSize: 13.5 }}>
        Hand-curated certification catalogue. Seeded rows land as <strong>draft</strong> and are
        invisible on the site until a human verifies the price/URL and publishes. Paid rows can&apos;t
        be published without a price.
      </p>
      <CertificationsManager />
    </div>
  );
}
