"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminFetch } from "@/lib/adminFetch";
import { useToast } from "@/components/Toast";

type Cert = {
  id: string;
  slug: string;
  title: string;
  provider: string;
  providerSlug: string;
  providerLogoUrl: string | null;
  summary: string | null;
  description: string | null;
  highlights: string[];
  category: string;
  tags: string[];
  level: string;
  priceType: string;
  priceAmount: number | null;
  priceCurrency: string | null;
  durationHours: number | null;
  url: string;
  affiliateUrl: string | null;
  affiliateNetwork: string | null;
  publishStatus: string;
  publishedAt: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  isFeatured: boolean;
  displayOrder: number;
};

const label: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-muted)", marginBottom: 4 };
const input: React.CSSProperties = {
  width: "100%", padding: "8px 11px", borderRadius: "var(--radius-sm)",
  border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: 13.5,
};
const field: React.CSSProperties = { marginBottom: 14 };
const btn = (kind: "primary" | "neutral" | "danger"): React.CSSProperties => ({
  padding: "8px 16px", borderRadius: "var(--radius-sm)", fontSize: 13, fontWeight: 600, cursor: "pointer",
  border: `1px solid ${kind === "danger" ? "var(--warn)" : "var(--line)"}`,
  background: kind === "primary" ? "var(--accent)" : "var(--surface)",
  color: kind === "primary" ? "var(--accent-ink)" : kind === "danger" ? "var(--warn)" : "var(--ink)",
});

function Text({
  id,
  value,
  onChange,
  ...rest
}: { id: string; value: string; onChange: (v: string) => void } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "id" | "value" | "onChange"
>) {
  return <input id={id} style={input} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />;
}

