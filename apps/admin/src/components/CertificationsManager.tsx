"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminFetch } from "@/lib/adminFetch";
import { useToast } from "@/components/Toast";

type Cert = {
  id: string;
  slug: string;
  title: string;
  provider: string;
  priceType: string;
  priceAmount: number | null;
  priceCurrency: string | null;
  publishStatus: string;
  verifiedAt: string | null;
  isFeatured: boolean;
};

const PRICE_LABEL: Record<string, string> = { free: "Free", freemium: "Free to learn", paid: "Paid" };

const controlStyle: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--line)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: 13,
};

const statusChip = (status: string): React.CSSProperties => ({
  fontFamily: "var(--font-mono)",
  fontSize: 10.5,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  padding: "2px 7px",
  borderRadius: 999,
  border: "1px solid var(--line)",
  background: status === "published" ? "var(--success-soft, var(--surface-hover))" : "var(--surface-hover)",
  color: status === "published" ? "var(--success, var(--ink))" : "var(--ink-faint)",
});

function priceText(c: Cert): string {
  if (c.priceType !== "paid") return PRICE_LABEL[c.priceType] ?? c.priceType;
  if (c.priceAmount == null) return "— price needed";
  return `${c.priceCurrency ?? "INR"} ${c.priceAmount.toLocaleString()}`;
}

export function CertificationsManager() {
  const { showToast } = useToast();
  const [certs, setCerts] = useState<Cert[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Default view is the review queue — draft rows waiting on a human.
  const [publishStatus, setPublishStatus] = useState("draft");
  const [priceType, setPriceType] = useState("");
  const [needsVerify, setNeedsVerify] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (publishStatus) params.set("publishStatus", publishStatus);
    if (priceType) params.set("priceType", priceType);
    if (needsVerify) params.set("needsVerify", "true");
    if (q.trim()) params.set("q", q.trim());
    try {
      const res = await adminFetch(`/api/certifications?${params.toString()}`, { cache: "no-store" });
      const data: { certifications: Cert[]; total: number } = await res.json();
      setCerts(data.certifications ?? []);
      setTotal(data.total ?? 0);
    } catch {
      showToast("Couldn't load certifications.", "error");
    } finally {
      setLoading(false);
    }
  }, [publishStatus, priceType, needsVerify, q, showToast]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0); // debounce the search box only
    return () => clearTimeout(t);
  }, [load, q]);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <input
          style={{ ...controlStyle, flex: "2 1 220px" }}
          placeholder="Search title / provider / slug"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select style={controlStyle} value={publishStatus} onChange={(e) => setPublishStatus(e.target.value)}>
          <option value="draft">Draft (review queue)</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
          <option value="">All statuses</option>
        </select>
        <select style={controlStyle} value={priceType} onChange={(e) => setPriceType(e.target.value)}>
          <option value="">All prices</option>
          <option value="free">Free</option>
          <option value="freemium">Free to learn</option>
          <option value="paid">Paid</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--ink-muted)" }}>
          <input type="checkbox" checked={needsVerify} onChange={(e) => setNeedsVerify(e.target.checked)} />
          Needs verifying
        </label>
        <Link
          href="/certifications/new"
          style={{
            marginLeft: "auto", padding: "8px 16px", borderRadius: "var(--radius-sm)",
            border: "1px solid var(--line)", background: "var(--accent)", color: "var(--accent-ink)",
            fontSize: 13, fontWeight: 600, textDecoration: "none",
          }}
        >
          + New certification
        </Link>
      </div>

      {loading ? (
        <p style={{ color: "var(--ink-muted)", fontSize: 13 }}>Loading…</p>
      ) : certs.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: 13 }}>Nothing matches these filters.</p>
      ) : (
        <>
          <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--ink-faint)" }}>
            {total} row{total === 1 ? "" : "s"}
          </p>
          <div style={{ borderRadius: "var(--radius)", border: "1px solid var(--line)", background: "var(--surface)", overflow: "hidden" }}>
            {certs.map((c) => {
              const needsPrice = c.priceType === "paid" && c.priceAmount == null;
              return (
                <Link
                  key={c.id}
                  href={`/certifications/${c.id}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                    borderBottom: "1px solid var(--line)", textDecoration: "none", color: "inherit",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>{c.title}</span>
                      {c.isFeatured && (
                        <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--accent)" }}>★ featured</span>
                      )}
                      {needsPrice && (
                        <span title="Paid row with no price — cannot go live" style={{ fontSize: 11, fontWeight: 700, color: "var(--warn)" }}>
                          ⚠ price needed
                        </span>
                      )}
                    </div>
                    <div style={{ marginTop: 3, fontSize: 12, color: "var(--ink-faint)" }}>
                      {c.provider} · {priceText(c)} ·{" "}
                      {c.verifiedAt ? `verified ${new Date(c.verifiedAt).toLocaleDateString("en-GB")}` : "never verified"}
                    </div>
                  </div>
                  <span style={statusChip(c.publishStatus)}>{c.publishStatus}</span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
