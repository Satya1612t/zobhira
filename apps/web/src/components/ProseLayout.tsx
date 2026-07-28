"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type TocEntry = { id: string; label: string };

// Sticky scrollspy table of contents for long-form legal pages (/privacy,
// /terms). Section headings need `id` + `scroll-margin-top` set by the
// caller (see .prose-h2 in globals.css) so anchor jumps land below the
// floating navbar instead of hiding under it.
export function ProseLayout({ toc, children }: { toc: TocEntry[]; children: ReactNode }) {
  const [active, setActive] = useState(toc[0]?.id);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sections = toc
      .map((entry) => document.getElementById(entry.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-100px 0px -70% 0px" }
    );
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={containerRef} className="prose-layout">
      <nav className="prose-toc" aria-label="Table of contents">
        {toc.map((entry) => (
          <a key={entry.id} href={`#${entry.id}`} className={`prose-toc-link${active === entry.id ? " prose-toc-link--active" : ""}`}>
            {entry.label}
          </a>
        ))}
      </nav>

      <details className="prose-toc-mobile">
        <summary>On this page</summary>
        <nav>
          {toc.map((entry) => (
            <a key={entry.id} href={`#${entry.id}`}>{entry.label}</a>
          ))}
        </nav>
      </details>

      <div className="prose-content">{children}</div>
    </div>
  );
}
