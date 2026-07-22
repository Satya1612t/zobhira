// Mirrors the 15 streams behind services/scraper/taxonomy.py's 58
// designations, for the sidebar's quick-browse list. `query` is a
// representative keyword — clicking a stream just runs a normal keyword
// search, it doesn't need to match a designation exactly.
export const STREAMS: { label: string; query: string }[] = [
  { label: "Web Development", query: "Web Developer" },
  { label: "Mobile Development", query: "Mobile Developer" },
  { label: "Data Science / AI", query: "Data Scientist" },
  { label: "Data Engineering", query: "Data Engineer" },
  { label: "DevOps / Cloud", query: "DevOps Engineer" },
  { label: "QA / Testing", query: "QA Engineer" },
  { label: "Cybersecurity", query: "Security Engineer" },
  { label: "Database Admin", query: "Database Administrator" },
  { label: "Embedded / IoT", query: "Embedded Systems Engineer" },
  { label: "Blockchain / Web3", query: "Blockchain Developer" },
  { label: "Game Development", query: "Game Developer" },
  { label: "UI/UX Design", query: "UX Designer" },
  { label: "Engineering Management", query: "Engineering Manager" },
  { label: "Networking / SysAdmin", query: "Network Engineer" },
  { label: "Digital Marketing", query: "Digital Marketing" },
];
