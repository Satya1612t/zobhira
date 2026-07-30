import Link from "next/link";
import { Reveal } from "@/components/ui/Reveal";
import { EarlyWinsLottie } from "@/components/home/EarlyWinsLottie";

const CARDS = [
  {
    title: "Fresh every morning",
    body: "New openings show up here before most people start looking. Check in once a day and you stay ahead.",
  },
  {
    title: "No dead links",
    body: "If a job closes or the link stops working, it comes off the board. You never waste an application.",
  },
  {
    title: "No repeats",
    body: "The same job posted twice shows up once. Your search stays clean.",
  },
];

export function Trustability() {
  return (
    <section className="section trustability-section section--dark edge-diagonal-top deco-grain" data-theme="dark" style={{ overflow: "hidden" }}>
      <div className="container trustability-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0,0.85fr) minmax(0,1.15fr)", gap: "clamp(32px, 5vw, 64px)", alignItems: "start" }}>
        <div>
          <Reveal>
            <span className="kicker">WHY BEING EARLY WINS</span>
            <h2 style={{ fontSize: "var(--text-3xl)", margin: "10px 0 8px" }}>
              The first 20 applications get read. The 200th usually doesn&apos;t.
            </h2>
            <p style={{ color: "var(--color-text-onDark-muted)", fontSize: "var(--text-base)", lineHeight: 1.6, maxWidth: "48ch", margin: "0 0 32px" }}>
              Recruiters open applications in the order they arrive. A job posted this morning has
              almost no competition. The same job next week has hundreds. Timing is the part of
              job hunting you can actually control.
            </p>
          </Reveal>

          <div className="stack-6">
            {CARDS.map((card, i) => (
              <Reveal key={card.title} delay={0.1 * i} style={{ marginBottom: i === CARDS.length - 1 ? 0 : 20 }}>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", margin: "0 0 4px", color: "var(--color-text-onDark)" }}>{card.title}</h3>
                <p style={{ color: "var(--color-text-onDark-muted)", fontSize: 13.5, lineHeight: 1.6, margin: 0, maxWidth: "42ch" }}>{card.body}</p>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.3}>
            <form
              method="get"
              action="/login"
              style={{ display: "flex", gap: 8, marginTop: 32, flexWrap: "wrap" }}
            >
              <input type="hidden" name="tab" value="signup" />
              <input
                className="input"
                type="email"
                name="email"
                placeholder="you@example.com"
                style={{ flex: "1 1 200px", minWidth: 160, borderRadius: "var(--radius-full)", background: "rgba(255,255,255,0.08)", border: "1px solid var(--color-divider-onDark)", color: "var(--color-text-onDark)" }}
              />
              <button type="submit" className="btn btn-primary" style={{ borderRadius: "var(--radius-full)", flexShrink: 0 }}>
                Set a daily alert
              </button>
            </form>
          </Reveal>
        </div>

        <Reveal delay={0.2} className="trustability-lottie-wrap" style={{ alignSelf: "center" }}>
          <EarlyWinsLottie />
        </Reveal>
      </div>
    </section>
  );
}
