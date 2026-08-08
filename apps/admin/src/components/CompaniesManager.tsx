"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/adminFetch";
import { useToast } from "@/components/Toast";

type Company = {
  id: number;
  name: string;
  slug: string;
  atsProvider: string;
  atsToken: string;
  careersUrl: string | null;
  tier: number;
  isActive: boolean;
  lastOkAt: string | null;
  lastError: string | null;
  failStreak: number;
};

const inputStyle: React.CSSProperties = {
  padding: "8px 11px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--line)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: 13.5,
  minWidth: 0,
};

export function CompaniesManager() {
  const { showToast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  async function load() {
    try {
      const res = await adminFetch("/api/feeds/companies", { cache: "no-store" });
      const data: { companies: Company[] } = await res.json();
      setCompanies(data.companies ?? []);
    } catch {
      showToast("Couldn't load companies.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setAdding(true);
    try {
      const res = await adminFetch("/api/feeds/companies/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), name: name.trim() }),
      });
      const data = await res.json();
      if (data.detected) {
        showToast(`Added ${data.name} — detected ${data.provider} (${data.token}).`, "success");
        setUrl("");
        setName("");
        load();
      } else {
        showToast(data.reason ?? "No ATS could be detected for that URL.", "error");
      }
    } catch {
      showToast("Could not reach the scraper service.", "error");
    } finally {
      setAdding(false);
    }
  }

  async function toggleActive(company: Company) {
    const next = !company.isActive;
    setCompanies((prev) => prev.map((c) => (c.id === company.id ? { ...c, isActive: next } : c)));
    try {
      const res = await adminFetch(`/api/feeds/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) throw new Error();
      showToast(`${company.name} ${next ? "enabled" : "disabled"}.`, "success");
    } catch {
      setCompanies((prev) => prev.map((c) => (c.id === company.id ? { ...c, isActive: !next } : c)));
      showToast(`Couldn't update ${company.name}.`, "error");
    }
  }

  async function remove(company: Company) {
    if (!confirm(`Remove ${company.name} from the registry? Its already-scraped jobs stay in the DB and age out normally.`)) return;
    const prev = companies;
    setCompanies((cur) => cur.filter((c) => c.id !== company.id));
    try {
      const res = await adminFetch(`/api/feeds/companies/${company.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast(`Removed ${company.name}.`, "success");
    } catch {
      setCompanies(prev);
      showToast(`Couldn't remove ${company.name}.`, "error");
    }
  }

  const byProvider = companies.reduce<Record<string, number>>((acc, c) => {
    acc[c.atsProvider] = (acc[c.atsProvider] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      {/* Add-by-URL form */}
      <form
        onSubmit={handleAdd}
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
          padding: 14,
          borderRadius: "var(--radius)",
          border: "1px solid var(--line)",
          background: "var(--surface)",
          marginBottom: 16,
        }}
      >
        <input
          style={{ ...inputStyle, flex: "3 1 260px" }}
          placeholder="Careers-page URL (e.g. https://acme.com/careers)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={adding}
        />
        <input
          style={{ ...inputStyle, flex: "1 1 130px" }}
          placeholder="Company name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={adding}
        />
        <button
          type="submit"
          disabled={adding || !url.trim()}
          style={{
            padding: "8px 16px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--line)",
            background: adding || !url.trim() ? "var(--surface-hover)" : "var(--accent)",
            color: adding || !url.trim() ? "var(--ink-faint)" : "var(--accent-ink)",
            fontSize: 13,
            fontWeight: 600,
            cursor: adding || !url.trim() ? "not-allowed" : "pointer",
            flexShrink: 0,
          }}
        >
          {adding ? "Detecting…" : "Detect & add"}
        </button>
      </form>
      <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "var(--ink-faint)" }}>
        Paste a company&apos;s careers URL — the ATS (Greenhouse/Lever/Ashby/…) and token are auto-detected
        and verified against the live board before adding. Needs the scraper service running.
      </p>

      {loading ? (
        <p style={{ color: "var(--ink-muted)", fontSize: 13 }}>Loading…</p>
      ) : companies.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: 13 }}>No companies registered yet — add one above.</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <span style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>{companies.length} companies:</span>
            {Object.entries(byProvider).map(([provider, count]) => (
              <span key={provider} style={{ fontSize: 12, color: "var(--ink-faint)", fontFamily: "var(--font-mono)" }}>
                {provider} {count}
              </span>
            ))}
          </div>
          <div
            style={{
              borderRadius: "var(--radius)",
              border: "1px solid var(--line)",
              background: "var(--surface)",
              overflow: "hidden",
            }}
          >
            {companies.map((company) => (
              <div
                key={company.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>{company.name}</span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10.5,
                        textTransform: "uppercase",
                        letterSpacing: 0.4,
                        padding: "2px 7px",
                        borderRadius: 999,
                        background: "var(--surface-hover)",
                        color: "var(--ink-faint)",
                        border: "1px solid var(--line)",
                      }}
                    >
                      {company.atsProvider}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--ink-faint)" }}>
                      {company.atsToken}
                    </span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-faint)" }}>
                    {company.lastOkAt ? (
                      <span>Last OK: {new Date(company.lastOkAt).toLocaleString("en-US")}</span>
                    ) : (
                      <span>Never polled yet</span>
                    )}
                    {company.lastError && (
                      <span style={{ color: "var(--warn)" }}>
                        {" "}
                        · {company.lastError}
                        {company.failStreak > 0 && ` (×${company.failStreak})`}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => toggleActive(company)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--line)",
                    background: company.isActive ? "var(--accent)" : "var(--surface-hover)",
                    color: company.isActive ? "var(--accent-ink)" : "var(--ink-faint)",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  {company.isActive ? "Active" : "Disabled"}
                </button>
                <button
                  onClick={() => remove(company)}
                  title="Remove from registry"
                  style={{
                    padding: "6px 10px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--line)",
                    background: "var(--surface)",
                    color: "var(--warn)",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
