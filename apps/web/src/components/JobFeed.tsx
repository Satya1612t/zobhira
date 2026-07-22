"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { JobListItem } from "@/lib/jobQuery";
import { JobCard } from "./JobCard";
import { JobCardSkeleton } from "./JobCardSkeleton";

type Filters = {
  q?: string;
  location?: string;
  workplaceType?: string;
  postedWithin?: string;
  sort?: string;
  experienceLevel?: string;
};

// Fetched pages arrive as plain JSON, so Date fields land as ISO strings —
// unlike the initial server-rendered batch, where Next.js preserves real
// Date objects across the server/client boundary. JobCard calls
// `.toLocaleDateString()` directly on these, so they're converted back to
// Date here before being added to state.
function reviveDates(job: JobListItem): JobListItem {
  return {
    ...job,
    postedAt: job.postedAt ? new Date(job.postedAt) : null,
    deadlineAt: job.deadlineAt ? new Date(job.deadlineAt) : null,
  };
}

export function JobFeed({
  initialJobs,
  filters,
  liveWindowHours,
  initialMode = "filtered",
}: {
  initialJobs: JobListItem[];
  filters: Filters;
  liveWindowHours?: number;
  initialMode?: "filtered" | "general";
}) {
  const [jobs, setJobs] = useState<JobListItem[]>(initialJobs);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  // Index in `jobs` where the general (unfiltered) fallback listing starts,
  // so a divider can explain why unrelated jobs suddenly appear — only
  // meaningful when filters were actually active. If the server already
  // fell back to general mode for the initial batch (no filtered matches
  // at all), that boundary is index 0 — every initial job is already a
  // fallback result.
  const [generalStartIndex, setGeneralStartIndex] = useState<number | null>(
    initialMode === "general" ? 0 : null
  );

  const jobsRef = useRef(jobs);
  const modeRef = useRef<"filtered" | "general">(initialMode);
  const loadingRef = useRef(false);
  const doneRef = useRef(false);

  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  const hasActiveFilters = Boolean(
    filters.q || filters.location || filters.workplaceType || filters.postedWithin || filters.experienceLevel
  );

  const loadMore = useCallback(async () => {
    if (loadingRef.current || doneRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const res = await fetch("/api/jobs/more", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...filters,
          mode: modeRef.current,
          excludeIds: jobsRef.current.map((j) => j.id),
          liveWindowHours,
        }),
      });
      if (!res.ok) return;
      const data: { jobs: JobListItem[]; mode: "filtered" | "general"; done: boolean } = await res.json();

      if (modeRef.current === "filtered" && data.mode === "general" && generalStartIndex === null) {
        setGeneralStartIndex(jobsRef.current.length);
      }
      modeRef.current = data.mode;

      if (data.jobs.length > 0) {
        setJobs((prev) => [...prev, ...data.jobs.map(reviveDates)]);
      }
      if (data.done) {
        doneRef.current = true;
        setDone(true);
      }
    } catch {
      // Transient failure — the sentinel stays in view, so the next
      // scroll-triggered intersection just retries.
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, liveWindowHours]);

  const loadMoreRef = useRef(loadMore);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMoreRef.current();
      },
      { rootMargin: "600px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div>
      {jobs.map((job, idx) => (
        <div key={job.id}>
          {hasActiveFilters && generalStartIndex === idx && (
            <div
              style={{
                margin: "4px 0 12px",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                background: "var(--surface-hover)",
                color: "var(--ink-muted)",
                fontSize: 12.5,
              }}
            >
              No more matches for your filters — showing other recent listings
            </div>
          )}
          <JobCard job={job} />
        </div>
      ))}
      {!done && (
        <div ref={sentinelRef} style={{ minHeight: 20 }}>
          {loading && <JobCardSkeleton />}
        </div>
      )}
    </div>
  );
}
