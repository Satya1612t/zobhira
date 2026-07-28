import { CountUp } from "@/components/ui/CountUp";

const STATS = [
  { key: "saved", label: "Saved roles" },
  { key: "applications", label: "Applications" },
  { key: "contests", label: "Contests entered" },
  { key: "searches", label: "Searches saved" },
] as const;

export function ProfileStats({ values }: { values: Record<(typeof STATS)[number]["key"], number> }) {
  return (
    <div className="profile-stats-row">
      {STATS.map((s) => (
        <div key={s.key} className="job-card" style={{ padding: 18, textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-2xl)", color: "var(--color-accent)" }}>
            <CountUp value={values[s.key]} />
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-muted)", marginTop: 4 }}>
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}
