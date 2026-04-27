import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Silence workspace-root inference warning when this app sits inside a
  // parent directory (gstack-main) that has its own lockfile.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
