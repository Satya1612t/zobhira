"use client";

import { useState } from "react";

type Alert = { query: string; filters: string[]; frequency: string };

function AlertToggle({ defaultChecked }: { defaultChecked: boolean }) {
  const [on, setOn] = useState(defaultChecked);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => setOn((v) => !v)}
      className={`alert-switch${on ? " alert-switch--on" : ""}`}
    >
      <span className="alert-switch-thumb" />
    </button>
  );
}

export function AlertsTab({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return <p style={{ color: "var(--color-text-muted)", fontSize: 14 }}>No saved search alerts yet. Save a search from the jobs page to get weekly emails.</p>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {alerts.map((alert, i) => (
        <div key={alert.query} className="job-card" style={{ padding: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--color-text)" }}>&quot;{alert.query}&quot;</div>
            <div className="cluster" style={{ marginTop: 6 }}>
              {alert.filters.map((f) => (
                <span key={f} className="tag tag-neutral">{f}</span>
              ))}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 6 }}>{alert.frequency}</div>
          </div>
          <AlertToggle defaultChecked={i === 0} />
        </div>
      ))}
    </div>
  );
}
