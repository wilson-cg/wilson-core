import path from "node:path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Silence workspace-root inference warning when this app sits inside a
  // parent directory (gstack-main) that has its own lockfile.
  outputFileTracingRoot: path.join(__dirname),
};

export default withSentryConfig(nextConfig, {
  // Suppress build-time logging unless a DSN is configured.
  silent: !process.env.SENTRY_DSN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Skip uploading source maps when no auth token is set (e.g. local builds).
  disableLogger: true,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  automaticVercelMonitors: false,
});
