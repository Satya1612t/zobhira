// Baseline security headers for an admin panel that can delete jobs/contests
// and trigger scraper runs — clickjacking/MIME-sniff/referrer-leak protection
// applies to every response, and the CSP is scoped to what this app actually
// loads: Next's own bundle, Firebase Auth's persistence iframe + popup sign-in
// (authDomain is always *.firebaseapp.com), and Firebase Analytics' gtag.js.
// Next's dev-mode Fast Refresh runtime evals a string to patch modules on
// every save — production bundles don't include it, so 'unsafe-eval' is only
// added outside production and the shipped CSP stays strict.
//
// getAuth()/signInWithPopup() also proactively load Google's gapi client
// (https://apis.google.com/js/api.js) to run Firebase's popup-redirect
// resolver, which injects its own inline bootstrap script with fresh,
// randomly-generated content on every single page load — a new sha256 hash
// each time, so hash-allowlisting can never keep up. 'unsafe-inline' is the
// only workable option for this one directive; it's the standard tradeoff
// for apps using Google Identity/gapi-based sign-in. (Note: per the CSP
// spec, 'unsafe-inline' is ignored by modern browsers if any hash/nonce
// source is also present in script-src — so it must be the only inline
// allowance here, not layered alongside a hash.)
const scriptSrc = ["'self'", "https://www.googletagmanager.com", "https://apis.google.com", "'unsafe-inline'"];
if (process.env.NODE_ENV !== "production") scriptSrc.push("'unsafe-eval'");

const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Firebase Google sign-in opens a popup to accounts.google.com, which
  // serves a strict COOP. Without matching `same-origin-allow-popups` here,
  // the browser severs the opener↔popup link ("Cross-Origin-Opener-Policy
  // policy would block the window.closed call"), so signInWithPopup can't
  // hand the signed-in user back — currentUser stays null and the ID token
  // comes back undefined. `same-origin-allow-popups` keeps our own isolation
  // while still letting popups we open talk back to us.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
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
      "connect-src 'self' https://*.googleapis.com https://apis.google.com https://*.google-analytics.com https://*.analytics.google.com https://*.firebaseapp.com",
      "frame-src https://*.firebaseapp.com https://accounts.google.com https://apis.google.com",
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
