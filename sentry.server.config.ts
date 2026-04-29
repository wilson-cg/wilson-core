import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled:
    process.env.NODE_ENV === "production" && Boolean(process.env.SENTRY_DSN),
  tracesSampleRate: 0.1,
  release: process.env.RAILWAY_GIT_COMMIT_SHA ?? "unknown",
});
