/**
 * The opening intro screen — see lib/opening-intro.ts for the rules (once per visit,
 * never for guests, at least 5 seconds, loops until the page has loaded).
 *
 * SERVER component: this markup is in every page's HTML, so when the intro is due it
 * is on screen from the very first paint — before any of the app's JavaScript has
 * arrived. It is HIDDEN by default (globals.css); the decision script in <head> turns
 * it on by setting `data-intro="on"` on <html>. On pages that don't show it, the
 * video is never downloaded (it has no `src` until the script below gives it one).
 *
 * IntroController (client) closes it once the page is ready.
 */

import IntroController from "./IntroController";
import { introVideoScript } from "@/lib/opening-intro";

export default function OpeningIntro() {
  return (
    <>
      <div className="sf-intro" aria-hidden="true">
        {/* No src/poster here on purpose — the script right below adds them only
            when the intro is actually showing. Because that script changes this
            element before React loads, React is told not to treat the difference
            as a mistake (`suppressHydrationWarning` — this element only). */}
        <video
          id="sf-intro-video"
          className="sf-intro-video"
          preload="none"
          muted
          playsInline
          suppressHydrationWarning
        />
        <script dangerouslySetInnerHTML={{ __html: introVideoScript() }} />
      </div>
      <IntroController />
    </>
  );
}
