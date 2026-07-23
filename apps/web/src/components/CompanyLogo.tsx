// Tonal variants of the Industry Blue accent — a company with no logo
// gets an initial square that stays in-family with the site's palette
// instead of clashing with it.
const PALETTE = ["#003366", "#001e40", "#1f477b", "#4a4a4a"];

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function CompanyLogo({
  logoUrl,
  company,
  size,
}: {
  logoUrl: string | null;
  company: string;
  size: number;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={`${company} logo`}
        width={size}
        height={size}
        style={{ borderRadius: size / 5, objectFit: "contain", background: "var(--bg)" }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 5,
        background: colorFor(company || "?"),
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: size * 0.45,
        flexShrink: 0,
      }}
    >
      {(Array.from((company || "?").trim())[0] ?? "?").toUpperCase()}
    </div>
  );
}
