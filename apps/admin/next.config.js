/** @type {import('next').NextConfig} */
const nextConfig = {
  // Same reasoning as apps/web's — emits a minimal .next/standalone folder
  // for a lean production Docker image.
  output: "standalone",
};

module.exports = nextConfig;
