"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { JobListItem } from "@/lib/jobQuery";
import type { ContestListItem } from "@/lib/contestQuery";
import { CompanyLogo } from "@/components/CompanyLogo";
import { SHOW_UNRELEASED_NAV } from "@/lib/authNavFlags";

// Internships/Walk-ins have no backing entity in the schema (only Job and
// Contest exist) — hidden from this tab bar rather than shown as inert.
// Contests itself is gated behind SHOW_UNRELEASED_NAV (see authNavFlags.ts)
// — /contest 404s in production, so its tab/demo-scene/"See all" link must
// not be reachable from here either.
const TABS = [
  { key: "jobs", label: "Jobs", href: "/jobs", live: true },
  ...(SHOW_UNRELEASED_NAV ? [{ key: "contests", label: "Contests", href: "/contest", live: true }] as const : []),
] as const;

type TabKey = (typeof TABS)[number]["key"];

type DemoRow = { key: string; name: string; logoUrl: string | null; title: string; meta: string; time: string; href: string };
// `rowPool` is every candidate row for that tab (not just the ones about to
// show) — the loop below draws a random 2-4 of them each cycle so the demo
// doesn't show the identical fixed set every time.
type Scene = { tab: TabKey; query: string; rowPool: DemoRow[]; count: string };

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// Random subset (2-4 rows, capped to what's available) in random order —
// makes each cycle feel like a genuinely different search result instead of
// the same static row set retyped under a new query every time.
function pickRandomRows(pool: DemoRow[]): DemoRow[] {
  if (pool.length === 0) return [];
  const count = Math.min(pool.length, 2 + Math.floor(Math.random() * 3));
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

function hoursAgo(date: Date | null): string {
  if (!date) return "recently";
  const hours = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60));
  if (hours <= 0) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Varied phrasing so the typed demo doesn't visibly retype the identical
// query forever — especially now that contests (the only other tab) are
// hidden in production, leaving jobs as the sole rotation. Every variant
// shares the same result rows/count below (still real, live data — only
// the query text itself is scripted, same as a search-bar placeholder).
const JOB_QUERIES = [
  "Forward deployed engineer",
  "Machine Learning engineer",
  "AI engineer",
  "Automation Engineer",
  "backend developer",
  "data analyst fresher",
  "Java developer",
  "frontend intern",
  "DevOps engineer",
  "full-stack developer",
  "Digital marketing executive",
  "PPC specialist",
  "remote software engineer",
  "remote data scientist",
  "remote product manager",
];

// The demo cascade is real, currently-live data (jobs/contests already
// fetched for the rest of the homepage), typed out on a loop — not
// fabricated placeholder rows. Only the query phrase itself is scripted
// copy, same as a search-bar placeholder would be.
function useScenes(jobs: JobListItem[], contests: ContestListItem[], jobsCount: number, contestsCount: number): Scene[] {
  return useMemo(() => {
    const scenes: Scene[] = [];
    if (jobs.length > 0) {
      const rowPool = jobs.map((job) => ({
        key: job.id,
        name: job.company,
        logoUrl: job.logoUrl,
        title: job.title,
        meta: `${job.company}${job.location ? ` · ${job.location}` : ""}`,
        time: hoursAgo(job.postedAt),
        href: `/jobs/${job.id}`,
      }));
      const count = `${jobsCount.toLocaleString()} jobs`;
      for (const query of JOB_QUERIES) {
        scenes.push({ tab: "jobs", query, rowPool, count });
      }
    }
    if (SHOW_UNRELEASED_NAV && contests.length > 0) {
      scenes.push({
        tab: "contests",
        query: "hackathon this week",
        rowPool: contests.map((contest) => ({
          key: contest.id,
          name: contest.organizer ?? contest.platform,
          logoUrl: contest.logoUrl,
          title: contest.title,
          meta: `${contest.organizer ?? contest.platform}${contest.mode !== "unknown" ? ` · ${contest.mode}` : ""}`,
          time: hoursAgo(contest.startsAt),
          href: `/contest/${contest.id}`,
        })),
        count: `${contestsCount.toLocaleString()} contests`,
      });
    }
    return scenes;
  }, [jobs, contests, jobsCount, contestsCount]);
}

