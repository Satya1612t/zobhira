"use client";

import { useEffect, useRef } from "react";
import type { JobListItem } from "@/lib/jobQuery";
import { SimilarJobCard } from "./SimilarJobCard";

const CARD_WIDTH = 260;
const CARD_GAP = 12;
const AUTO_SCROLL_INTERVAL_MS = 2800;

export function SimilarJobsRail({ jobs }: { jobs: JobListItem[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const container = containerRef.current;
    if (!container) return;

    const interval = setInterval(() => {
      if (pausedRef.current) return;
      const { scrollLeft, scrollWidth, clientWidth } = container;
      const atEnd = scrollLeft + clientWidth >= scrollWidth - 4;
      container.scrollTo({
        left: atEnd ? 0 : scrollLeft + CARD_WIDTH + CARD_GAP,
        behavior: "smooth",
      });
    }, AUTO_SCROLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}
      onTouchStart={() => (pausedRef.current = true)}
      onTouchEnd={() => (pausedRef.current = false)}
      style={{
        display: "flex",
        gap: CARD_GAP,
        overflowX: "auto",
        paddingBottom: 6,
        scrollSnapType: "x proximity",
      }}
    >
      {jobs.map((job) => (
        <div key={job.id} style={{ scrollSnapAlign: "start" }}>
          <SimilarJobCard job={job} />
        </div>
      ))}
    </div>
  );
}
