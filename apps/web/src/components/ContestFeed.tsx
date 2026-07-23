"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ContestListItem } from "@/lib/contestQuery";
import { ContestCard } from "./ContestCard";
import { ContestCardSkeleton } from "./ContestCardSkeleton";

type Filters = {
  platform?: string;
};

// Fetched pages arrive as plain JSON — deadlineAt/startsAt land as ISO
// strings, unlike the initial server-rendered batch where Next.js
// preserves real Date objects. ContestCard calls .toLocaleDateString()/
// getTime() directly, so these are converted back before being added to
// state (same reviveDates pattern as JobFeed.tsx).
function reviveDates(contest: ContestListItem): ContestListItem {
  return {
    ...contest,
    startsAt: contest.startsAt ? new Date(contest.startsAt) : null,
    deadlineAt: contest.deadlineAt ? new Date(contest.deadlineAt) : null,
  };
}

export function ContestFeed({
  initialContests,
  filters,
}: {
  initialContests: ContestListItem[];
  filters: Filters;
}) {
  const [contests, setContests] = useState<ContestListItem[]>(initialContests);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const contestsRef = useRef(contests);
  const loadingRef = useRef(false);
  const doneRef = useRef(false);

  useEffect(() => {
    contestsRef.current = contests;
  }, [contests]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || doneRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const res = await fetch("/api/contests/more", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...filters,
          excludeIds: contestsRef.current.map((c) => c.id),
        }),
      });
      if (!res.ok) return;
      const data: { contests: ContestListItem[]; done: boolean } = await res.json();
      if (data.contests.length > 0) {
        setContests((prev) => [...prev, ...data.contests.map(reviveDates)]);
      }
      if (data.done) {
        doneRef.current = true;
        setDone(true);
      }
    } catch {
      // Transient failure — sentinel stays in view, next intersection retries.
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

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
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
      {contests.map((contest) => (
        <ContestCard key={contest.id} contest={contest} />
      ))}
      {!done && (
        <div ref={sentinelRef} style={{ minHeight: 20 }}>
          {loading && <ContestCardSkeleton />}
        </div>
      )}
    </div>
  );
}
