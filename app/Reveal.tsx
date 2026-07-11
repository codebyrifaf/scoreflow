"use client";

/**
 * Scroll-reveal wrapper (Milestone 15).
 *
 * Adds `is-visible` to itself the first time it scrolls into view; the actual
 * fade + rise lives in CSS (`.reveal` in globals.css), so this stays tiny.
 * Children can also react to `.is-visible` (see `.split-left` / `.hairline-draw`).
 *
 * Safety: if IntersectionObserver is unavailable, we reveal immediately — content
 * must never be left stuck at opacity 0.
 */

import { useEffect, useRef, type ReactNode } from "react";

export default function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  /** Stagger, in ms. */
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // No IntersectionObserver → just show it.
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("is-visible");
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target); // reveal once, then stop watching
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
