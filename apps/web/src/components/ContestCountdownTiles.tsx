"use client";

import { useEffect, useState } from "react";

function breakdown(deadline: Date) {
  const ms = Math.max(0, deadline.getTime() - Date.now());
  const totalSeconds = Math.floor(ms / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    under24h: totalSeconds < 24 * 3600,
    passed: ms <= 0,
  };
}

function Tile({ value, label }: { value: number; label: string }) {
  return (
    <div className="contest-countdown-tile">
      {/* Keyed span remounts on every value change, which retriggers the
          CSS mount animation — a lightweight stand-in for a true 3D flip. */}
      <span key={value} className="contest-countdown-tile-value">
        {String(value).padStart(2, "0")}
      </span>
      <span className="contest-countdown-tile-label">{label}</span>
    </div>
  );
}

export function ContestCountdownTiles({ deadline }: { deadline: Date }) {
  const [parts, setParts] = useState<ReturnType<typeof breakdown> | null>(null);

  useEffect(() => {
    setParts(breakdown(deadline));
    const id = setInterval(() => setParts(breakdown(deadline)), 1000);
    return () => clearInterval(id);
  }, [deadline]);

  if (!parts) return null;

  if (parts.passed) {
    return (
      <div className="contest-countdown-tiles">
        <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", color: "var(--color-text-onDark-muted)" }}>
          Entry has closed
        </span>
      </div>
    );
  }

  return (
    <div className={`contest-countdown-tiles${parts.under24h ? " contest-countdown-tiles--urgent" : ""}`} aria-live="polite" aria-label={`${parts.days} days, ${parts.hours} hours, ${parts.minutes} minutes, ${parts.seconds} seconds remaining`}>
      <Tile value={parts.days} label="Days" />
      <Tile value={parts.hours} label="Hours" />
      <Tile value={parts.minutes} label="Min" />
      <Tile value={parts.seconds} label="Sec" />
    </div>
  );
}
