// Best-effort freellmapi fallback for the /api/dispatch/pending route —
// invoked only when jobInsights.ts's deterministic regex/keyword pass finds
// no skills and/or no experience line for a job. Never called in the send
// path itself, and never allowed to fail or delay that path: any error or
// timeout here just means the caller falls back to omitting the field, the
// same outcome as "the deterministic pass found nothing" would produce on
// its own.
//
// Uses the same self-hosted, OpenAI-compatible proxy the Python scraper
// already talks to (see services/scraper/scrapers/llm_fallback.py) — same
// "openai/auto" router-alias model id, same base_url + bearer-key shape.

const TIMEOUT_MS = 5000;

export interface JobSignals {
  skills: string[];
  experience: string | null;
}

const EMPTY: JobSignals = { skills: [], experience: null };

export async function inferJobSignals(description: string | null): Promise<JobSignals> {
  const baseUrl = process.env.FREELLMAPI_BASE_URL;
  const apiKey = process.env.FREELLMAPI_API_KEY;
  if (!baseUrl || !apiKey || !description) return EMPTY;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "auto",
        messages: [
          {
            role: "user",
            content:
              "Extract the required technical skills and experience level from this job " +
              "description. Respond with ONLY valid JSON in exactly this shape, no other " +
              'text: {"skills": ["..."], "experience": "..."}. `experience` should be a ' +
              'short phrase like "2-4 years" or "Entry level", or null if the description ' +
              "does not state one. If no skills are mentioned, use an empty array. " +
              "Do not guess or invent anything not implied by the text.\n\n" +
              `Description:\n${description}`,
          },
        ],
      }),
    });

    if (!res.ok) return EMPTY;

    const data = await res.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) return EMPTY;

    const parsed = JSON.parse(content);
    return {
      skills: Array.isArray(parsed?.skills) ? parsed.skills.filter((s: unknown) => typeof s === "string") : [],
      experience: typeof parsed?.experience === "string" ? parsed.experience : null,
    };
  } catch {
    return EMPTY;
  } finally {
    clearTimeout(timeout);
  }
}
