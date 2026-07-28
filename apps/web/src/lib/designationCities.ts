// Mirrors services/scraper/taxonomy.py's 58-designation list — each scraped
// posting gets tagged against this same list by designation_classifier.py,
// so `job.tags` already contains these exact strings and no extra
// classification work is needed here.
export const DESIGNATIONS: string[] = [
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Web Developer",
  "Android Developer",
  "iOS Developer",
  "Flutter Developer",
  "React Native Developer",
  "Data Scientist",
  "Machine Learning Engineer",
  "AI Engineer",
  "NLP Engineer",
  "Computer Vision Engineer",
  "Data Engineer",
  "Data Analyst",
  "BI Developer",
  "Analytics Engineer",
  "DevOps Engineer",
  "Site Reliability Engineer",
  "Cloud Engineer",
  "Platform Engineer",
  "Infrastructure Engineer",
  "QA Engineer",
  "Automation Test Engineer",
  "Manual Tester",
  "SDET",
  "Security Engineer",
  "Penetration Tester",
  "SOC Analyst",
  "Security Analyst",
  "Database Administrator",
  "SQL Developer",
  "Data Warehouse Engineer",
  "Embedded Systems Engineer",
  "IoT Engineer",
  "Firmware Engineer",
  "Blockchain Developer",
  "Smart Contract Engineer",
  "Web3 Developer",
  "Game Developer",
  "Unity Developer",
  "Unreal Engine Developer",
  "UI Designer",
  "UX Designer",
  "Product Designer",
  "Engineering Manager",
  "Technical Lead",
  "Software Architect",
  "Network Engineer",
  "Systems Administrator",
  "IT Support Engineer",
  "SEO Specialist",
  "SEM/PPC Specialist",
  "Social Media Marketing Manager",
  "Content Marketing Manager",
  "Performance Marketing Manager",
  "Marketing Analyst",
  "Growth Marketing Manager",
];

// Major Indian tech hiring hubs — kept short and high-confidence rather than
// exhaustive, since a thin near-empty city page is worse than not having it.
export const CITIES: string[] = [
  "Bangalore",
  "Hyderabad",
  "Pune",
  "Mumbai",
  "Delhi",
  "Gurugram",
  "Noida",
  "Chennai",
  "Kolkata",
  "Ahmedabad",
  "Indore",
  "Kochi",
];

// Only a listing needs 5+ live matches to earn an indexable page — see
// Prompt 13 §1. Below this, the route still resolves (never a dead end)
// but generateMetadata marks it noindex.
export const MIN_LISTINGS_TO_INDEX = 5;

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function buildListingSlug(designation: string, city: string): string {
  return `${slugify(designation)}-jobs-in-${slugify(city)}`;
}

const SLUG_TO_PAIR = new Map<string, { designation: string; city: string }>();
for (const designation of DESIGNATIONS) {
  for (const city of CITIES) {
    SLUG_TO_PAIR.set(buildListingSlug(designation, city), { designation, city });
  }
}

export function parseListingSlug(slug: string): { designation: string; city: string } | null {
  return SLUG_TO_PAIR.get(slug) ?? null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isJobId(value: string): boolean {
  return UUID_RE.test(value);
}

export function allListingSlugs(): { designation: string; city: string; slug: string }[] {
  const out: { designation: string; city: string; slug: string }[] = [];
  for (const designation of DESIGNATIONS) {
    for (const city of CITIES) {
      out.push({ designation, city, slug: buildListingSlug(designation, city) });
    }
  }
  return out;
}
