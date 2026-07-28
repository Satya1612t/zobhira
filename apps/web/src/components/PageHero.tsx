import type { ReactNode } from "react";

export function PageHero({ kicker, title, sub }: { kicker: string; title: ReactNode; sub?: string }) {
  return (
    <section className="section--dark edge-diagonal-top deco-grain" data-theme="dark" style={{ paddingBlock: "clamp(48px, 7vw, 80px)" }}>
      <div className="container">
        <span className="kicker">{kicker}</span>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", fontWeight: 700, margin: "10px 0 12px", color: "var(--color-text-onDark)", maxWidth: "20ch" }}>
          {title}
        </h1>
        {sub && (
          <p style={{ color: "var(--color-text-onDark-muted)", fontSize: "var(--text-base)", maxWidth: "60ch", margin: 0 }}>
            {sub}
          </p>
        )}
      </div>
    </section>
  );
}
