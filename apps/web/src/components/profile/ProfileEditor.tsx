"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Entry = Record<string, string>;
export type EditorProfile = {
  basics: { fullName: string; email: string | null; phone: string; city: string };
  headline: string;
  summary: string;
  links: { github: string; linkedin: string; portfolio: string };
  education: Entry[];
  experience: Entry[];
  projects: Entry[];
  achievements: Entry[];
  skills: string[];
};

const field: React.CSSProperties = {
  width: "100%", padding: "8px 11px", borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-divider)", background: "var(--color-surface)",
  color: "var(--color-text)", fontSize: 13.5,
};
const label: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 4 };

const SECTION_FIELDS: Record<string, { key: string; label: string; long?: boolean }[]> = {
  education: [
    { key: "school", label: "School / College" }, { key: "degree", label: "Degree" },
    { key: "field", label: "Field of study" }, { key: "start", label: "Start" },
    { key: "end", label: "End" }, { key: "grade", label: "Grade / CGPA" },
  ],
  experience: [
    { key: "company", label: "Company" }, { key: "role", label: "Role" },
    { key: "start", label: "Start" }, { key: "end", label: "End" },
    { key: "description", label: "What you did", long: true },
  ],
  projects: [
    { key: "name", label: "Project name" }, { key: "tech", label: "Tech used" },
    { key: "link", label: "Link" }, { key: "description", label: "Description", long: true },
  ],
  achievements: [
    { key: "title", label: "Achievement" }, { key: "detail", label: "Detail", long: true },
  ],
};
const SECTION_TITLES: Record<string, string> = {
  education: "Education", experience: "Experience", projects: "Projects", achievements: "Achievements",
};

