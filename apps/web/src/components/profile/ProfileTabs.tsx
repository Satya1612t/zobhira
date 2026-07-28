"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { TABS, type ProfileTabKey } from "./tabs";

// URL-param driven (?tab=), not client state — every tab is a real,
// linkable, server-rendered URL. Only the sliding underline indicator
// itself needs client JS.
export function ProfileTabs({ active }: { active: ProfileTabKey }) {
  return (
    <div role="tablist" aria-label="Profile sections" className="profile-tablist">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={`/profile?tab=${tab.key}`}
          role="tab"
          aria-selected={active === tab.key}
          className="profile-tab"
        >
          {active === tab.key && (
            <motion.span
              layoutId="profile-tab-underline"
              className="profile-tab-underline"
              transition={{ type: "spring", stiffness: 400, damping: 34 }}
            />
          )}
          <span style={{ position: "relative", zIndex: 1, color: active === tab.key ? "var(--color-accent)" : "var(--color-text-muted)" }}>
            {tab.label}
          </span>
        </Link>
      ))}
    </div>
  );
}
