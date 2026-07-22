import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CompanyLogo } from "@/components/CompanyLogo";
import { CONTEST_SELECT } from "@/lib/contestQuery";
import { linkifyText } from "@/lib/linkify";

// Was force-dynamic — same ISR reasoning as jobs/[id]/page.tsx: content
// only changes on the next scrape/reap cycle, not per-request.
export const revalidate = 60;

const PLATFORM_LABELS: Record<string, string> = {
  dev_community: "DEV Community",
};

export default async function ContestDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const contest = await prisma.contest.findUnique({ where: { id }, select: CONTEST_SELECT });

  if (!contest) notFound();

  const platformLabel = PLATFORM_LABELS[contest.platform] ?? contest.platform;
  const daysLeft = contest.deadlineAt
    ? Math.ceil((contest.deadlineAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <main style={{ maxWidth: 1040, margin: "0 auto", padding: "40px 10px 64px" }}>
      <Link
        href="/contest"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          color: "var(--ink-muted)",
          fontSize: 13.5,
          textDecoration: "none",
          marginBottom: 20,
        }}
      >
        ← Back to contests
      </Link>

      <div className="detail-grid">
        <div
          style={{
            padding: "28px 30px",
            borderRadius: "var(--radius)",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <CompanyLogo logoUrl={contest.logoUrl} company={contest.organizer ?? contest.title} size={56} />
            <div style={{ minWidth: 0 }}>
              <h1
                style={{
                  margin: 0,
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  fontSize: 26,
                  color: "var(--ink)",
                }}
              >
                {contest.title}
              </h1>
              <p style={{ margin: "5px 0 0", color: "var(--ink-muted)", fontSize: 15.5 }}>
                {contest.organizer ?? platformLabel}
              </p>
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              fontFamily: "var(--font-mono)",
              fontSize: 12.5,
              color: "var(--ink-faint)",
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <span>{platformLabel}</span>
            {contest.mode !== "unknown" && <span>· {contest.mode.replace("_", " ")}</span>}
            {contest.startsAt && <span>· starts {contest.startsAt.toLocaleDateString("en-US")}</span>}
          </div>

          {contest.prizeSummary && (
            <div
              style={{
                marginTop: 14,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                fontWeight: 700,
                padding: "5px 12px",
                borderRadius: 999,
                background: "var(--accent)",
                color: "var(--accent-ink)",
              }}
            >
              🏆 {contest.prizeSummary}
            </div>
          )}

          {contest.highlights.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--ink-faint)",
                  marginBottom: 7,
                }}
              >
                Key highlights
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {contest.highlights.map((highlight) => (
                  <span
                    key={highlight}
                    style={{
                      fontSize: 12.5,
                      padding: "4px 11px",
                      borderRadius: 999,
                      background: "var(--bg)",
                      color: "var(--ink)",
                      border: "1px solid var(--line)",
                      fontWeight: 500,
                    }}
                  >
                    ✓ {highlight}
                  </span>
                ))}
              </div>
            </div>
          )}

          {contest.tags.length > 0 && (
            <div style={{ marginTop: 18, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {contest.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: 12,
                    padding: "3px 10px",
                    borderRadius: 999,
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                    fontWeight: 500,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {contest.summary || contest.description ? (
            <div
              style={{
                marginTop: 26,
                paddingTop: 22,
                borderTop: "1px solid var(--line)",
              }}
            >
              <div
                style={{
                  lineHeight: 1.7,
                  overflowWrap: "break-word",
                  color: "var(--ink)",
                  fontSize: 14.5,
                  whiteSpace: contest.summary ? "normal" : "pre-wrap",
                }}
              >
                {linkifyText(contest.summary ?? contest.description ?? "")}
              </div>
              {contest.summary && contest.description && contest.description !== contest.summary && (
                <details style={{ marginTop: 14 }}>
                  <summary
                    style={{
                      cursor: "pointer",
                      fontSize: 12.5,
                      color: "var(--ink-muted)",
                      fontWeight: 600,
                    }}
                  >
                    Show original description
                  </summary>
                  <div
                    style={{
                      marginTop: 10,
                      paddingTop: 10,
                      borderTop: "1px solid var(--line)",
                      lineHeight: 1.7,
                      whiteSpace: "pre-wrap",
                      overflowWrap: "break-word",
                      color: "var(--ink-muted)",
                      fontSize: 13.5,
                    }}
                  >
                    {linkifyText(contest.description ?? "")}
                  </div>
                </details>
              )}
            </div>
          ) : (
            <div
              style={{
                marginTop: 26,
                paddingTop: 22,
                borderTop: "1px solid var(--line)",
                color: "var(--ink-faint)",
                fontSize: 14,
              }}
            >
              No description available — see the official page for full details.
            </div>
          )}
        </div>

        <div className="detail-apply-card">
          <div
            style={{
              padding: 22,
              borderRadius: "var(--radius)",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-faint)" }}>
                  Platform
                </div>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink)", marginTop: 2 }}>
                  {platformLabel}
                </div>
              </div>

              {contest.deadlineAt && (
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-faint)" }}>
                    Deadline
                  </div>
                  <div
                    style={{
                      fontSize: 14.5,
                      fontWeight: 600,
                      color: daysLeft !== null && daysLeft <= 7 ? "var(--warn)" : "var(--ink)",
                      marginTop: 2,
                    }}
                  >
                    {contest.deadlineAt.toLocaleDateString("en-US")}
                    {daysLeft !== null && (daysLeft >= 0 ? ` (${daysLeft}d left)` : " (passed)")}
                  </div>
                </div>
              )}

              {contest.mode !== "unknown" && (
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-faint)" }}>
                    Mode
                  </div>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink)", marginTop: 2, textTransform: "capitalize" }}>
                    {contest.mode.replace("_", " ")}
                  </div>
                </div>
              )}
            </div>

            <a
              href={contest.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block",
                textAlign: "center",
                marginTop: 20,
                padding: "12px 0",
                borderRadius: "var(--radius-sm)",
                background: "var(--accent)",
                color: "var(--accent-ink)",
                textDecoration: "none",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Register on {platformLabel} →
            </a>
            <p style={{ marginTop: 10, fontSize: 11.5, color: "var(--ink-faint)", textAlign: "center" }}>
              Source: {platformLabel}. Not affiliated — registration happens on the official
              platform site.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
