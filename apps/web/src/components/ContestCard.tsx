"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ContestListItem } from "@/lib/contestQuery";
import { CompanyLogo } from "./CompanyLogo";

type Urgency = "critical" | "soon" | "normal";

function urgencyFor(deadline: Date | null): Urgency {
  if (!deadline) return "normal";
  const days = (deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (days <= 3) return "critical";
  if (days <= 7) return "soon";
  return "normal";
}

const URGENCY_COLOR: Record<Urgency, string> = {
  critical: "var(--color-error)",
  soon: "var(--color-signal)",
  normal: "var(--color-success)",
};

function formatCountdown(deadline: Date): { text: string; under24h: boolean } {
  const ms = deadline.getTime() - Date.now();
  if (ms <= 0) return { text: "Closing soon", under24h: true };
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days >= 1) return { text: `${days}d ${hours}h left`, under24h: false };
  return { text: `${hours}h ${minutes}m left`, under24h: true };
}

// Live countdown chip — updates every minute on the client, since a
// server-rendered "4d 12h left" would silently go stale as the tab stays
// open. aria-live so screen readers hear the update without re-navigating.
function CountdownChip({ deadline }: { deadline: Date }) {
  const [now, setNow] = useState<{ text: string; under24h: boolean } | null>(null);

  useEffect(() => {
    setNow(formatCountdown(deadline));
    const id = setInterval(() => setNow(formatCountdown(deadline)), 60_000);
    return () => clearInterval(id);
  }, [deadline]);

  if (!now) return null;

  return (
    <span className={`contest-countdown-chip${now.under24h ? " contest-countdown-chip--pulse" : ""}`} aria-live="polite">
      {now.text}
    </span>
  );
}

function TimeProgressBar({ startsAt, deadlineAt }: { startsAt: Date | null; deadlineAt: Date }) {
  const [pct, setPct] = useState<number | null>(null);
  useEffect(() => {
    const start = startsAt?.getTime() ?? deadlineAt.getTime() - 14 * 24 * 60 * 60 * 1000;
    const total = deadlineAt.getTime() - start;
    const elapsed = Date.now() - start;
    setPct(total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 0);
  }, [startsAt, deadlineAt]);
  return (
    <div className="contest-progress-track" aria-hidden="true">
      <div className="contest-progress-fill" style={{ width: `${pct ?? 0}%` }} />
    </div>
  );
}

function ModeIcon({ mode }: { mode: string }) {
  if (mode === "online") {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 18v3" />
      </svg>
    );
  }
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function ContestCard({ contest }: { contest: ContestListItem }) {
  const deadline = contest.deadlineAt ? new Date(contest.deadlineAt) : null;
  const urgency = urgencyFor(deadline);
  const overflowTags = Math.max(0, contest.tags.length - 3);

  return (
    <Link
      href={`/contest/${contest.id}`}
      className="contest-card shape-squircle"
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <div className="contest-card-strip" style={{ background: URGENCY_COLOR[urgency] }} />
      <div className="contest-card-body">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
            <div className="job-card-logo-tile" style={{ width: 40, height: 40 }}>
              <CompanyLogo logoUrl={contest.logoUrl} company={contest.organizer ?? contest.title} size={40} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="contest-card-title">{contest.title}</div>
              {contest.organizer && <div className="contest-card-organizer">{contest.organizer}</div>}
            </div>
          </div>
          {deadline && <CountdownChip deadline={deadline} />}
        </div>

        {deadline && <TimeProgressBar startsAt={contest.startsAt ? new Date(contest.startsAt) : null} deadlineAt={deadline} />}

        {contest.prizeSummary && (
          <div className="contest-prize-pill">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 21h8" />
              <path d="M12 17v4" />
              <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
              <path d="M17 5h2a2 2 0 0 1 2 2 4 4 0 0 1-4 4" />
              <path d="M7 5H5a2 2 0 0 0-2 2 4 4 0 0 0 4 4" />
            </svg>
            {contest.prizeSummary}
          </div>
        )}

        {contest.highlights.length > 0 && (
          <ul className="contest-highlights">
            {contest.highlights.slice(0, 3).map((highlight) => (
              <li key={highlight}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {highlight}
              </li>
            ))}
          </ul>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: "auto", paddingTop: 12 }}>
          {contest.mode !== "unknown" && (
            <span className="tag tag-neutral" style={{ display: "inline-flex", alignItems: "center", gap: 4, textTransform: "capitalize" }}>
              <ModeIcon mode={contest.mode} />
              {contest.mode.replace("_", " ")}
            </span>
          )}
          {contest.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="tag tag-outline">{tag}</span>
          ))}
          {overflowTags > 0 && <span className="tag tag-outline">+{overflowTags}</span>}
        </div>
      </div>
    </Link>
  );
}
