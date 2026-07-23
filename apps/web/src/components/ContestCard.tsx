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
      className="card"
      style={{ height: "100%", display: "block", textDecoration: "none", color: "inherit" }}
    >
      <div style={{ display: "flex", gap: 16, alignItems: "center", minWidth: 0 }}>
        <CompanyLogo logoUrl={contest.logoUrl} company={contest.organizer ?? contest.title} size={48} />
        <div style={{ minWidth: 0 }}>
          <div className="card-title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {contest.title}
          </div>
          <div style={{ color: "var(--ink-muted)", marginTop: 4, fontSize: 13.5 }}>
            {contest.organizer ?? PLATFORM_LABELS[contest.platform] ?? contest.platform}
          </div>
        </div>
      </div>

      {contest.prizeSummary && (
        <div style={{ marginTop: 12 }}>
          <span className="tag tag-accent">🏆 {contest.prizeSummary}</span>
        </div>
      )}

      {contest.highlights.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {contest.highlights.slice(0, 2).map((highlight) => (
            <span key={highlight} className="tag tag-outline">
              ✓ {highlight}
            </span>
          ))}
        </div>
      )}

      <div className="card-meta" style={{ marginTop: 14, flexWrap: "wrap" }}>
        <span>{PLATFORM_LABELS[contest.platform] ?? contest.platform}</span>
        {contest.mode !== "unknown" && <span>· {contest.mode.replace("_", " ")}</span>}
        {deadline && (
          <span style={{ color: daysLeft !== null && daysLeft <= 7 ? "var(--warn)" : undefined, fontWeight: 600 }}>
            · {daysLeft !== null && daysLeft >= 0 ? `${daysLeft}d left` : "deadline passed"} (
            {deadline.toLocaleDateString("en-US")})
          </span>
        )}
      </div>
    </Link>
  );
}
