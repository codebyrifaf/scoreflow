"use client";

/**
 * Closes the opening intro (OpeningIntro / lib/opening-intro.ts) at the right moment:
 * when it has been on screen at least MIN_VISIBLE_MS AND the page has finished
 * loading — whichever comes LAST. Until then the video simply keeps looping.
 *
 * Closing = `data-intro="closing"` on <html>, which plays the fade in globals.css;
 * after the fade the attribute is removed and the video is stopped (no point
 * decoding a video nobody can see).
 *
 * It also keeps "last active" fresh as the person moves around the app, so the
 * intro only returns after a real break — not halfway through a working session.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { CLOSE_MS, MIN_VISIBLE_MS, markActive } from "@/lib/opening-intro";

export default function IntroController() {
  const pathname = usePathname();

  // Every page they move to counts as activity…
  useEffect(() => {
    markActive();
  }, [pathname]);

  // …and so does the moment they leave (closing the tab, going to Square, etc.).
  useEffect(() => {
    window.addEventListener("pagehide", markActive);
    return () => window.removeEventListener("pagehide", markActive);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    if (html.getAttribute("data-intro") !== "on") return; // not showing on this load

    let cancelled = false;
    const timers: number[] = [];

    // At least MIN_VISIBLE_MS from when the screen was first drawn.
    const firstPaint =
      performance.getEntriesByType("paint").find((e) => e.name === "first-paint")?.startTime ?? 0;
    const longEnough = new Promise<void>((resolve) => {
      timers.push(
        window.setTimeout(resolve, Math.max(0, firstPaint + MIN_VISIBLE_MS - performance.now()))
      );
    });

    // "The interface has loaded" = the browser's load event: the page and everything
    // it needs (scripts, styles, images) have arrived.
    const loaded =
      document.readyState === "complete"
        ? Promise.resolve()
        : new Promise<void>((resolve) =>
            window.addEventListener("load", () => resolve(), { once: true })
          );

    Promise.all([longEnough, loaded]).then(() => {
      // The safety net in <head> may already have closed it.
      if (cancelled || html.getAttribute("data-intro") !== "on") return;
      html.setAttribute("data-intro", "closing");
      timers.push(
        window.setTimeout(() => {
          html.removeAttribute("data-intro");
          const video = document.getElementById("sf-intro-video") as HTMLVideoElement | null;
          if (video) {
            video.pause();
            video.removeAttribute("src");
            video.load(); // releases the video completely
          }
        }, CLOSE_MS)
      );
    });

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  return null;
}
