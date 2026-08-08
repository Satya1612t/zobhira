import { CompaniesManager } from "@/components/CompaniesManager";

export default function CompaniesPage() {
  return (
    <div>
      <p style={{ color: "var(--ink-muted)", marginTop: 0, marginBottom: 16, fontSize: 13.5 }}>
        Companies whose hiring-software board (Greenhouse, Lever, Ashby, SmartRecruiters, Workable,
        Recruitee) the feed layer polls for India roles. Add one by pasting its careers URL — the ATS
        and token are auto-detected and verified against the live board first.
      </p>
      <CompaniesManager />
    </div>
  );
}
