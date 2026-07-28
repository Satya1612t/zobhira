// Baseline security headers for an admin panel that can delete jobs/contests
// and trigger scraper runs — clickjacking/MIME-sniff/referrer-leak protection
// applies to every response, and the CSP is scoped to what this app actually
// loads: Next's own bundle, Firebase Auth's persistence iframe + popup sign-in
// (authDomain is always *.firebaseapp.com), and Firebase Analytics' gtag.js.
// Next's dev-mode Fast Refresh runtime evals a string to patch modules on
// every save — production bundles don't include it, so 'unsafe-eval' is only
// added outside production and the shipped CSP stays strict.
const scriptSrc = ["'self'", "https://www.googletagmanager.com"];
if (process.env.NODE_ENV !== "production") scriptSrc.push("'unsafe-eval'");

const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Only takes effect over HTTPS (prod, behind nginx/Let's Encrypt) — browsers
  // ignore it on plain http, so it's harmless in local dev.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src ${scriptSrc.join(" ")}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.googleapis.com https://*.google-analytics.com https://*.analytics.google.com https://*.firebaseapp.com",
      "frame-src https://*.firebaseapp.com https://accounts.google.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Same reasoning as apps/web's — emits a minimal .next/standalone folder
  // for a lean production Docker image.
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
};

module.exports = nextConfig;
