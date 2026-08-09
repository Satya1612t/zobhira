import { LlmQuota } from "@/components/LlmQuota";

export default function LlmPage() {
  return (
    <div>
      <p style={{ color: "var(--ink-muted)", marginTop: 0, marginBottom: 16, fontSize: 13.5 }}>
        Health and usage of the self-hosted FreeLLMAPI router, which aggregates free-tier quotas
        across its providers for description formatting. Read live from the router&apos;s own
        dashboard API.
      </p>
      <LlmQuota />
    </div>
  );
}
