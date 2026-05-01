"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Route-segment error boundary. Wraps every page so an exception in a
 * Server Component renders a user-friendly fallback instead of a blank
 * 500 page (which Railway surfaces as "Application error: server-side
 * exception"). The error is logged to the console (so it shows up in
 * Railway logs) AND reported to Sentry if a DSN is configured.
 */
export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Always log so Railway captures it.
    // eslint-disable-next-line no-console
    console.error("[app/error] route segment crashed:", error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[var(--color-background)] px-6 py-16">
      <div className="mx-auto max-w-md rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)]">
        <h1 className="app-heading text-xl text-[var(--color-charcoal)]">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          We hit an unexpected error rendering this page. The team has been
          notified.
        </p>
        {error.digest ? (
          <p className="mt-2 text-[11px] text-[var(--color-charcoal-300)]">
            Reference: <code>{error.digest}</code>
          </p>
        ) : null}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs text-[var(--color-charcoal-500)] shadow-[var(--shadow-soft)] hover:bg-[var(--color-virgil)]"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-md bg-[var(--color-forest)] px-3 py-1.5 text-xs font-medium text-[var(--color-lime)] hover:opacity-90"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
