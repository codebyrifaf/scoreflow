/**
 * The ScoreFlow logo for WHITE backgrounds: the SF mark beside the name.
 *
 *   • The mark is public/scoreflow-mark.png — the owner's own logo
 *     (public/scoreflow_logo.png) with its white "S" turned brand navy so it shows
 *     on white, the teal "F" untouched, and the empty margin trimmed.
 *   • The name is two-tone like the opening video: "Score" in navy, "Flow" in teal
 *     (aqua-700, the teal that's readable as text on white).
 *
 * Used in the landing page's top bar and footer. On the navy opening screen and the
 * app icons the original white-S logo is used instead.
 */

import Image from "next/image";
import mark from "@/public/scoreflow-mark.png";

export default function BrandLogo({
  size = "md",
  markOnlyOnTinyScreens = false,
}: {
  size?: "sm" | "md";
  /** Below 360px wide (iPhone SE-sized), show just the SF mark — the top bar
   *  hasn't room for the mark, the name AND both buttons without squashing them. */
  markOnlyOnTinyScreens?: boolean;
}) {
  const md = size === "md";
  return (
    <span className="inline-flex items-center gap-2">
      {/* Decorative (empty alt): the name beside it already says "ScoreFlow", and
          in the top bar the link carries its own label ("ScoreFlow home") — which
          still names it on tiny screens, where only this mark is shown. */}
      <Image
        src={mark}
        alt=""
        // Drawn at 28px (top bar) or 24px (footer) tall; these sizes let Next.js
        // send a small file instead of the full 322px original.
        width={md ? 40 : 34}
        height={md ? 28 : 24}
        loading="eager"
        className={md ? "h-7 w-auto" : "h-6 w-auto"}
      />
      <span
        className={`whitespace-nowrap font-semibold tracking-[-0.02em] ${md ? "text-[17px]" : "text-[15px]"} ${
          markOnlyOnTinyScreens ? "hidden min-[360px]:inline" : ""
        }`}
      >
        <span className="text-brand">Score</span>
        <span className="text-aqua-700">Flow</span>
      </span>
    </span>
  );
}
