/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emits a minimal .next/standalone folder (only the files actually needed
  // to run, not the full node_modules tree) — what the production Docker
  // image copies in, so the runtime image stays small.
  output: "standalone",
};

module.exports = nextConfig;
