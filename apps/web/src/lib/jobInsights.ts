// Curated, not exhaustive — common technologies likely to appear literally
// in a job description's text. Short/ambiguous English words ("Go", "R",
// bare "C") are deliberately left out to avoid false positives on ordinary
// sentences ("go through", "R&D").
const TECHNOLOGIES = [
  // Languages
  "JavaScript", "TypeScript", "Python", "Java", "C++", "C#", "Golang", "Rust",
  "Ruby", "PHP", "Swift", "Kotlin", "Scala", "Perl", "MATLAB",
  // Frontend
  "React", "Angular", "Vue", "Next.js", "Nuxt", "Svelte", "Redux", "Tailwind",
  "HTML", "CSS", "Sass", "jQuery",
  // Backend / APIs
  "Node.js", "Express", "Django", "Flask", "FastAPI", "Spring Boot", "Spring",
  "Rails", "Laravel", ".NET", "ASP.NET", "GraphQL", "gRPC", "REST",
  // Mobile
  "React Native", "Flutter", "Android", "iOS", "SwiftUI",
  // Data / AI
  "TensorFlow", "PyTorch", "Pandas", "NumPy", "Scikit-learn", "Spark",
  "Hadoop", "Kafka", "Airflow", "LangChain",
  // Databases
  "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch", "Cassandra",
  "DynamoDB", "SQLite", "Oracle", "SQL Server", "SQL",
  // Cloud / DevOps
  "AWS", "Azure", "GCP", "Google Cloud", "Docker", "Kubernetes", "Terraform",
  "Jenkins", "Ansible", "Git", "GitHub", "GitLab", "Linux", "CI/CD",
  // Testing
  "Jest", "Cypress", "Selenium", "JUnit", "Pytest",
  // Other
  "Microservices", "WebSocket", "OAuth", "JWT",
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// job_formatter.py's structured JSON shape ({overview, responsibilities[],
// requirements[], niceToHave[], benefits[], details[]}) reconstructed as
// plain prose so the regex extractors below (which expect prose, not JSON)
// can run against it. Mirrors services/scraper/scripts/mine_skills.py's
// flatten_formatted. Returns null on anything not in that shape (old-format
// plain-string rows, parse failure, or no formatting yet), so callers fall
// back to raw description.
function flattenFormatted(formattedDescription: string | null): string | null {
  if (!formattedDescription) return null;
  try {
    const data = JSON.parse(formattedDescription);
    if (!data || typeof data !== "object") return null;
    const parts: string[] = [];
    if (typeof data.overview === "string" && data.overview.trim()) parts.push(data.overview);
    for (const key of ["responsibilities", "requirements", "niceToHave", "benefits", "details"]) {
      const value = data[key];
      if (Array.isArray(value)) parts.push(...value.map(String));
    }
    return parts.length > 0 ? parts.join("\n") : null;
  } catch {
    return null;
  }
}

const TECH_MATCHERS = TECHNOLOGIES.map((tech) => ({
  label: tech,
  regex: new RegExp(`(?<![\\w.])${escapeRegex(tech)}(?![\\w])`, "i"),
}));

export function extractTechnologies(
  formattedDescription: string | null,
  rawDescription: string | null = null,
  limit = 20,
): string[] {
  const text = flattenFormatted(formattedDescription) ?? rawDescription;
  if (!text) return [];
  const found: string[] = [];
  for (const { label, regex } of TECH_MATCHERS) {
    if (regex.test(text)) found.push(label);
    if (found.length >= limit) break;
  }
  return found;
}

// The LLM writes highlight text with its own free-form prefixes (see
// services/scraper/utils/job_formatter.py's prompt — it only hints at
// categories like "required experience level", it doesn't dictate exact
// wording), so already-stored highlights bake these phrasings directly into
// the string. Normalizing here at display time (rather than editing the
// prompt) fixes both existing and future data immediately, since a prompt
// edit alone wouldn't touch already-cached highlights and can't guarantee
// exact wording next time either.
const HIGHLIGHT_PREFIX_REPLACEMENTS: [RegExp, string][] = [
  [/^Required experience level:/i, "Level Required:"],
  [/^Key role focus:/i, "Focus on:"],
];

export function humanizeHighlight(text: string): string {
  for (const [pattern, replacement] of HIGHLIGHT_PREFIX_REPLACEMENTS) {
    if (pattern.test(text)) return text.replace(pattern, replacement);
  }
  return text;
}

// Ordered by specificity — a numeric range/floor ("2-4 years", "5+ years")
// is checked before the vaguer entry-level phrases, since a description
// could technically contain both ("entry level, 0-1 years").
const EXPERIENCE_MATCHERS: { regex: RegExp; label: (m: RegExpMatchArray) => string }[] = [
  { regex: /(\d+)\s*-\s*(\d+)\s*\+?\s*years?/i, label: (m) => `${m[1]}-${m[2]} years` },
  { regex: /(\d+)\s*\+\s*years?/i, label: (m) => `${m[1]}+ years` },
  { regex: /(\d+)\s*years?(?:\s*of)?\s*experience/i, label: (m) => `${m[1]}+ years` },
  { regex: /entry[\s-]?level/i, label: () => "Entry level" },
  { regex: /\bfresher(?:s)?\b/i, label: () => "Fresher" },
  { regex: /no\s+(?:prior\s+)?experience\s+(?:required|necessary)/i, label: () => "No experience required" },
];

// Best-effort, deterministic — same reliability class as extractTechnologies.
// Returns null (never a guess) when the description doesn't literally state
// an experience requirement; callers may fall back to an LLM for those cases.
export function extractExperience(formattedDescription: string | null, rawDescription: string | null = null): string | null {
  const text = flattenFormatted(formattedDescription) ?? rawDescription;
  if (!text) return null;
  for (const { regex, label } of EXPERIENCE_MATCHERS) {
    const match = text.match(regex);
    if (match) return label(match);
  }
  return null;
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

// Returns the first email address literally present in the description, or
// null. Deterministic only — no LLM fallback, since inventing an email would
// be actively wrong rather than merely missing.
export function extractEmail(formattedDescription: string | null, rawDescription: string | null = null): string | null {
  const text = flattenFormatted(formattedDescription) ?? rawDescription;
  if (!text) return null;
  const match = text.match(EMAIL_REGEX);
  return match ? match[0] : null;
}

export { flattenFormatted };
