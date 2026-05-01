"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Top-level error boundary. Used when the root layout itself fails to
 * render — Next.js renders this as a full-page replacement. Always
 * include `<html>` + `<body>` because Next.js does not wrap this fallback
 * with the root layout.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[app/global-error] root crashed:", error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#f8f6f1",
          color: "#1a1a1a",
          minHeight: "100vh",
          margin: 0,
          padding: "4rem 1.5rem",
        }}
      >
        <div
          style={{
            maxWidth: "32rem",
            margin: "0 auto",
            background: "#ffffff",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: "12px",
            padding: "1.5rem",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "1.25rem" }}>
            Something went wrong
          </h1>
          <p
            style={{
              marginTop: "0.5rem",
              fontSize: "0.875rem",
              color: "rgba(0,0,0,0.6)",
            }}
          >
            We hit an unexpected error. Try again, or head back to the
            picker.
          </p>
          {error.digest ? (
            <p
              style={{
                marginTop: "0.5rem",
                fontSize: "0.75rem",
                color: "rgba(0,0,0,0.5)",
              }}
            >
              Reference: <code>{error.digest}</code>
            </p>
          ) : null}
          <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                border: "1px solid rgba(0,0,0,0.12)",
                background: "#ffffff",
                color: "#1a1a1a",
                padding: "0.5rem 0.75rem",
                fontSize: "0.75rem",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                background: "#0e3a2f",
                color: "#d6e15a",
                padding: "0.5rem 0.75rem",
                fontSize: "0.75rem",
                borderRadius: "6px",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
