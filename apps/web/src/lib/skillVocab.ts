// Skill vocabulary — read from the database, not from a hardcoded list.
//
// This file USED to be a mirror of skill_vocab.py's dict, with a warning that
// the two must be kept in sync by hand. That was the wrong design: if they
// drifted, the skills filter silently returned nothing — silently, because an
// empty result set looks exactly like "no such jobs exist".
//
// Both sides now read the same `skills` / `skill_aliases` tables (migration
// 0020), which the mining job grows automatically. There is one copy of the
// vocabulary and it cannot drift.
//
// The ONE thing still duplicated is normalizeSkill(). It must produce
// byte-identical output to skill_vocab.py::normalize — that symmetry is the
// whole mechanism: a user typing "node js" normalizes to "nodejs", the stored
// canonical "Node.js" normalizes to "nodejs", and they meet in the GIN index.

import { prisma } from "@/lib/prisma";

/** Must match skill_vocab.py::normalize exactly. */
export function normalizeSkill(tag: string): string {
  return tag.trim().toLowerCase().replace(/[\s._\-/]+/g, "");
}

type Vocabulary = { aliasToCanonical: Map<string, string>; loadedAt: number };

// The mining job runs weekly, so a 5-minute cache costs nothing in freshness
// and saves a query per request. Module scope survives across requests in the
// Next.js server runtime.
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: Vocabulary | null = null;

async function getVocabulary(): Promise<Vocabulary> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache;

  const aliasToCanonical = new Map<string, string>();
  try {
    const [skills, aliases] = await Promise.all([
      prisma.skill.findMany({ where: { status: "active" }, select: { canonical: true, normalized: true } }),
      prisma.skillAlias.findMany({ select: { normalized: true, canonical: true } }),
    ]);
    for (const s of skills) aliasToCanonical.set(s.normalized, s.canonical);
    for (const a of aliases) if (!aliasToCanonical.has(a.normalized)) aliasToCanonical.set(a.normalized, a.canonical);
  } catch {
    // Degrade to literal matching rather than throwing. A vocabulary lookup
    // failure should narrow results, never break the jobs page.
    if (cache) return cache;
  }

  cache = { aliasToCanonical, loadedAt: Date.now() };
  return cache;
}

/**
 * Turns the user's comma-separated Skills input into normalized keys to match
 * against jobs.tags_norm. Emits BOTH the literal normalization and the
 * canonical one, so "reactjs" finds jobs tagged "React" while a
 * source-provided tag we have no alias for still matches itself.
 */
export async function expandSkillQuery(raw: string): Promise<string[]> {
  const vocab = await getVocabulary();
  const keys = new Set<string>();
  for (const part of raw.split(",")) {
    const term = part.trim();
    if (!term) continue;
    const literal = normalizeSkill(term);
    if (!literal) continue;
    keys.add(literal);
    const canonical = vocab.aliasToCanonical.get(literal);
    if (canonical) keys.add(normalizeSkill(canonical));
  }
  return [...keys];
}

/**
 * Resolve a list of user-typed skill terms to canonical vocabulary entries.
 * Used when saving a profile: known terms become user_skills rows (sharing the
 * job-search vocabulary), unknown terms are returned so the caller can record
 * them as misses rather than silently dropping them (build spec §5 / #5).
 */
export async function resolveCanonicalSkills(
  terms: string[]
): Promise<{ canonical: string[]; unknown: string[] }> {
  const vocab = await getVocabulary();
  const canonical = new Set<string>();
  const unknown: string[] = [];
  for (const term of terms) {
    const t = term.trim();
    if (!t) continue;
    const c = vocab.aliasToCanonical.get(normalizeSkill(t));
    if (c) canonical.add(c);
    else unknown.push(t);
  }
  return { canonical: [...canonical], unknown };
}

/**
 * Prefix/substring autocomplete over the active canonical vocabulary, for the
 * profile skills input. Matches on the normalized form so "node js" finds
 * "Node.js". Capped small — this feeds a dropdown, not a report.
 */
export async function suggestSkills(query: string, limit = 8): Promise<string[]> {
  const norm = normalizeSkill(query);
  if (!norm) return [];
  const vocab = await getVocabulary();
  const starts: string[] = [];
  const contains: string[] = [];
  for (const [normalized, canonical] of vocab.aliasToCanonical) {
    if (normalized === norm) continue;
    if (normalized.startsWith(norm)) starts.push(canonical);
    else if (normalized.includes(norm)) contains.push(canonical);
  }
  return [...new Set([...starts, ...contains])].slice(0, limit);
}

/**
 * Records a skill term the user searched for that matched nothing.
 *
 * This is the highest-signal input the vocabulary miner has, but the two
 * causes behind a miss are completely different and scripts/mine_skills.py
 * must tell them apart:
 *
 *   - the term DOES appear in job descriptions -> a vocabulary gap. The jobs
 *     exist, we just could not tag them. Promote it.
 *   - the term appears in NO description       -> not a vocabulary gap at all.
 *     It is unmet demand: users want a skill you have no inventory for.
 *     Adding it to the vocabulary would change nothing, because nothing can
 *     ever match it. It should feed scraper query planning instead.
 *
 * Fire-and-forget: never block or fail the search response on analytics.
 */
export async function recordSkillMisses(raw: string): Promise<void> {
  const terms = raw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && t.length < 40);
  if (terms.length === 0) return;

  try {
    await Promise.all(
      terms.map((term) =>
        prisma.skillQueryMiss.upsert({
          where: { normalized: normalizeSkill(term) },
          update: { missCount: { increment: 1 }, lastSeenAt: new Date() },
          create: { normalized: normalizeSkill(term), display: term },
        })
      )
    );
  } catch {
    // Intentionally swallowed.
  }
}
