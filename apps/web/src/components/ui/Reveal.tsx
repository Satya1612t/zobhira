"use client";

import type { CSSProperties, ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

// Fade + rise on scroll-into-view, once. Split content into semantic chunks
// and stagger each with `delay` rather than animating one big container —
// see /DESIGN.md's motion primitives.
export function Reveal({
  children,
  delay = 0,
  y = 16,
  className,
  style,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y: reduced ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: reduced ? 0.01 : 0.5, delay: reduced ? 0 : delay, ease: [0.22, 0.61, 0.36, 1] as const }}
    >
      {children}
    </motion.div>
  );
}
