"use client";

import type { JobListItem } from "@/lib/jobQuery";
import { CompanyLogo } from "@/components/CompanyLogo";

// Animated product-UI background for the hero — ported from the "C1 Live
// Search" mockup, but built from real, currently-live jobs instead of
// placeholder card data, so the wall is literally the product rather than
// decoration standing in for it. Real logos where the job has one, same
// CompanyLogo fallback (initial tile) used everywhere else in the app when
// it doesn't.
function hoursAgo(date: Date | null): string {
  if (!date) return "recently";
  const hours = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60));
  if (hours <= 0) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatPay(job: JobListItem): string | null {
  if (!job.salaryMin && !job.salaryMax) return null;
  const currency = job.salaryCurrency ?? "";
  const min = job.salaryMin?.toString();
  const max = job.salaryMax?.toString();
  return min && max ? `${currency} ${min}-${max}` : `${currency} ${min ?? max}`;
}

// offset + direction + duration per column so columns don't march in
// lockstep — matches the source mockup's staggering.
const COLS = [
  { off: 0, dir: "up" as const, dur: 46 },
  { off: 2, dir: "down" as const, dur: 58 },
  { off: 4, dir: "up" as const, dur: 52 },
  { off: 1, dir: "down" as const, dur: 64 },
];

function WallCard({ job }: { job: JobListItem }) {
  const pay = formatPay(job);
  const tags = [job.workplaceType !== "unknown" ? job.workplaceType : null, job.employmentType].filter(
    (t): t is string => Boolean(t)
  );
  return (
    <div className="home-hero-wall-card">
      <div className="home-hero-wall-card-top">
        <div className="home-hero-wall-logo">
          <CompanyLogo logoUrl={job.logoUrl} company={job.company} size={50} />
        </div>
        <span className="home-hero-wall-when">{hoursAgo(job.postedAt)}</span>
      </div>
      <div className="home-hero-wall-role">{job.title}</div>
      <div className="home-hero-wall-org">
        {job.company}
        {job.location ? ` · ${job.location}` : ""}
      </div>
      <div className="home-hero-wall-tags">
        {tags.slice(0, 2).map((t) => (
          <span key={t} style={{ textTransform: "capitalize" }}>
            {t}
          </span>
        ))}
        {pay && <span className="pay">{pay}</span>}
      </div>
    </div>
  );
}

function bank(side: "l" | "r", depth: "near" | "far", cols: typeof COLS, jobs: JobListItem[]) {
  return (
    <div className="home-hero-wall-bank" data-side={side} data-depth={depth}>
      {cols.map((c, i) => {
        const seq = [...jobs.slice(c.off % jobs.length), ...jobs.slice(0, c.off % jobs.length)];
        return (
          <div key={i} className="home-hero-wall-col" data-dir={c.dir}>
            <div className="home-hero-wall-track" style={{ animationDuration: `${c.dur}s` }}>
              {/* doubled for a seamless loop */}
              {seq.map((job, j) => (
                <WallCard key={`a-${job.id}-${j}`} job={job} />
              ))}
              {seq.map((job, j) => (
                <WallCard key={`b-${job.id}-${j}`} job={job} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function HeroWall({ jobs }: { jobs: JobListItem[] }) {
  // Not enough real postings to fill four columns believably — skip the
  // wall rather than repeating the same 2-3 cards until it looks fake.
  if (jobs.length < 4) return null;
  return (
    <div className="home-hero-wall" aria-hidden="true">
      {bank("r", "far", COLS.slice(2, 4), jobs)}
    </div>
  );
}