function Repeatable({
  name, items, onChange,
}: {
  name: keyof typeof SECTION_FIELDS;
  items: Entry[];
  onChange: (items: Entry[]) => void;
}) {
  const fields = SECTION_FIELDS[name];
  const update = (i: number, key: string, val: string) => {
    const next = items.map((e, idx) => (idx === i ? { ...e, [key]: val } : e));
    onChange(next);
  };
  const add = () => onChange([...items, {}]);
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <section style={{ marginBottom: 26 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", fontWeight: 600, margin: 0 }}>{SECTION_TITLES[name]}</h3>
        <button type="button" className="btn btn-secondary" style={{ height: 32, fontSize: 12.5 }} onClick={add}>+ Add</button>
      </div>
      {items.length === 0 && <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0 }}>Nothing added yet.</p>}
      {items.map((entry, i) => (
        <div key={i} className="card" style={{ padding: 14, marginBottom: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {fields.map((f) => (
              <div key={f.key} style={{ gridColumn: f.long ? "1 / -1" : "auto" }}>
                <label style={label}>{f.label}</label>
                {f.long ? (
                  <textarea style={{ ...field, minHeight: 70, resize: "vertical" }} value={entry[f.key] ?? ""} onChange={(e) => update(i, f.key, e.target.value)} />
                ) : (
                  <input style={field} value={entry[f.key] ?? ""} onChange={(e) => update(i, f.key, e.target.value)} />
                )}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="button" className="btn btn-secondary" style={{ height: 30, fontSize: 12 }} onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
            <button type="button" className="btn btn-secondary" style={{ height: 30, fontSize: 12 }} onClick={() => move(i, 1)} disabled={i === items.length - 1}>↓</button>
            <button type="button" className="btn btn-secondary" style={{ height: 30, fontSize: 12, marginLeft: "auto", color: "var(--color-error)" }} onClick={() => remove(i)}>Delete</button>
          </div>
        </div>
      ))}
    </section>
  );
}

function SkillsInput({ skills, onChange }: { skills: string[]; onChange: (s: string[]) => void }) {
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (q.trim().length < 2) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/skills/suggest?q=${encodeURIComponent(q)}`);
        const data: { skills: string[] } = await res.json();
        setSuggestions(data.skills.filter((s) => !skills.includes(s)));
      } catch { /* ignore */ }
    }, 200);
    return () => clearTimeout(t);
  }, [q, skills]);

  const add = (s: string) => {
    const v = s.trim();
    if (!v || skills.includes(v)) return;
    onChange([...skills, v]);
    setQ("");
    setSuggestions([]);
  };

  return (
    <section style={{ marginBottom: 26 }}>
      <h3 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", fontWeight: 600, margin: "0 0 10px" }}>Skills</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {skills.map((s) => (
          <span key={s} className="tag tag-neutral" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {s}
            <button type="button" onClick={() => onChange(skills.filter((x) => x !== s))} aria-label={`Remove ${s}`} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 0, lineHeight: 1 }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ position: "relative", maxWidth: 360 }}>
        <input
          style={field}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(q); } }}
          placeholder="Type a skill, e.g. React"
        />
        {suggestions.length > 0 && (
          <div className="card" style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 5, marginTop: 4, padding: 4, maxHeight: 220, overflowY: "auto" }}>
            {suggestions.map((s) => (
              <button key={s} type="button" onClick={() => add(s)} style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 8px", border: "none", background: "none", cursor: "pointer", fontSize: 13, color: "var(--color-text)", borderRadius: "var(--radius-sm)" }}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      <p style={{ fontSize: 11.5, color: "var(--color-text-muted)", margin: "6px 0 0" }}>
        Skills match our known vocabulary so we can pair you with jobs. Unrecognised terms are noted but not saved.
      </p>
    </section>
  );
}

function completeness(p: EditorProfile) {
  const checks: { done: boolean; hint: string }[] = [
    { done: !!p.basics.fullName, hint: "Add your name" },
    { done: !!p.headline, hint: "Add a headline (e.g. “Final-year CS student”)" },
    { done: !!p.summary, hint: "Write a short summary — it's the first thing recruiters read" },
    { done: p.education.length > 0, hint: "Add your education" },
    { done: p.experience.length > 0 || p.projects.length > 0, hint: "Add one project — resumes with projects get more replies" },
    { done: p.skills.length >= 3, hint: "Add at least 3 skills so we can match you to jobs" },
    { done: !!(p.links.github || p.links.linkedin || p.links.portfolio), hint: "Add a GitHub or LinkedIn link" },
  ];
  const done = checks.filter((c) => c.done).length;
  return { pct: Math.round((done / checks.length) * 100), missing: checks.filter((c) => !c.done).map((c) => c.hint) };
}

export function ProfileEditor({ initial }: { initial: EditorProfile }) {
  const [profile, setProfile] = useState<EditorProfile>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [unknownSkills, setUnknownSkills] = useState<string[]>([]);
  const firstRender = useRef(true);

  const save = useCallback(async (p: EditorProfile) => {
    setStatus("saving");
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          basics: { fullName: p.basics.fullName, phone: p.basics.phone, city: p.basics.city },
          headline: p.headline, summary: p.summary, links: p.links,
          education: p.education, experience: p.experience, projects: p.projects,
          achievements: p.achievements, skills: p.skills,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUnknownSkills(data.unknownSkills ?? []);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }, []);

  // Debounced autosave — a resume form is long and often filled on a phone;
  // losing it to a closed tab is the main reason these tools get abandoned.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    setStatus("saving");
    const t = setTimeout(() => save(profile), 1200);
    return () => clearTimeout(t);
  }, [profile, save]);

  const patch = (p: Partial<EditorProfile>) => setProfile((prev) => ({ ...prev, ...p }));
  const { pct, missing } = completeness(profile);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 280px", gap: 28, alignItems: "start" }} className="profile-editor-grid">
      <div>
        <section style={{ marginBottom: 26 }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", fontWeight: 600, margin: "0 0 10px" }}>Basics</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><label style={label}>Full name</label><input style={field} value={profile.basics.fullName} onChange={(e) => patch({ basics: { ...profile.basics, fullName: e.target.value } })} /></div>
            <div><label style={label}>City</label><input style={field} value={profile.basics.city} onChange={(e) => patch({ basics: { ...profile.basics, city: e.target.value } })} /></div>
            <div><label style={label}>Phone</label><input style={field} value={profile.basics.phone} onChange={(e) => patch({ basics: { ...profile.basics, phone: e.target.value } })} /></div>
            <div><label style={label}>Email</label><input style={{ ...field, opacity: 0.7 }} value={profile.basics.email ?? ""} readOnly /></div>
            <div style={{ gridColumn: "1 / -1" }}><label style={label}>Headline</label><input style={field} value={profile.headline} onChange={(e) => patch({ headline: e.target.value })} placeholder="Final-year CS student · aspiring backend engineer" /></div>
            <div style={{ gridColumn: "1 / -1" }}><label style={label}>Summary</label><textarea style={{ ...field, minHeight: 90, resize: "vertical" }} value={profile.summary} onChange={(e) => patch({ summary: e.target.value })} /></div>
          </div>
        </section>

        <Repeatable name="education" items={profile.education} onChange={(education) => patch({ education })} />
        <Repeatable name="experience" items={profile.experience} onChange={(experience) => patch({ experience })} />
        <Repeatable name="projects" items={profile.projects} onChange={(projects) => patch({ projects })} />
        <SkillsInput skills={profile.skills} onChange={(skills) => patch({ skills })} />
        <Repeatable name="achievements" items={profile.achievements} onChange={(achievements) => patch({ achievements })} />

        <section style={{ marginBottom: 26 }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", fontWeight: 600, margin: "0 0 10px" }}>Links</h3>
          <div style={{ display: "grid", gap: 10, maxWidth: 460 }}>
            <div><label style={label}>GitHub</label><input style={field} value={profile.links.github} onChange={(e) => patch({ links: { ...profile.links, github: e.target.value } })} /></div>
            <div><label style={label}>LinkedIn</label><input style={field} value={profile.links.linkedin} onChange={(e) => patch({ links: { ...profile.links, linkedin: e.target.value } })} /></div>
            <div><label style={label}>Portfolio</label><input style={field} value={profile.links.portfolio} onChange={(e) => patch({ links: { ...profile.links, portfolio: e.target.value } })} /></div>
          </div>
        </section>
      </div>

      {/* Sticky completeness rail — the mechanism that gets a profile finished. */}
      <aside className="card" style={{ padding: 18, position: "sticky", top: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Profile completeness</div>
        <div style={{ height: 8, borderRadius: 99, background: "var(--color-divider)", overflow: "hidden", marginBottom: 6 }}>
          <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "var(--color-success)" : "var(--color-accent)", transition: "width .3s ease" }} />
        </div>
        <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 12 }}>{pct}% complete</div>
        {missing.length > 0 ? (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {missing.map((m) => (
              <li key={m} style={{ fontSize: 12.5, color: "var(--color-text-muted)", display: "flex", gap: 6 }}>
                <span style={{ color: "var(--color-accent)" }}>○</span>{m}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: 12.5, color: "var(--color-success)", margin: 0 }}>All set — your profile is complete.</p>
        )}
        <div style={{ marginTop: 14, fontSize: 12, color: "var(--color-text-muted)" }}>
          {status === "saving" && "Saving…"}
          {status === "saved" && "✓ Saved"}
          {status === "error" && <span style={{ color: "var(--color-error)" }}>Couldn&apos;t save — check your connection.</span>}
        </div>
        {unknownSkills.length > 0 && (
          <p style={{ marginTop: 10, fontSize: 11.5, color: "var(--color-text-muted)" }}>
            Not in our skill list (noted, not saved): {unknownSkills.join(", ")}
          </p>
        )}
      </aside>
    </div>
  );
}
