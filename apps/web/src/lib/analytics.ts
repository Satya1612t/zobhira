export type Attribution = {
  source: string;
  medium: string | null;
  campaign: string | null;
};

// In-app browsers (Instagram, YouTube, Facebook) strip or rewrite the referrer,
// so referrer alone under-reports social badly and dumps it into "direct".
// UTM wins whenever it's present — which is why every posted link must carry one.
const REFERRER_HOSTS: Array<[RegExp, string]> = [
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)youtube\.com$/, "youtube"],
  [/(^|\.)youtu\.be$/, "youtube"],
  [/(^|\.)(facebook|fb)\.com$/, "facebook"],
  [/(^|\.)linkedin\.com$/, "linkedin"],
  [/(^|\.)lnkd\.in$/, "linkedin"],
  [/(^|\.)(twitter|x)\.com$/, "twitter"],
  [/(^|\.)t\.co$/, "twitter"],
  [/(^|\.)reddit\.com$/, "reddit"],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, "whatsapp"],
  [/(^|\.)t\.me$/, "telegram"],
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
];

const MAX_SOURCE_LEN = 64;

export function resolveAttribution(
  params: URLSearchParams,
  referrer: string | null,
  selfHost: string
): Attribution {
  const clean = (v: string | null) =>
    v ? v.toLowerCase().trim().slice(0, MAX_SOURCE_LEN) || null : null;

  const utmSource = clean(params.get("utm_source"));
  const medium = clean(params.get("utm_medium"));
  const campaign = clean(params.get("utm_campaign"));

  // 1. UTM tag always wins.
  if (utmSource) return { source: utmSource, medium, campaign };

  // 2. Referrer hostname.
  if (referrer) {
    try {
      const host = new URL(referrer).hostname.toLowerCase();
      if (host === selfHost) return { source: "internal", medium, campaign };
      for (const [pattern, name] of REFERRER_HOSTS) {
        if (pattern.test(host)) return { source: name, medium: medium ?? "referral", campaign };
      }
      return { source: host.slice(0, MAX_SOURCE_LEN), medium: medium ?? "referral", campaign };
    } catch {
      // Malformed referrer — fall through to direct.
    }
  }

  // 3. Nothing to go on.
  return { source: "direct", medium, campaign };
}
