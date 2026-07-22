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

const TECH_MATCHERS = TECHNOLOGIES.map((tech) => ({
  label: tech,
  regex: new RegExp(`(?<![\\w.])${escapeRegex(tech)}(?![\\w])`, "i"),
}));

export function extractTechnologies(description: string | null, limit = 20): string[] {
  if (!description) return [];
  const found: string[] = [];
  for (const { label, regex } of TECH_MATCHERS) {
    if (regex.test(description)) found.push(label);
    if (found.length >= limit) break;
  }
  return found;
}
