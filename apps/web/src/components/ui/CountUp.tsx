"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";

// Animates a Prisma-sourced stat number from 0 on first viewport entry.
// Plain numbers only (no currency/percent formatting) — pass already-rounded
// integers; `suffix`/`prefix` cover "+", "K", etc.
export function CountUp({
  value,
  durationMs = 900,
  prefix = "",
  suffix = "",
  className,
}: {
  value: number;
  durationMs?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);

  useEffect(() => {
    if (!inView || reduced) {
      if (reduced) setDisplay(value);
      return;
    }
    const start = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, reduced, value, durationMs]);

  return (
    <span ref={ref} className={`stat-number ${className ?? ""}`}>
      {prefix}
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}