export function CertificationEditor({ certId }: { certId?: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const isEdit = Boolean(certId);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [cert, setCert] = useState<Cert | null>(null);

  // Flat string-form state; arrays are edited as text and split on submit.
  const [f, setF] = useState<Record<string, string>>({
    slug: "", title: "", provider: "", providerSlug: "", providerLogoUrl: "",
    summary: "", description: "", highlights: "", category: "", tags: "",
    level: "beginner", priceType: "free", priceAmount: "", priceCurrency: "INR",
    durationHours: "", url: "", affiliateUrl: "", affiliateNetwork: "", displayOrder: "100",
  });
  const [isFeatured, setIsFeatured] = useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const hydrate = useCallback((c: Cert) => {
    setCert(c);
    setF({
      slug: c.slug, title: c.title, provider: c.provider, providerSlug: c.providerSlug,
      providerLogoUrl: c.providerLogoUrl ?? "", summary: c.summary ?? "", description: c.description ?? "",
      highlights: (c.highlights ?? []).join("\n"), category: c.category, tags: (c.tags ?? []).join(", "),
      level: c.level, priceType: c.priceType, priceAmount: c.priceAmount == null ? "" : String(c.priceAmount),
      priceCurrency: c.priceCurrency ?? "INR", durationHours: c.durationHours == null ? "" : String(c.durationHours),
      url: c.url, affiliateUrl: c.affiliateUrl ?? "", affiliateNetwork: c.affiliateNetwork ?? "",
      displayOrder: String(c.displayOrder),
    });
    setIsFeatured(c.isFeatured);
  }, []);

  useEffect(() => {
    if (!certId) return;
    adminFetch(`/api/certifications/${certId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((c: Cert) => hydrate(c))
      .catch(() => showToast("Couldn't load this certification.", "error"))
      .finally(() => setLoading(false));
  }, [certId, hydrate, showToast]);

  const slugLocked = Boolean(cert?.publishedAt);

  function payload(overrides: Record<string, unknown> = {}) {
    return {
      slug: f.slug.trim(), title: f.title.trim(), provider: f.provider.trim(),
      providerSlug: f.providerSlug.trim(), providerLogoUrl: f.providerLogoUrl.trim(),
      summary: f.summary.trim(), description: f.description.trim(),
      highlights: f.highlights.split("\n").map((s) => s.trim()).filter(Boolean),
      category: f.category.trim(), tags: f.tags.split(",").map((s) => s.trim()).filter(Boolean),
      level: f.level, priceType: f.priceType,
      priceAmount: f.priceAmount.trim() === "" ? null : Number(f.priceAmount),
      priceCurrency: f.priceCurrency.trim() || "INR",
      durationHours: f.durationHours.trim() === "" ? null : Number(f.durationHours),
      url: f.url.trim(), affiliateUrl: f.affiliateUrl.trim(), affiliateNetwork: f.affiliateNetwork.trim(),
      isFeatured, displayOrder: Number(f.displayOrder) || 100,
      ...overrides,
    };
  }

  async function createNew(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await adminFetch("/api/certifications", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "Couldn't create.", "error"); return; }
      showToast("Created as draft.", "success");
      router.push(`/certifications/${data.id}`);
    } catch {
      showToast("Request failed.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function patch(overrides: Record<string, unknown>, successMsg: string) {
    if (!certId) return;
    setSaving(true);
    try {
      const res = await adminFetch(`/api/certifications/${certId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload(overrides)),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "Update failed.", "error"); return; }
      hydrate(data);
      showToast(successMsg, "success");
    } catch {
      showToast("Request failed.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!certId || !confirm("Delete this certification permanently?")) return;
    const res = await adminFetch(`/api/certifications/${certId}`, { method: "DELETE" });
    if (res.ok) { showToast("Deleted.", "success"); router.push("/certifications"); }
    else showToast("Delete failed.", "error");
  }

  if (loading) return <p style={{ color: "var(--ink-muted)", fontSize: 13 }}>Loading…</p>;

  // ---- Create mode: minimal required fields, then redirect to full edit ----
  if (!isEdit) {
    return (
      <form onSubmit={createNew} style={{ maxWidth: 640 }}>
        <div style={field}><label style={label} htmlFor="title">Title *</label><Text id="title" value={f.title} onChange={(v) => set("title", v)} required /></div>
        <div style={field}><label style={label} htmlFor="slug">Slug * (permanent URL segment)</label><Text id="slug" value={f.slug} onChange={(v) => set("slug", v)} placeholder="aws-certified-ai-practitioner" required /></div>
        <div style={field}><label style={label} htmlFor="provider">Provider *</label><Text id="provider" value={f.provider} onChange={(v) => set("provider", v)} placeholder="AWS" required /></div>
        <div style={field}><label style={label} htmlFor="providerSlug">Provider slug</label><Text id="providerSlug" value={f.providerSlug} onChange={(v) => set("providerSlug", v)} placeholder="aws" /></div>
        <div style={field}><label style={label} htmlFor="url">URL *</label><Text id="url" value={f.url} onChange={(v) => set("url", v)} placeholder="https://…" required /></div>
        <div style={field}><label style={label} htmlFor="category">Category *</label><Text id="category" value={f.category} onChange={(v) => set("category", v)} placeholder="cloud" required /></div>
        <button type="submit" disabled={saving} style={btn("primary")}>{saving ? "Creating…" : "Create draft"}</button>
      </form>
    );
  }

  // ---- Edit mode: full form ----
  const published = cert?.publishStatus === "published";
  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={field}><label style={label} htmlFor="title">Title</label><Text id="title" value={f.title} onChange={(v) => set("title", v)} /></div>
        <div style={field}>
          <label style={label} htmlFor="slug">Slug {slugLocked && "(locked — published)"}</label>
          <Text id="slug" value={f.slug} onChange={(v) => set("slug", v)} readOnly={slugLocked} style={{ ...input, background: slugLocked ? "var(--surface-hover)" : "var(--surface)" }} />
        </div>
        <div style={field}><label style={label} htmlFor="provider">Provider</label><Text id="provider" value={f.provider} onChange={(v) => set("provider", v)} /></div>
        <div style={field}><label style={label} htmlFor="providerSlug">Provider slug</label><Text id="providerSlug" value={f.providerSlug} onChange={(v) => set("providerSlug", v)} /></div>
        <div style={field}><label style={label} htmlFor="category">Category</label><Text id="category" value={f.category} onChange={(v) => set("category", v)} /></div>
        <div style={field}>
          <label style={label} htmlFor="level">Level</label>
          <select id="level" style={input} value={f.level} onChange={(e) => set("level", e.target.value)}>
            <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
          </select>
        </div>
        <div style={field}>
          <label style={label} htmlFor="priceType">Price type</label>
          <select id="priceType" style={input} value={f.priceType} onChange={(e) => set("priceType", e.target.value)}>
            <option value="free">Free</option><option value="freemium">Free to learn (pay to certify)</option><option value="paid">Paid</option>
          </select>
        </div>
        <div style={field}><label style={label} htmlFor="priceAmount">Price amount {f.priceType === "paid" && "(required to publish)"}</label><Text id="priceAmount" type="number" value={f.priceAmount} onChange={(v) => set("priceAmount", v)} /></div>
        <div style={field}><label style={label} htmlFor="priceCurrency">Currency</label><Text id="priceCurrency" value={f.priceCurrency} onChange={(v) => set("priceCurrency", v)} /></div>
        <div style={field}><label style={label} htmlFor="durationHours">Duration (hours)</label><Text id="durationHours" type="number" value={f.durationHours} onChange={(v) => set("durationHours", v)} /></div>
        <div style={field}><label style={label} htmlFor="url">URL (plain public link)</label><Text id="url" value={f.url} onChange={(v) => set("url", v)} /></div>
        <div style={field}><label style={label} htmlFor="affiliateUrl">Affiliate URL (preferred when set)</label><Text id="affiliateUrl" value={f.affiliateUrl} onChange={(v) => set("affiliateUrl", v)} /></div>
        <div style={field}><label style={label} htmlFor="affiliateNetwork">Affiliate network</label><Text id="affiliateNetwork" value={f.affiliateNetwork} onChange={(v) => set("affiliateNetwork", v)} placeholder="impact / cuelinks / direct" /></div>
        <div style={field}><label style={label} htmlFor="providerLogoUrl">Provider logo URL</label><Text id="providerLogoUrl" value={f.providerLogoUrl} onChange={(v) => set("providerLogoUrl", v)} /></div>
        <div style={field}><label style={label} htmlFor="displayOrder">Display order</label><Text id="displayOrder" type="number" value={f.displayOrder} onChange={(v) => set("displayOrder", v)} /></div>
      </div>

      <div style={field}><label style={label} htmlFor="summary">Summary (card one-liner)</label><Text id="summary" value={f.summary} onChange={(v) => set("summary", v)} /></div>
      <div style={field}>
        <label style={label} htmlFor="description">Description</label>
        <textarea id="description" style={{ ...input, minHeight: 120, resize: "vertical" }} value={f.description} onChange={(e) => set("description", e.target.value)} />
        <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "var(--ink-faint)" }}>Write this in our own words — do not paste the provider&apos;s marketing copy.</p>
      </div>
      <div style={field}><label style={label} htmlFor="highlights">Highlights (one per line)</label><textarea id="highlights" style={{ ...input, minHeight: 84, resize: "vertical" }} value={f.highlights} onChange={(e) => set("highlights", e.target.value)} /></div>
      <div style={field}><label style={label} htmlFor="tags">Tags (comma-separated)</label><Text id="tags" value={f.tags} onChange={(v) => set("tags", v)} /></div>
      <div style={{ ...field, display: "flex", alignItems: "center", gap: 8 }}>
        <input id="isFeatured" type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
        <label htmlFor="isFeatured" style={{ ...label, marginBottom: 0 }}>Featured</label>
      </div>

      <div style={{ fontSize: 12, color: "var(--ink-faint)", marginBottom: 12 }}>
        Status: <strong style={{ color: "var(--ink)" }}>{cert?.publishStatus}</strong>
        {cert?.verifiedAt ? ` · verified ${new Date(cert.verifiedAt).toLocaleDateString("en-GB")} by ${cert.verifiedBy ?? "—"}` : " · never verified"}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button disabled={saving} style={btn("neutral")} onClick={() => patch({}, "Saved.")}>Save</button>
        {!published ? (
          <button disabled={saving} style={btn("primary")} onClick={() => patch({ publishStatus: "published" }, "Published & verified.")}>Publish</button>
        ) : (
          <>
            <button disabled={saving} style={btn("neutral")} onClick={() => patch({ markVerified: true }, "Re-verified.")}>Mark verified</button>
            <button disabled={saving} style={btn("neutral")} onClick={() => patch({ publishStatus: "draft" }, "Unpublished.")}>Unpublish</button>
          </>
        )}
        <button disabled={saving} style={{ ...btn("danger"), marginLeft: "auto" }} onClick={remove}>Delete</button>
      </div>
    </div>
  );
}
