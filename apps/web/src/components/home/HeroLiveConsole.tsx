"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { JobListItem } from "@/lib/jobQuery";
import type { ContestListItem } from "@/lib/contestQuery";
import { CompanyLogo } from "@/components/CompanyLogo";

// Internships/Walk-ins have no backing entity in the schema (only Job and
// Contest exist) — hidden from this tab bar rather than shown as inert.
const TABS = [
  { key: "jobs", label: "Jobs", href: "/jobs", live: true },
  { key: "contests", label: "Contests", href: "/contest", live: true },
] as const;

type TabKey = (typeof TABS)[number]["key"];

type DemoRow = { key: string; name: string; logoUrl: string | null; title: string; meta: string; time: string; href: string };
type Scene = { tab: TabKey; query: string; rows: DemoRow[]; count: string };

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function hoursAgo(date: Date | null): string {
  if (!date) return "recently";
  const hours = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60));
  if (hours <= 0) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// The demo cascade is real, currently-live data (jobs/contests already
// fetched for the rest of the homepage), typed out on a loop — not
// fabricated placeholder rows. Only the query phrase itself is scripted
// copy, same as a search-bar placeholder would be.
function useScenes(jobs: JobListItem[], contests: ContestListItem[], jobsCount: number, contestsCount: number): Scene[] {
  return useMemo(() => {
    const scenes: Scene[] = [];
    if (jobs.length > 0) {
      scenes.push({
        tab: "jobs",
        query: "software engineer bengaluru",
        rows: jobs.slice(0, 4).map((job) => ({
          key: job.id,
          name: job.company,
          logoUrl: job.logoUrl,
          title: job.title,
          meta: `${job.company}${job.location ? ` · ${job.location}` : ""}`,
          time: hoursAgo(job.postedAt),
          href: `/jobs/${job.id}`,
        })),
        count: `${jobsCount.toLocaleString()} jobs`,
      });
    }
    if (contests.length > 0) {
      scenes.push({
        tab: "contests",
        query: "hackathon this week",
        rows: contests.slice(0, 4).map((contest) => ({
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
}: {
  jobs: JobListItem[];
  contests: ContestListItem[];
  jobsCount: number;
  contestsCount: number;
}) {
  const scenes = useScenes(jobs, contests, jobsCount, contestsCount);

  const [activeTab, setActiveTab] = useState<TabKey>(scenes[0]?.tab ?? "jobs");
  const [demoText, setDemoText] = useState("");
  const [demoRows, setDemoRows] = useState<DemoRow[]>([]);
  const [demoCount, setDemoCount] = useState("");
  const [rowsVisible, setRowsVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [handedOver, setHandedOver] = useState(false);
  const [query, setQuery] = useState("");

  const inputRef = useRef<HTMLInputElement | null>(null);
  // The demo cascade underneath is never permanently switched off — once a
  // real input is up, it just pauses while there's real text in it (so it
  // doesn't fight what the visitor is typing/about to submit) and resumes
  // the moment the box is empty again, rather than freezing forever after
  // the first click like it used to.
  const isEmpty = query.trim() === "";

  function handOver() {
    if (handedOver) return;
    setHandedOver(true);
    setQuery(demoText);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  useEffect(() => {
    if (scenes.length === 0 || !isEmpty) return;
    const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      const s = scenes[0];
      setActiveTab(s.tab);
      setDemoText(s.query);
      setDemoRows(s.rows);
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
        setDemoRows(scene.rows);
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
  }, [scenes, isEmpty]);

  const activeHref = TABS.find((t) => t.key === activeTab)?.href ?? "/jobs";
  const rows = isEmpty ? demoRows : [];

  return (
    <form action={activeHref} method="get" className="home-hero-console">
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
              placeholder='Try "data analyst" or "walk-in Hyderabad"'
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

      {!handedOver && rows.length > 0 && (
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
