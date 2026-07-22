import Link from "next/link";
import type { JobListItem } from "@/lib/jobQuery";
import { CompanyLogo } from "./CompanyLogo";

export function SimilarJobCard({ job }: { job: JobListItem }) {
  return (
    <Link
      href={`/jobs/${job.id}`}
      style={{
        display: "block",
        flexShrink: 0,
        width: 260,
        padding: "22px 20px",
        borderRadius: "var(--radius)",
        background: "var(--surface)",
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow-card)",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
        <CompanyLogo logoUrl={job.logoUrl} company={job.company} size={44} />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: 15.5,
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {job.title}
          </div>
          <div
            style={{
              color: "var(--ink-muted)",
              marginTop: 3,
              fontSize: 13,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {job.company}
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: 16,
          fontFamily: "var(--font-mono)",
          fontSize: 11.5,
          color: "var(--ink-faint)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {job.location ?? "Location unknown"}
        {job.workplaceType !== "unknown" && ` · ${job.workplaceType}`}
      </div>
    </Link>
  );
}
