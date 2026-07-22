import type { ReactNode } from "react";

// Matches full URLs (http/https) and bare domain+path mentions (e.g.
// "github.com/Otitodev/Maindesk", "maindesk.otito.site/chat") — common in
// scraped contest descriptions that reference a repo/live-demo/docs link
// as plain text. Restricted to a known-TLD whitelist so things that merely
// *look* dotted (version strings like "qwen3.7-plus", file names like
// "DEPLOY_ALIBABA_ECS.md") don't get mistaken for a domain.
const URL_PATTERN =
  /\bhttps?:\/\/[^\s<>()]+|\b(?:[a-zA-Z0-9-]+\.)+(?:com|org|net|io|dev|ai|site|co|app|xyz|tech|me|info)(?:\/[^\s<>()]*)?\b/g;

// Trailing punctuation that's almost always sentence structure, not part
// of the URL itself (e.g. "...at maindesk.otito.site/chat." shouldn't
// swallow the period).
const TRAILING_PUNCTUATION = /[.,;:!?)]+$/;

export function linkifyText(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  URL_PATTERN.lastIndex = 0;
  while ((match = URL_PATTERN.exec(text)) !== null) {
    let raw = match[0];
    let end = match.index + raw.length;

    const trailing = raw.match(TRAILING_PUNCTUATION);
    if (trailing) {
      raw = raw.slice(0, raw.length - trailing[0].length);
      end -= trailing[0].length;
    }
    if (!raw) continue;

    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const href = raw.startsWith("http") ? raw : `https://${raw}`;
    nodes.push(
      <a
        key={`link-${key++}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "var(--accent)", textDecoration: "underline" }}
      >
        {raw}
      </a>
    );

    lastIndex = end;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}
