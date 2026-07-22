import Link from "next/link";
import type { ContestListItem } from "@/lib/contestQuery";
import { CompanyLogo } from "./CompanyLogo";

const PLATFORM_LABELS: Record<string, string> = {
  dev_community: "DEV Community",
};

function daysUntil(deadline: Date): number {
  return Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function ContestCard({ contest }: { contest: ContestListItem }) {
  const deadline = contest.deadlineAt ? new Date(contest.deadlineAt) : null;
  const daysLeft = deadline ? daysUntil(deadline) : null;

  return (
    <Link
      href={`/contest/${contest.id}`}
      style={{
        display: "block",
        padding: "22px 24px",
        marginBottom: 14,
        borderRadius: "var(--radius)",
        background: "var(--surface)",
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow-card)",
        textDecoration: "none",
        color: "inherit",
        transition: "box-shadow 0.15s ease, border-color 0.15s ease",
      }}
    >
      <div style={{ display: "flex", gap: 16, alignItems: "center", minWidth: 0 }}>
        <CompanyLogo logoUrl={contest.logoUrl} company={contest.organizer ?? contest.title} size={52} />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: 18.5,
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {contest.title}
          </div>
          <div style={{ color: "var(--ink-muted)", marginTop: 4, fontSize: 14.5 }}>
            {contest.organizer ?? PLATFORM_LABELS[contest.platform] ?? contest.platform}
          </div>
        </div>
      </div>

      {contest.prizeSummary && (
        <div style={{ marginTop: 12 }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              padding: "3px 10px",
              borderRadius: 5,
              background: "var(--accent-soft)",
              color: "var(--accent)",
              fontWeight: 700,
            }}
          >
            🏆 {contest.prizeSummary}
          </span>
        </div>
      )}

      {contest.highlights.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {contest.highlights.slice(0, 2).map((highlight) => (
            <span
              key={highlight}
              style={{
                fontSize: 11.5,
                padding: "3px 9px",
                borderRadius: 5,
                background: "var(--bg)",
                color: "var(--ink)",
                border: "1px solid var(--line)",
                fontWeight: 600,
              }}
            >
              ✓ {highlight}
            </span>
          ))}
        </div>
      )}

      <div
        style={{
          marginTop: 14,
          fontFamily: "var(--font-mono)",
          fontSize: 12.5,
          color: "var(--ink-faint)",
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <span>{PLATFORM_LABELS[contest.platform] ?? contest.platform}</span>
        {contest.mode !== "unknown" && <span>· {contest.mode.replace("_", " ")}</span>}
        {deadline && (
          <span style={{ color: daysLeft !== null && daysLeft <= 7 ? "var(--warn)" : "var(--ink-faint)", fontWeight: 600 }}>
            · {daysLeft !== null && daysLeft >= 0 ? `${daysLeft}d left` : "deadline passed"} (
            {deadline.toLocaleDateString("en-US")})
          </span>
        )}
      </div>
    </Link>
  );
}
