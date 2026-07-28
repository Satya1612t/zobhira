"use client";

import type { ReactNode } from "react";
import styles from "./Marquee.module.css";

// Infinite horizontal scroll (company logos, trust strip). Duplicates the
// track so the loop is seamless, pauses on hover, and mask-fades both edges.
// Pure CSS animation (not motion/react) since it's a simple infinite loop —
// no orchestration needed.
export function Marquee({ children, durationSec = 28 }: { children: ReactNode; durationSec?: number }) {
  return (
    <div className={`${styles.viewport} mask-fade-x`}>
      <div className={styles.track} style={{ animationDuration: `${durationSec}s` }}>
        <div className={styles.group}>{children}</div>
        <div className={styles.group} aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}
