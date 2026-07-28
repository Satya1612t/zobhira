import Link from "next/link";
import { CompanyLogo } from "@/components/CompanyLogo";

export type TimelineItem =
  | { kind: "job"; id: string; title: string; company: string; logoUrl: string | null; location: string | null; at: Date }
  | { kind: "contest"; id: string; title: string; organizer: string | null; logoUrl: string | null; prizeSummary: string | null; at: Date };

function JobIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
function ContestIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
    </svg>
  );
}

export function TimelineEntry({ item }: { item: TimelineItem }) {
  const href = item.kind === "job" ? `/jobs/${item.id}` : `/contest/${item.id}`;
  const subtitle = item.kind === "job" ? [item.company, item.location].filter(Boolean).join(" · ") : item.organizer ?? "";

  return (
    <div className="timeline-row">
      <span className="timeline-time">
        {item.at.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" })}
      </span>
      <span className="timeline-node" aria-hidden="true" />
      <Link href={href} className="timeline-card">
        <div className="job-card-logo-tile" style={{ width: 36, height: 36, flexShrink: 0 }}>
          <CompanyLogo logoUrl={item.logoUrl} company={item.kind === "job" ? item.company : (item.organizer ?? item.title)} size={36} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {subtitle}
            </div>
          )}
        </div>
        <span className={`chip ${item.kind === "job" ? "chip--accent" : "chip--signal"}`} style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4 }}>
          {item.kind === "job" ? <JobIcon /> : <ContestIcon />}
          {item.kind === "job" ? "Job" : "Contest"}
        </span>
      </Link>
    </div>
  );
}