export function HeroLiveConsole({
  jobs,
  contests,
  jobsCount,
  contestsCount,
  handedOver,
  onHandedOverChange,
}: {
  jobs: JobListItem[];
  contests: ContestListItem[];
  jobsCount: number;
  contestsCount: number;
  // Lifted to Hero.tsx so HeroWall (the background job-card wall) can freeze
  // in step with search being handed over to a real input, instead of
  // continuing to scroll behind the user while they type.
  handedOver: boolean;
  onHandedOverChange: (handedOver: boolean) => void;
}) {
  const scenes = useScenes(jobs, contests, jobsCount, contestsCount);

  const [activeTab, setActiveTab] = useState<TabKey>(scenes[0]?.tab ?? "jobs");
  const [demoText, setDemoText] = useState("");
  const [demoRows, setDemoRows] = useState<DemoRow[]>([]);
  const [demoCount, setDemoCount] = useState("");
  const [rowsVisible, setRowsVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");

  const inputRef = useRef<HTMLInputElement | null>(null);
  const consoleRef = useRef<HTMLFormElement | null>(null);
  const isEmpty = query.trim() === "";

  // The typing/deleting loop below fires a state update every 14-38ms —
  // harmless while Hero is on screen, but with nothing gating it, it kept
  // running at that rate forever, competing with scroll compositing for the
  // rest of the page (reported as jank persisting near TrustBar, well after
  // Hero itself had scrolled away). Same fix as the homepage Lottie players:
  // only run while actually visible.
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = consoleRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function handOver() {
    if (handedOver) return;
    onHandedOverChange(true);
    // Empty, not demoText — clicking means "I want to type my own search",
    // so the scripted text should disappear rather than land pre-filled.
    setQuery("");
    // Force the rows visible even if the click landed mid-cycle during the
    // brief fade between two random draws — otherwise the "static" panel
    // could freeze on its invisible frame instead of showing content.
    setRowsVisible(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  // 30s of the real input sitting empty after handover reverts back to the
  // scripted demo — clearing the timer on every keystroke means it only
  // ever fires while genuinely idle, never while someone's mid-type.
  useEffect(() => {
    if (!handedOver || query.trim() !== "") return;
    const timer = setTimeout(() => {
      onHandedOverChange(false);
      setQuery("");
    }, 30000);
    return () => clearTimeout(timer);
  }, [handedOver, query, onHandedOverChange]);

  useEffect(() => {
    if (scenes.length === 0 || !isEmpty || !inView || handedOver) return;
    const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      const s = scenes[0];
      setActiveTab(s.tab);
      setDemoText(s.query);
      setDemoRows(pickRandomRows(s.rowPool));
      setDemoCount(s.count);
      setRowsVisible(true);
      return;
    }

    let cancelled = false;
    async function run() {
      let i = 0;
      while (!cancelled) {
        const scene = scenes[i % scenes.length];
        setActiveTab(scene.tab);
        for (let c = 1; c <= scene.query.length; c++) {
          if (cancelled) return;
          setDemoText(scene.query.slice(0, c));
          await sleep(38);
        }
        if (cancelled) return;
        setBusy(true);
        await sleep(340);
        if (cancelled) return;
        setBusy(false);
        // Fresh random draw every cycle (2-4 rows, random order) — never the
        // same fixed set retyped under a new query, so it reads as a real
        // changing result instead of a static loop. The panel's own
        // min-height (.home-hero-res) keeps its footprint constant through
        // the crossfade, so it never visibly collapses/closes either.
        setDemoRows(pickRandomRows(scene.rowPool));
        setDemoCount(scene.count);
        setRowsVisible(true);
        await sleep(3400);
        if (cancelled) return;
        setRowsVisible(false);
        for (let c = scene.query.length; c >= 0; c--) {
          if (cancelled) return;
          setDemoText(scene.query.slice(0, c));
          await sleep(14);
        }
        await sleep(260);
        i++;
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [scenes, isEmpty, inView]);

  const activeHref = TABS.find((t) => t.key === activeTab)?.href ?? "/jobs";
  // Always whatever was last shown — stays put (static) once handed over
  // instead of disappearing the moment someone clicks in to type their own
  // search; the demo loop above already stops updating it while handedOver
  // is true, so this just keeps rendering that frozen snapshot.
  const rows = demoRows;

  return (
    <form ref={consoleRef} action={activeHref} method="get" className="home-hero-console">
      <div className="home-hero-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            disabled={!tab.live}
            onClick={() => {
              if (!tab.live) return;
              handOver();
              setActiveTab(tab.key);
            }}
            className="home-hero-tab"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="home-hero-srow">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: "var(--color-text-muted)", flexShrink: 0 }}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <div className="home-hero-qwrap" onClick={handOver}>
          {handedOver ? (
            <input
              ref={inputRef}
              name="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Try "data analyst" or "walk-in interview"'
            />
          ) : (
            <>
              <span className="home-hero-typed">{demoText}</span>
              <span className="home-hero-caret" />
            </>
          )}
        </div>
        <button
          type={handedOver ? "submit" : "button"}
          className="home-hero-go"
          data-busy={busy ? 1 : 0}
          onClick={handedOver ? undefined : handOver}
        >
          Search
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h13M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      {rows.length > 0 && (
        <div className="home-hero-res" aria-live="polite">
          {rows.map((row, i) => (
            <a
              key={row.key}
              href={row.href}
              className="home-hero-row"
              data-in={rowsVisible ? 1 : 0}
              style={{ transitionDelay: `${i * 90}ms` }}
            >
              <span className="home-hero-row-logo">
                <CompanyLogo logoUrl={row.logoUrl} company={row.name} size={38} />
              </span>
              <span style={{ display: "block", minWidth: 0 }}>
                <span className="home-hero-row-t">{row.title}</span>
                <span className="home-hero-row-m">{row.meta}</span>
              </span>
              <span className="home-hero-row-w">{row.time}</span>
            </a>
          ))}
          <div className="home-hero-res-foot">
            <span>{demoCount} match this search</span>
            <a href={activeHref}>See all →</a>
          </div>
        </div>
      )}
    </form>
  );
}
