/**
 * "Which dish is the problem?" — the payoff for the whole order-aware chip system.
 *
 * SERVER component (no interactivity, so no client bundle).
 *
 * Before this, the dashboard could tell an owner that someone rated them 3, and
 * that somebody somewhere said "Food was cold". It could never say WHICH DISH,
 * because nothing in the product knew what an order contained. Now a connected
 * till stamps the dishes onto each feedback row, and this turns that into the one
 * sentence an owner can act on:
 *
 *     Chicken Cheese Burger   4.2   18 responses   Dry ×7 · Cold ×4
 *
 * That's a Monday-morning instruction. Everything else on the dashboard is a
 * number; this is a to-do.
 *
 * ⚠️ Renders NOTHING when there's no data. A restaurant with no till connected
 * would otherwise get a permanently empty panel nagging them about a feature they
 * haven't set up — and an empty box is worse than no box.
 */

import Link from "next/link";
import type { DishInsight } from "@/lib/feedback";

const CARD = "rounded-2xl border border-[#E5E7EB] bg-white p-5";

/** Same tone scale the feedback list uses, so a score reads the same everywhere. */
function toneFor(average: number): string {
  if (average >= 8) return "text-green-600";
  if (average >= 5) return "text-amber-600";
  return "text-red-600";
}

export default function MenuInsights({
  insights,
  slug,
  hasMenu,
  posConnected,
}: {
  insights: DishInsight[];
  slug: string;
  /** Whether the account has a menu at all. */
  hasMenu: boolean;
  /** Whether this location's till is sending us orders. */
  posConnected: boolean;
}) {
  // ── Nothing to show yet: say WHICH step is still missing ──────────────────
  //
  // ⚠️ Setup here has two halves — a menu, and a connected till — and only both
  // together produce per-dish data. An owner who does one and not the other would
  // otherwise wait forever for a section that can never appear, with nothing
  // telling them why. That's the silent failure M18 exists to prevent: the point
  // isn't to nag, it's that a half-finished setup must not look identical to a
  // finished one.
  if (insights.length === 0) {
    if (!hasMenu) {
      return (
        <section className={`mb-4 ${CARD}`}>
          <div className="text-sm text-[#6B7280]">By dish</div>
          <p className="mt-1 text-sm text-[#6B7280]">
            Add your menu and guests get suggestions about the food they actually
            ate — so you find out <b className="text-[#111827]">which dish</b> is
            costing you, not just that something is.{" "}
            <Link href={`/r/${slug}/settings`} className="font-semibold underline">
              Add your menu
            </Link>
            .
          </p>
        </section>
      );
    }

    if (!posConnected) {
      return (
        <section className={`mb-4 ${CARD}`}>
          <div className="text-sm text-[#6B7280]">By dish</div>
          <p className="mt-1 text-sm text-[#6B7280]">
            Your menu is set up. Connect your till and we can tell you{" "}
            <b className="text-[#111827]">which dish</b> each rating was about —
            guests still won&apos;t be asked anything extra.{" "}
            <Link href={`/r/${slug}/settings`} className="font-semibold underline">
              Connect your till
            </Link>
            .
          </p>
        </section>
      );
    }

    // Both halves are done — the data simply hasn't arrived yet. Silence is right
    // here: there is nothing for the owner to act on, and a permanently empty
    // panel would just be noise on the screen they check most.
    return null;
  }

  return (
    <section className={`mb-4 ${CARD}`}>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-sm text-[#6B7280]">By dish</span>
        <span className="text-xs text-[#9CA3AF]">worst first</span>
      </div>
      <p className="mb-4 text-xs text-[#9CA3AF]">
        Only orders your till told us about.
      </p>

      <div className="flex flex-col gap-3">
        {insights.map((d) => (
          <div
            key={d.dish}
            className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-[#F3F4F6] pb-3 last:border-0 last:pb-0"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-[#111827]">{d.dish}</div>
              {d.topChips.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {d.topChips.map((c) => (
                    <span
                      key={c.chip}
                      className="rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-xs font-medium text-[#374151]"
                    >
                      {c.chip} <span className="text-[#9CA3AF]">×{c.count}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-none text-right">
              <div className={`text-xl font-bold ${toneFor(d.average)}`}>
                {d.average.toFixed(1)}
              </div>
              <div className="text-xs text-[#9CA3AF]">
                {d.responses} {d.responses === 1 ? "response" : "responses"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
