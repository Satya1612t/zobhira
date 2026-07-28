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
};

module.exports = nextConfig;
