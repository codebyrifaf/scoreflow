/**
 * The opening intro — the navy screen with the SF logo (public/OPENING.mp4) that
 * plays when someone first opens ScoreFlow.
 *
 * The rules, all in one place:
 *   • ONCE PER VISIT. It plays on the first page someone opens, then not again
 *     until they've been away for VISIT_GAP_MS (a "visit" ends after a break, the
 *     same way analytics tools count visits). Moving around the app never replays it.
 *   • NEVER for guests. Not on the QR feedback page a diner scans at the table (every
 *     second there costs responses, and that page wears the restaurant's brand, not
 *     ours), and not on the printable QR sheet.
 *   • At least MIN_VISIBLE_MS on screen; if the page still isn't loaded by then, the
 *     video keeps looping until it is; then it fades away (IntroController).
 *   • A safety net: if the app never finishes loading at all (a script failed to
 *     download), it removes itself after FAILSAFE_MS, so nobody is ever trapped
 *     behind it.
 *
 * Shared by the root layout (the tiny script that decides, before the first paint,
 * whether to show it) and IntroController (the client code that closes it).
 * Plain values only — safe on both server and client.
 */

/** At least this long on screen, measured from the first paint. */
export const MIN_VISIBLE_MS = 5000;

/** How long the closing fade takes. Kept in step with `sf-intro-out` in globals.css. */
export const CLOSE_MS = 900;

/** Away this long, and the next page you open is a new visit (and gets the intro). */
export const VISIT_GAP_MS = 30 * 60 * 1000;

/** If the app hasn't loaded by now, give up on waiting and show the page anyway. */
export const FAILSAFE_MS = 20_000;

/** Where "last active" is remembered (this browser only; nothing personal). */
export const LAST_ACTIVE_KEY = "sf-last-active";

/** The video, started 0.3s in — its very first frames are plain navy, before the logo. */
export const INTRO_VIDEO_SRC = "/OPENING.mp4#t=0.3";

/** One frame of the video (at 0.3s): shown instantly, and as the still version for
 *  anyone whose device asks for reduced motion. */
export const INTRO_POSTER_SRC = "/opening-poster.jpg";

/**
 * Pages that never show the intro (regular-expression sources, tested against the
 * address path). Guests: the feedback page and the review hand-off. Print: the QR sheet.
 */
export const NO_INTRO_PATHS = [
  "^/r/[^/]+/feedback(/|$)",
  "^/r/[^/]+/go-review(/|$)",
  "^/r/[^/]+/tables/print(/|$)",
];

/** Remember "this person is active right now". Never throws (private browsing can). */
export function markActive(): void {
  try {
    localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
  } catch {
    // Storage blocked: the intro then simply plays once per page load.
  }
}

/**
 * The script that runs in <head>, BEFORE the page is drawn, and decides whether
 * this page load gets the intro. It has to run that early: deciding any later would
 * flash the navy screen at returning visitors (and at guests) before hiding it.
 *
 * It only sets `data-intro="on"` on <html>; globals.css does the showing. Old-style
 * JavaScript on purpose — it runs before anything else has loaded, on any browser.
 */
export function introDecisionScript(): string {
  return `(function(){try{
var h=document.documentElement,p=location.pathname,skip=${JSON.stringify(NO_INTRO_PATHS)};
for(var i=0;i<skip.length;i++){if(new RegExp(skip[i]).test(p))return;}
var now=Date.now(),last=0;
try{last=Number(localStorage.getItem(${JSON.stringify(LAST_ACTIVE_KEY)}))||0;localStorage.setItem(${JSON.stringify(LAST_ACTIVE_KEY)},String(now));}catch(e){}
if(now-last<${VISIT_GAP_MS})return;
h.setAttribute("data-intro","on");
setTimeout(function(){if(h.getAttribute("data-intro")!=="on")return;h.setAttribute("data-intro","closing");setTimeout(function(){h.removeAttribute("data-intro");},${CLOSE_MS});},${FAILSAFE_MS});
}catch(e){}})();`;
}

/**
 * The script placed right after the <video>: starts it the moment it's parsed — long
 * before React has loaded — but ONLY when the intro is showing, so pages without the
 * intro never download the video at all. Muted + inline are set here rather than
 * trusted to the HTML, because phones refuse to autoplay anything that isn't both.
 */
export function introVideoScript(): string {
  return `(function(){try{
var h=document.documentElement;if(h.getAttribute("data-intro")!=="on")return;
var v=document.getElementById("sf-intro-video");if(!v)return;
v.poster=${JSON.stringify(INTRO_POSTER_SRC)};
if(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches)return;
v.muted=true;v.defaultMuted=true;v.playsInline=true;v.setAttribute("playsinline","");v.loop=true;
v.preload="auto";v.src=${JSON.stringify(INTRO_VIDEO_SRC)};
var r=v.play();if(r&&r.catch)r.catch(function(){});
}catch(e){}})();`;
}
