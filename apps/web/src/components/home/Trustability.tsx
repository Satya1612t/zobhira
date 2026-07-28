import Link from "next/link";
import { Reveal } from "@/components/ui/Reveal";

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

// Illustrative only — bar heights are fixed, not tied to a live query. The
// point is the shape of the curve (applications pile up fast), not an exact count.
const BARS = [
  { label: "Today", value: 18, marked: true },
  { label: "Day 1", value: 46, marked: false },
  { label: "Day 2", value: 88, marked: false },
  { label: "Day 3", value: 140, marked: false },
];
const MAX_BAR = 140;

function ApplicationsBar() {
  return (
    <div
      className="shape-blob"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid var(--color-divider-onDark)",
        padding: "32px 28px 24px",
      }}
    >
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.06em", color: "var(--color-text-onDark-muted)", marginBottom: 20 }}>
        APPLICATIONS ON A TYPICAL POSTING
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 20, height: 160 }}>
        {BARS.map((bar) => (
          <div key={bar.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, height: "100%", justifyContent: "flex-end", position: "relative" }}>
            {bar.marked && (
              <span
                style={{
                  position: "absolute",
                  top: -34,
                  left: "50%",
                  transform: "translateX(-50%)",
                  fontSize: 10.5,
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-signal)",
                  whiteSpace: "nowrap",
                  textAlign: "center",
                  lineHeight: 1.3,
                }}
              >
                You, if you
                <br />
                apply today
              </span>
            )}
            <div
              style={{
                width: "100%",
                maxWidth: 44,
                height: `${(bar.value / MAX_BAR) * 100}%`,
                borderRadius: "var(--radius-sm) var(--radius-sm) 0 0",
                background: bar.marked ? "var(--color-signal)" : "rgba(255,255,255,0.16)",
                boxShadow: bar.marked ? "0 0 0 3px rgba(240,162,2,0.22)" : undefined,
              }}
            />
            <span style={{ fontSize: 11, color: "var(--color-text-onDark-muted)" }}>{bar.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Trustability() {
  return (
    <section className="section section--dark edge-diagonal-top deco-grain" data-theme="dark" style={{ overflow: "hidden" }}>
      <div className="container" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "clamp(32px, 5vw, 64px)", alignItems: "center" }}>
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

        <Reveal delay={0.2}>
          <ApplicationsBar />
        </Reveal>
      </div>
    </section>
  );
}
