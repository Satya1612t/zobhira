import { Marquee } from "@/components/ui/Marquee";

type CompanyLogoRow = { company: string; logoUrl: string | null };

// Real scraped logo images (each company's actual mark), natural color, no
// section background — sits directly on the page. Only shows companies
// with a real logoUrl on file; no generated/fallback mark stands in for a
// missing one.
export function TrustBar({ companies }: { companies: CompanyLogoRow[] }) {
  const withLogo = companies.filter((c) => c.logoUrl);
  if (withLogo.length === 0) return null;

  return (
    <section style={{ paddingBlock: 32 }}>
      <div className="container" style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <Marquee durationSec={30}>
            {withLogo.map((c) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={c.company}
                src={c.logoUrl as string}
                alt={`${c.company} logo`}
                style={{ height: 52, width: "auto", objectFit: "contain" }}
              />
            ))}
          </Marquee>
        </div>
      </div>
    </section>
  );
}
