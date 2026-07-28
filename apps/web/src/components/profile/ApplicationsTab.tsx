type Application = { title: string; company: string; status: "saved" | "applied" | "interviewing" | "closed" };

const COLUMNS: { key: Application["status"]; label: string; color: string }[] = [
  { key: "saved", label: "Saved", color: "var(--color-text-muted)" },
  { key: "applied", label: "Applied", color: "var(--color-accent)" },
  { key: "interviewing", label: "Interviewing", color: "var(--color-signal)" },
  { key: "closed", label: "Offer / Closed", color: "var(--color-success)" },
];

export function ApplicationsTab({ applications }: { applications: Application[] }) {
  return (
    <div className="applications-board">
      {COLUMNS.map((col) => {
        const items = applications.filter((a) => a.status === col.key);
        return (
          <div key={col.key} className="applications-column">
            <div className="applications-column-header">
              <span style={{ width: 8, height: 8, borderRadius: "var(--radius-full)", background: col.color, flexShrink: 0 }} />
              {col.label}
              <span style={{ marginLeft: "auto", color: "var(--color-text-muted)", fontSize: 12 }}>{items.length}</span>
            </div>
            {items.length === 0 ? (
              <p style={{ fontSize: 12.5, color: "var(--color-text-muted)", padding: "8px 2px" }}>Nothing here yet.</p>
            ) : (
              items.map((app) => (
                <div key={app.title} className="applications-card">
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--color-text)" }}>{app.title}</div>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>{app.company}</div>
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
