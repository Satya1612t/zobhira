/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emits a minimal .next/standalone folder (only the files actually needed
  // to run, not the full node_modules tree) — what the production Docker
  // image copies in, so the runtime image stays small.
  output: "standalone",
  // AVIF/WebP for the new generated imagery (Figure/AspectBox, see
  // components/ui/) — scraped company logos still go through CompanyLogo's
  // plain <img> tag, untouched by this.
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // /live was renamed to /today (see Prompt 13) — permanent redirect so old
  // links/bookmarks/search results still resolve.
  async redirects() {
    return [{ source: "/live", destination: "/today", permanent: true }];
  },
  // Google sign-in on /login uses Firebase signInWithPopup, which needs the
  // popup to hand the token back to the opener. The default COOP
  // (same-origin) blocks window.closed across the popup boundary and the
  // sign-in silently fails — same fix apps/admin's next.config.js already
  // carries. Scoped to /login so the rest of the site keeps the stricter COOP.
  async headers() {
    return [
      {
        source: "/login",
        headers: [{ key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" }],
      },
    ];
  },
};

module.exports = nextConfig;
