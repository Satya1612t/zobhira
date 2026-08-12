"use client";

// The CTA fires a partner_click beacon, then the anchor navigates. sendBeacon
// survives the navigation away (a plain fetch often doesn't); never block the
// navigation on it. `link` is already the collapsed affiliate-or-plain URL
// from certificationQuery.ts — this component never sees url/affiliateUrl.
export function CertificationDetailActions({
  certificationId,
  link,
  isAffiliate,
}: {
  certificationId: string;
  link: string;
  isAffiliate: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="btn btn-primary job-apply-cta"
        onClick={() =>
          navigator.sendBeacon?.(
            "/api/track",
            new Blob(
              [JSON.stringify({ type: "partner_click", certificationId })],
              { type: "application/json" }
            )
          )
        }
      >
        Go to course
      </a>
      {isAffiliate && (
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
          If you enrol through this link we may earn a commission. It costs you nothing extra.
        </p>
      )}
    </div>
  );
}
