import Link from "next/link";
import type { JobListItem } from "@/lib/jobQuery";
import { CompanyLogo } from "./CompanyLogo";
import { extractTechnologies } from "@/lib/jobInsights";

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

export function JobCard({ job }: { job: JobListItem }) {
  const salary = formatSalary(job);
  const topTechnologies = extractTechnologies(job.description, 3);
  return (
    <Link
      href={`/jobs/${job.id}`}
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
        <CompanyLogo logoUrl={job.logoUrl} company={job.company} size={52} />
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
            {job.title}
          </div>
          <div style={{ color: "var(--ink-muted)", marginTop: 4, fontSize: 14.5 }}>{job.company}</div>
        </div>
      </div>

      {topTechnologies.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {topTechnologies.map((tech) => (
            <span
              key={tech}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                padding: "3px 9px",
                borderRadius: 5,
                background: "var(--bg)",
                color: "var(--ink)",
                border: "1px solid var(--line)",
                fontWeight: 600,
              }}
            >
              {tech}
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
        <span>{job.location ?? "Location unknown"}</span>
        {job.workplaceType !== "unknown" && <span>· {job.workplaceType}</span>}
        {salary && <span>· {salary}</span>}
        {job.postedAt && <span>· posted {job.postedAt.toLocaleDateString("en-US")}</span>}
        {job.deadlineAt && (
          <span style={{ color: "var(--warn)" }}>· apply by {job.deadlineAt.toLocaleDateString("en-US")}</span>
        )}
      </div>
    </Link>
  );
}
