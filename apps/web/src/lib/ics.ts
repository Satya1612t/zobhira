// Generates a minimal, valid RFC 5545 .ics file as a data: URI — no
// client JS or backend endpoint needed, the browser downloads it straight
// off the href. Escaping covers the three characters the spec requires
// (comma, semicolon, backslash) plus newlines.
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function toIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export function buildIcsDataUri(params: {
  uid: string;
  title: string;
  description?: string;
  url: string;
  start: Date;
  end: Date;
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Zobhira//Contest Deadline//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${params.uid}@zobhira.com`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(params.start)}`,
    `DTEND:${toIcsDate(params.end)}`,
    `SUMMARY:${escapeIcsText(params.title)}`,
    ...(params.description ? [`DESCRIPTION:${escapeIcsText(params.description)}`] : []),
    `URL:${params.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const content = lines.join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(content)}`;
}
