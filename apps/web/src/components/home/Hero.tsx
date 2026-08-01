"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { JobListItem } from "@/lib/jobQuery";
import type { ContestListItem } from "@/lib/contestQuery";
import { HeroWall } from "@/components/home/HeroWall";
import { HeroLiveConsole } from "@/components/home/HeroLiveConsole";

// "C1: Live Search" — ported from the Direction C mockup set
// (C1-live-search.html), reimplemented in this app's own token system
// (no Space Grotesk, no hardcoded hex) and driven by real data throughout:
// the background "wall" is real live jobs, the search demo cascade is real
// jobs/contests, and the counts are the real totals — only the rotating
// headline noun and the demo's typed query phrases are scripted copy.
const NOUNS = ["first job", "internship", "walk-in", "hackathon"];

function RotatingNoun() {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setI((n) => (n + 1) % NOUNS.length), 2600);
    return () => clearInterval(id);
  }, [reduced]);

  return (
    <span style={{ position: "relative", display: "inline-block", whiteSpace: "nowrap" }}>
      <AnimatePresence mode="wait">
        <motion.span
          key={NOUNS[i]}
          initial={reduced ? false : { opacity: 0, y: 10, rotateX: -55 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          exit={reduced ? undefined : { opacity: 0, y: -10, rotateX: 55 }}
          transition={{ duration: 0.42, ease: [0.2, 0, 0, 1] }}
          style={{ display: "inline-block", color: "var(--color-accent)" }}
        >
          {NOUNS[i]}
        </motion.span>
      </AnimatePresence>
      <span
        aria-hidden="true"
        style={{ position: "absolute", left: -2, right: -2, bottom: "0.06em", height: "0.14em", background: "var(--color-signal)", opacity: 0.34, borderRadius: 3, zIndex: -1 }}
      />
    </span>
  );
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0 } } };
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 0.61, 0.36, 1] as const } } };

export function Hero({
  jobsCount,
  contestsCount,
  newTodayCount,
  tickerJobs,
  tickerContests,
}: {
  jobsCount: number;
  contestsCount: number;
  newTodayCount: number;
  tickerJobs: JobListItem[];
  tickerContests: ContestListItem[];
}) {
  const reduced = useReducedMotion();
  // Lifted out of HeroLiveConsole so the wall-of-job-cards background can
  // freeze on whatever it's showing the moment someone clicks into search,
  // instead of continuing to scroll behind them while they're mid-type —
  // and resume once the scripted demo search takes back over.
  const [searchHandedOver, setSearchHandedOver] = useState(false);

  return (
    <section className="home-hero">
      <HeroWall jobs={tickerJobs} paused={searchHandedOver} />
      <div className="home-hero-veil" aria-hidden="true" />

      <motion.div
        initial="hidden"
        animate="show"
        variants={reduced ? undefined : container}
        className="container home-hero-mid"
      >
        <motion.span variants={item} className="chip chip--success" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span className="footer-pulse-dot" />
          {newTodayCount > 0 ? `${newTodayCount} new opportunities added today` : "Live listings, updated all day"}
        </motion.span>

        <motion.h1
          variants={item}
          style={{ fontSize: "clamp(1.35rem, 0.8rem + 1.4vw, 2rem)", lineHeight: 1.15, margin: "20px auto 0", maxWidth: "18ch", fontWeight: 700 }}
        >
          Find your <RotatingNoun />
          <br />
          before everyone else.
        </motion.h1>

        <motion.p
          variants={item}
          style={{ margin: "14px auto 0", maxWidth: "52ch", fontSize: "var(--text-sm)", lineHeight: 1.55, color: "var(--color-text-muted)" }}
        >
          Jobs, internships, walk-in interviews and coding contests from across India — all in one
          search, updated all day. Free, and you don&apos;t need an account to look.
        </motion.p>

        <motion.div variants={item}>
          <HeroLiveConsole
            jobs={tickerJobs}
            contests={tickerContests}
            jobsCount={jobsCount}
            contestsCount={contestsCount}
            handedOver={searchHandedOver}
            onHandedOverChange={setSearchHandedOver}
          />
        </motion.div>

        <motion.div variants={item} className="home-hero-acts">
          <Link href="/jobs" className="btn btn-signal">
            Browse all openings
          </Link>
          <Link href="/login?tab=signup" className="btn btn-secondary">
            Get free alerts
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
