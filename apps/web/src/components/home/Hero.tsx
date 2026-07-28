"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { JobListItem } from "@/lib/jobQuery";
import { CountUp } from "@/components/ui/CountUp";
import { JobCardCarousel } from "@/components/home/JobCardCarousel";

const POPULAR = ["Fresher", "Remote", "Internship", "Bengaluru", "Data"];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0 } },
};
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 0.61, 0.36, 1] as const } },
};

export function Hero({
  jobsCount,
  contestsCount,
  companiesCount,
  carouselJobs,
}: {
  jobsCount: number;
  contestsCount: number;
  companiesCount: number;
  carouselJobs: JobListItem[];
}) {
  const reduced = useReducedMotion();

  return (
    <section
      className="edge-arc-bottom"
      style={{
        position: "relative",
        overflow: "hidden",
        background: "var(--gradient-hero)",
        paddingTop: "clamp(48px, 7vw, 88px)",
        paddingBottom: "clamp(64px, 9vw, 112px)",
      }}
    >
      <div className="deco-grain" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
      <div
        className="deco-blur-orb deco-blur-orb--signal"
        style={{ top: "-120px", right: "-80px", opacity: 0.35 }}
        aria-hidden="true"
      />

      <div
        id="hero-grid"
        className="container"
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "minmax(0, 7fr) minmax(0, 5fr)",
          gap: "clamp(24px, 4vw, 56px)",
          alignItems: "center",
        }}
      >
        <motion.div initial="hidden" animate="show" variants={reduced ? undefined : container}>
          <motion.span variants={item} className="kicker eyebrow-rule">
            NEW OPENINGS EVERY MORNING
          </motion.span>

          <motion.h1
            variants={item}
            style={{
              fontSize: "var(--text-hero)",
              lineHeight: 1.04,
              margin: "16px 0 18px",
              fontWeight: 700,
            }}
          >
            Apply first.
            <br />
            <span style={{ color: "var(--color-accent)" }}>Get noticed.</span>
          </motion.h1>

          <motion.p
            variants={item}
            style={{ fontSize: "var(--text-lg)", lineHeight: 1.6, color: "var(--color-text-muted)", maxWidth: "52ch", margin: "0 0 28px" }}
          >
            Most openings get hundreds of applications in the first two days. Zobhira shows you
            what opened today, so you can apply while the list is still short.
          </motion.p>

          <motion.div variants={item} style={{ marginBottom: 22 }}>
            <Link href="/jobs" className="btn btn-primary" style={{ textDecoration: "none", borderRadius: "var(--radius-full)", padding: "10px 18px", width: "fit-content" }}>
              Find jobs
            </Link>
          </motion.div>

          <motion.p variants={item} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--color-text-muted)", margin: "0 0 26px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            {jobsCount.toLocaleString()} jobs open now &middot; {contestsCount} contests live &middot; checked today
          </motion.p>

          <motion.div variants={item} style={{ display: "flex", gap: "clamp(20px, 4vw, 40px)", flexWrap: "wrap", marginBottom: 24 }}>
            <div>
              <div className="stat-number" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26, color: "var(--color-accent)" }}>
                <CountUp value={jobsCount} />
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-muted)" }}>Jobs open</div>
            </div>
            <div>
              <div className="stat-number" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26, color: "var(--color-accent)" }}>
                <CountUp value={contestsCount} />
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-muted)" }}>Contests live</div>
            </div>
            <div>
              <div className="stat-number" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26, color: "var(--color-accent)" }}>
                <CountUp value={companiesCount} />
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-muted)" }}>Companies hiring</div>
            </div>
          </motion.div>

          <motion.div variants={item} className="cluster">
            {POPULAR.map((term) => (
              <Link key={term} href={`/jobs?q=${encodeURIComponent(term)}`} className="chip chip--accent" style={{ textDecoration: "none" }}>
                {term}
              </Link>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 0.61, 0.36, 1] as const }}
        >
          <JobCardCarousel jobs={carouselJobs} />
        </motion.div>
      </div>
    </section>
  );
}
