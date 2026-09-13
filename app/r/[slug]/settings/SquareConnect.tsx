"use client";

/**
 * "Connect Square" — the one-click till connection (Square integration, step 1).
 *
 * The owner never sees a key or a URL: they click, sign in on Square's own page,
 * approve, and come back connected. Then — only if their business has more than
 * one location, or ScoreFlow has more than one branch — they pick which Square
 * location this branch is. (One and one is linked automatically.)
 *
 * Every state says what's true (the M18 rule): not set up on this server, not
 * connected, connected, or connected-but-Square-unreachable. There is no state in
 * which a button is shown that can't work.
 */

import { useActionState } from "react";
import {
  disconnectSquareAccount,
  setSquareLocation,
  type SquareState,
} from "./menu-actions";

// Same tokens as MenuManager, so the two panels read as one screen.
const FIELD =
  "w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-base text-[#111827] outline-none transition duration-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15";
const BTN =
  "inline-block rounded-2xl bg-amber-500 px-5 py-3 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-amber-600 active:scale-[0.98]";
const BTN_QUIET =
  "rounded-xl border border-[#E5E7EB] px-3 py-1.5 text-sm font-medium text-[#111827] transition-colors hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:text-[#9CA3AF]";

export interface SquareProps {
  configured: boolean;
  sandbox: boolean;
  connected: boolean;
  merchantName: string | null;
  locations: { id: string; name: string; linkedTo: string | null }[] | null;
  thisLocationId: string | null;
}

/** What each `?square=` outcome from the callback means, in the owner's words. */
const NOTICES: Record<string, { tone: "ok" | "warn" | "error"; text: string }> = {
  connected: { tone: "ok", text: "Square connected." },
  denied: { tone: "warn", text: "You didn't approve access on Square's page, so nothing was connected." },
  "in-use": { tone: "error", text: "That Square business is already connected to a different ScoreFlow account." },
  forbidden: { tone: "error", text: "Only the account owner can connect Square." },
  "not-configured": { tone: "error", text: "Connecting Square isn't set up on this server yet." },
  error: { tone: "error", text: "Something went wrong connecting to Square. Please try again." },
};
const TONE = {
  ok: "bg-green-50 text-green-800",
  warn: "bg-amber-50 text-amber-900",
  error: "bg-red-50 text-red-700",
};

export default function SquareConnect({
  slug,
  square,
  notice,
}: {
  slug: string;
  square: SquareProps;
  notice: string | null;
}) {
  const [linkState, linkAction, linking] = useActionState<SquareState, FormData>(
    setSquareLocation.bind(null, slug),
    undefined
  );
  const [offState, offAction, disconnecting] = useActionState<SquareState, FormData>(
    disconnectSquareAccount.bind(null, slug),
    undefined
  );
  const banner = notice ? NOTICES[notice] : undefined;

  return (
    <div className="mt-4 rounded-xl border border-[#E5E7EB] p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#111827] text-xs font-bold text-white">
          ▢
        </span>
        <span className="font-semibold text-[#111827]">Square</span>
      </div>

      {banner && (
        <p role={banner.tone === "ok" ? "status" : "alert"} className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${TONE[banner.tone]}`}>
          {banner.text}
        </p>
      )}

      {!square.configured ? (
        <p className="mt-2 text-sm text-[#6B7280]">
          Connecting Square isn&apos;t available on this server yet.
        </p>
      ) : !square.connected ? (
        <>
          <p className="mt-2 text-sm text-[#6B7280]">
            Use Square? Connect it in one click — you&apos;ll sign in on Square&apos;s own
            page and approve. ScoreFlow can <b className="text-[#111827]">read</b> your
            orders and menu; it can never change them or touch payments.
          </p>
          {/* A plain link, not a button: this is a trip to Square and back. */}
          <a href={`/api/square/oauth/start?slug=${encodeURIComponent(slug)}`} className={`${BTN} mt-3`}>
            Connect Square
          </a>
          {square.sandbox && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
              Test mode: open your test café&apos;s Square Dashboard in this browser first
              (Developer Console → Sandbox test accounts → Square Dashboard), or Square
              won&apos;t show its approval page.
            </p>
          )}
        </>
      ) : (
        <>
          <p className="mt-2 text-sm font-medium text-green-700">
            ● Connected to {square.merchantName ?? "your Square business"}
          </p>

          {square.locations === null ? (
            <p role="alert" className="mt-3 text-sm text-red-600">
              Couldn&apos;t reach Square just now — refresh the page to try again.
            </p>
          ) : square.locations.length === 0 ? (
            <p className="mt-3 text-sm text-[#6B7280]">
              Your Square business has no active locations.
            </p>
          ) : (
            <form action={linkAction} className="mt-3 flex flex-col gap-2">
              <label htmlFor="square-location" className="text-sm font-medium text-[#111827]">
                Which Square location is this branch?
              </label>
              <select
                id="square-location"
                name="locationId"
                defaultValue={square.thisLocationId ?? ""}
                className={FIELD}
              >
                <option value="">— Not linked —</option>
                {square.locations.map((l) => (
                  <option key={l.id} value={l.id} disabled={!!l.linkedTo}>
                    {l.name}
                    {l.linkedTo ? ` (linked to ${l.linkedTo})` : ""}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-3">
                <button type="submit" disabled={linking} className={BTN_QUIET}>
                  {linking ? "Saving…" : "Save"}
                </button>
                {linkState && "ok" in linkState && (
                  <span role="status" className="text-sm font-medium text-green-600">{linkState.message}</span>
                )}
                {linkState && "error" in linkState && (
                  <span role="alert" className="text-sm font-medium text-red-600">{linkState.error}</span>
                )}
              </div>
            </form>
          )}

          <form action={offAction} className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={disconnecting}
              className="rounded-xl border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              {disconnecting ? "Disconnecting…" : "Disconnect Square"}
            </button>
            {offState && "error" in offState && (
              <span role="alert" className="text-sm font-medium text-red-600">{offState.error}</span>
            )}
          </form>
        </>
      )}
    </div>
  );
}
