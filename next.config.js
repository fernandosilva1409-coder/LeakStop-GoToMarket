/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Produces a minimal, self-contained server bundle in .next/standalone
  // (only the files actually used), which is what the Docker image runs on
  // Fly.io — no need to ship node_modules or run `next start` with the full tree.
  output: "standalone",
};

module.exports = nextConfig;
