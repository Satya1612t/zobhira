import { LlmQuota } from "@/components/LlmQuota";
import { FormattingProgress } from "@/components/FormattingProgress";

export default function LlmPage() {
  return (
    <div>
      <p style={{ color: "var(--ink-muted)", marginTop: 0, marginBottom: 16, fontSize: 13.5 }}>
        Health and usage of the self-hosted FreeLLMAPI router, which aggregates free-tier quotas
        across its providers for description formatting. Read live from the router&apos;s own
        dashboard API.
      </p>
      <LlmQuota />

      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: "28px 0 12px" }}>
        Description formatting
      </h2>
      <p style={{ color: "var(--ink-muted)", marginTop: 0, marginBottom: 12, fontSize: 13.5 }}>
        The pass that spends this quota: it upgrades jobs from their plain-text description to
        LLM-structured sections. Runs on a schedule; trigger it here to drain the backlog now.
      </p>
      <FormattingProgress />
    </div>
  );
}
