import { Marquee } from "@/components/ui/Marquee";

// Direction C "strap": plain text wordmarks in the site's own font (not
// each brand's own logotype — recreating a company's proprietary font/
// styling is a trademark concern, not just a style choice), against a dark
// section, under the approved non-endorsement label from
// zobhira-copy-and-seo.md §2 ("a true statement about your listings, not a
// claim about your customers").
export function TrustBar({ companies }: { companies: string[] }) {
  if (companies.length === 0) return null;

  return (
    <section className="section--dark" style={{ paddingBlock: "clamp(34px, 4.4vw, 54px)" }}>
      <p
        style={{
          textAlign: "center",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.42)",
          margin: "0 0 28px",
        }}
      >
        Companies with live openings this week
      </p>
      <Marquee durationSec={34}>
        {companies.map((company) => (
          <span
            key={company}
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "clamp(20px, 2.4vw, 28px)",
              color: "var(--color-text-onDark)",
              opacity: 0.85,
              whiteSpace: "nowrap",
            }}
          >
            {company}
          </span>
        ))}
      </Marquee>
    </section>
  );
}
