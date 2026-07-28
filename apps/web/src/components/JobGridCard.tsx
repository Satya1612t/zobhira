import Link from "next/link";
import type { JobListItem } from "@/lib/jobQuery";
import { CompanyLogo } from "./CompanyLogo";

function formatSalary(job: {
  salaryMin: unknown;
  salaryMax: unknown;
  salaryCurrency: string | null;
}): string | null {
  if (!job.salaryMin && !job.salaryMax) return null;
  const currency = job.salaryCurrency ?? "";
  const min = job.salaryMin?.toString();
  const max = job.salaryMax?.toString();
  if (min && max) return `${currency} ${min} - ${max}`;
  return `${currency} ${min ?? max}`;
}

// Grid-style job card — homepage's "Featured roles" and /jobs's grid view.
// JobCard.tsx (the list/rail style) is the default for /jobs; this is the
// same visual system (shape-squircle, tinted logo tile) in a vertical stack.
export function JobGridCard({ job }: { job: JobListItem }) {
  const salary = formatSalary(job);

  return (
    <div className="job-grid-card shape-squircle" style={{ height: "100%" }}>
      <Link href={`/jobs/${job.id}`} style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", flex: 1, gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div className="job-card-logo-tile">
            <CompanyLogo logoUrl={job.logoUrl} company={job.company} size={44} />
          </div>
          {job.workplaceType !== "unknown" && (
            <span className="tag tag-neutral" style={{ textTransform: "capitalize" }}>
              {job.workplaceType}
            </span>
          )}
        </div>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "var(--text-base)", lineHeight: 1.3 }}>{job.title}</div>
        <div style={{ color: "var(--color-accent)", fontSize: 13.5, fontWeight: 600 }}>{job.company}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", fontSize: 12, color: "var(--color-text-muted)", marginTop: "auto" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {job.location ?? "Unknown"}
          </span>
          {salary && (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <circle cx="12" cy="12" r="2" />
              </svg>
              {salary}
            </span>
          )}
        </div>
      </Link>
      <Link
        href={`/jobs/${job.id}`}
        className="btn btn-secondary"
        style={{ width: "100%", marginTop: 12, textDecoration: "none" }}
      >
        View details
      </Link>
    </div>
  );
}
