import { DbStats } from "@/components/DbStats";
import { SchedulerProgress } from "@/components/SchedulerProgress";
import { ContestSchedulerProgress } from "@/components/ContestSchedulerProgress";

export default function SchedulerPage() {
  return (
    <div>
      <p style={{ color: "var(--ink-muted)", marginTop: 0, marginBottom: 16, fontSize: 13.5 }}>
        Live status of the scheduled background scrape, tier by tier. Only one job sweep
        and one contest sweep can each run at a time (independently of each other).
      </p>
      <DbStats />
      <SchedulerProgress />

      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 18,
          fontWeight: 600,
          margin: "28px 0 12px",
          color: "var(--ink)",
        }}
      >
        Contests
      </h2>
      <ContestSchedulerProgress />
    </div>
  );
}
