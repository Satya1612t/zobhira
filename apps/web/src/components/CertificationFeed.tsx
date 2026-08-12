"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CertificationItem } from "@/lib/certificationQuery";
import { CertificationCard } from "./CertificationCard";

type Filters = {
  priceType?: string;
  category?: string;
  level?: string;
};

export function CertificationFeed({
  initialCertifications,
  filters,
}: {
  initialCertifications: CertificationItem[];
  filters: Filters;
}) {
  const [certs, setCerts] = useState<CertificationItem[]>(initialCertifications);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const certsRef = useRef(certs);
  const loadingRef = useRef(false);
  const doneRef = useRef(false);

  useEffect(() => {
    certsRef.current = certs;
  }, [certs]);

  // A new filter set means a fresh list — reset so the sentinel re-fetches.
  useEffect(() => {
    setCerts(initialCertifications);
    doneRef.current = false;
    setDone(false);
  }, [initialCertifications]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || doneRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const res = await fetch("/api/certifications/more", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...filters, excludeIds: certsRef.current.map((c) => c.id) }),
      });
      if (!res.ok) return;
      const data: { certifications: CertificationItem[]; done: boolean } = await res.json();
      if (data.certifications.length > 0) {
        setCerts((prev) => [...prev, ...data.certifications]);
      }
      if (data.done) {
        doneRef.current = true;
        setDone(true);
      }
    } catch {
      // Transient — sentinel stays; next intersection retries.
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
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

  if (certs.length === 0) {
    return (
      <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>
        No certifications match these filters yet.
      </p>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
      {certs.map((cert) => (
        <CertificationCard key={cert.id} cert={cert} />
      ))}
      {!done && (
        <div ref={sentinelRef} style={{ minHeight: 20 }}>
          {loading && <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Loading…</span>}
        </div>
      )}
    </div>
  );
}
