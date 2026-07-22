import { JobCardSkeleton } from "@/components/JobCardSkeleton";

export default function Loading() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 64px" }}>
      <div
        className="skeleton-shimmer"
        style={{
          width: 220,
          height: 30,
          borderRadius: "var(--radius-sm)",
          background: "linear-gradient(90deg, var(--line) 25%, var(--surface-hover) 37%, var(--line) 63%)",
          backgroundSize: "400% 100%",
          marginBottom: 10,
        }}
      />
      <div
        className="skeleton-shimmer"
        style={{
          width: 340,
          height: 14,
          borderRadius: "var(--radius-sm)",
          background: "linear-gradient(90deg, var(--line) 25%, var(--surface-hover) 37%, var(--line) 63%)",
          backgroundSize: "400% 100%",
          marginBottom: 28,
        }}
      />
      {Array.from({ length: 6 }).map((_, i) => (
        <JobCardSkeleton key={i} />
      ))}
    </main>
  );
}
