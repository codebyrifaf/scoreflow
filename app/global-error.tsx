"use client";

/**
 * The last line of defence (Milestone 19 — safety net).
 *
 * `app/error.tsx` catches errors thrown while rendering a PAGE — but it renders
 * *inside* the root layout, so it can't help if the ROOT LAYOUT ITSELF throws.
 * That's what this file is for. It replaces the whole document, which is why it
 * has to supply its own <html> and <body> tags (the only component in the app that
 * does).
 *
 * It should almost never be seen. But "almost never" is exactly when you don't
 * want a raw stack trace on screen — so it's deliberately dependency-free, with
 * inline styles rather than Tailwind classes, because if the layout blew up we
 * cannot assume the stylesheet loaded either.
 */

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global] root layout crashed:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "3rem 1.25rem",
          textAlign: "center",
          background: "#fff",
          color: "#111827",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>
          Something went wrong
        </h1>
        <p style={{ color: "#6B7280", maxWidth: "28rem", margin: 0 }}>
          ScoreFlow hit an unexpected problem. Please try again in a moment.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "0.5rem",
            border: "none",
            borderRadius: "1rem",
            background: "#F59E0B",
            color: "#fff",
            padding: "0.75rem 1.5rem",
            fontSize: "1rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
