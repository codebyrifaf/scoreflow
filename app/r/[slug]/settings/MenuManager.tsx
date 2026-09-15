"use client";

/**
 * Menu + POS settings — CLIENT component.
 *
 * Two jobs, both owner-facing:
 *   1. get the account's MENU in (photograph it, or type/paste it) and let the
 *      owner review the dishes and reword the suggestions;
 *   2. connect the restaurant's TILL, so chips can be about the dish a diner
 *      actually ordered rather than the menu in general.
 *
 * Everything here is re-validated in menu-actions.ts. Nothing on this screen is
 * trusted — this is the friendly path, not the enforcement.
 */

import { useActionState, useRef, useState, useTransition } from "react";
import {
  saveMenu,
  regenerateChips,
  saveDishChips,
  resetDishChips,
  extractMenuPhoto,
  importSquareMenu,
  generateKey,
  disconnectPos,
  type MenuState,
  type PosKeyState,
} from "./menu-actions";
import SquareConnect, { type SquareProps } from "./SquareConnect";

interface Dish {
  id: number;
  name: string;
  category: string | null;
  positiveChips: string[];
  negativeChips: string[];
  chipsSource: string;
}

interface Props {
  slug: string;
  dishes: Dish[];
  aiConfigured: boolean;
  posConnected: boolean;
  posKeyPrefix: string | null;
  lastOrderAt: string | null;
  posUrl: string;
  /** The account's Square connection, as Settings shows it. */
  square: SquareProps;
  /** The `?square=` outcome after returning from Square, if any. */
  squareNotice: string | null;
}

const CARD = "rounded-2xl border border-[#E5E7EB] bg-white p-5";
const FIELD =
  "w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-base text-[#111827] outline-none transition duration-200 placeholder:text-[#9CA3AF] focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15";
const BTN =
  "rounded-2xl bg-amber-500 px-5 py-3 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-amber-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF]";
const BTN_QUIET =
  "rounded-xl border border-[#E5E7EB] px-3 py-1.5 text-sm font-medium text-[#111827] transition-colors hover:bg-[#F9FAFB]";

/** Longest edge for the uploaded menu photo. Big enough to read small print,
 *  small enough not to send a multi-megabyte image over restaurant wifi. */
const MAX_EDGE = 1600;

/** Shrink a picked photo in the browser, exactly as the M26 logo uploader does. */
function resizeToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file isn't a readable image."));
      img.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Could not process that image."));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // JPEG, not WebP: a photo of a menu is a photograph, and the server's
        // allowlist accepts png/jpeg/webp.
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const normName = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/** The dish name on one line of the box — read exactly as the server's parser reads it. */
function dishNameOnLine(line: string): string {
  const t = line.trim();
  const comma = t.lastIndexOf(",");
  if (comma > 0) {
    const tail = t.slice(comma + 1).trim();
    if (tail && tail.length <= 20 && !tail.includes(" ")) return normName(t.slice(0, comma));
  }
  return normName(t);
}

/** Add imported dishes to the box, skipping any it already lists. */
function appendNewDishes(
  prev: string,
  dishes: { name: string; category: string | null }[]
): { text: string; added: number } {
  const have = new Set(prev.split("\n").map(dishNameOnLine).filter(Boolean));
  const lines: string[] = [];
  for (const d of dishes) {
    const key = normName(d.name);
    if (have.has(key)) continue;
    have.add(key);
    lines.push(d.category ? `${d.name}, ${d.category}` : d.name);
  }
  if (lines.length === 0) return { text: prev, added: 0 };
  const joined = lines.join("\n");
  return { text: prev.trim() ? `${prev.trim()}\n${joined}` : joined, added: lines.length };
}

export default function MenuManager(props: Props) {
  const {
    slug,
    dishes,
    aiConfigured,
    posConnected,
    posKeyPrefix,
    lastOrderAt,
    posUrl,
    square,
    squareNotice,
  } = props;

  // The dish list as editable text — one per line, "Name, category". Both entry
  // paths (photo and paste) fill this same box, so what the owner reviews is
  // exactly what gets saved.
  const [text, setText] = useState(
    dishes.map((d) => (d.category ? `${d.name}, ${d.category}` : d.name)).join("\n")
  );
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const [extracting, startExtract] = useTransition();
  const [importing, startImport] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const [saveState, saveAction, saving] = useActionState<MenuState, FormData>(
    saveMenu.bind(null, slug),
    undefined
  );
  const [regenState, regenAction, regenerating] = useActionState<MenuState, FormData>(
    regenerateChips.bind(null, slug),
    undefined
  );

  function onPickPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoError(null);
    setPhotoNote(null);
    startExtract(async () => {
      try {
        const dataUrl = await resizeToDataUrl(file);
        const result = await extractMenuPhoto(slug, dataUrl);
        if ("error" in result) {
          setPhotoError(result.error);
          return;
        }
        // Append rather than replace — an owner photographing a two-page menu
        // shouldn't lose page one when they add page two.
        const lines = result.dishes.map((d) =>
          d.category ? `${d.name}, ${d.category}` : d.name
        );
        setText((prev) => (prev.trim() ? `${prev.trim()}\n${lines.join("\n")}` : lines.join("\n")));
        setPhotoNote(
          `Found ${result.dishes.length} dish${result.dishes.length === 1 ? "" : "es"}. Check them below, then save.`
        );
      } catch (e) {
        setPhotoError(e instanceof Error ? e.message : "Could not read that photo.");
      } finally {
        if (fileRef.current) fileRef.current.value = "";
      }
    });
  }

  /**
   * "Import from Square" — the owner's Square item list into the review box.
   *
   * Same path as a photo (fill the box, the owner reviews, the owner saves), with one
   * difference: dishes already in the box are skipped, so pressing Import twice — or
   * after typing a few dishes — never lists anything twice.
   */
  function onImportSquare() {
    setPhotoError(null);
    setPhotoNote(null);
    startImport(async () => {
      try {
        const result = await importSquareMenu(slug);
        if ("error" in result) {
          setPhotoError(result.error);
          return;
        }
        // Counted against the box as it was when Import was pressed; the update
        // itself re-checks against the latest text, in case the owner kept typing.
        const { added } = appendNewDishes(text, result.dishes);
        setText((prev) => appendNewDishes(prev, result.dishes).text);
        const skipped = result.dishes.length - added;
        if (added === 0) {
          setPhotoNote("Everything in your Square item list is already below.");
        } else {
          setPhotoNote(
            result.note +
              (skipped > 0
                ? ` ${skipped} ${skipped === 1 ? "was" : "were"} already in your list, so ${skipped === 1 ? "it wasn't" : "they weren't"} added again.`
                : "")
          );
        }
      } catch {
        setPhotoError("Couldn't reach Square just now. Please try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Menu ─────────────────────────────────────────────────────────── */}
      <section className={CARD}>
        <h2 className="text-lg font-semibold text-[#111827]">Your menu</h2>
        <p className="mt-1 text-sm text-[#6B7280]">
          Once we know your dishes, guests get suggestions about the food they
          actually ate — <b className="text-[#111827]">&ldquo;Burger was dry&rdquo;</b>{" "}
          instead of &ldquo;Food was cold&rdquo;. Shared across all your locations.
        </p>

        {/* How the dishes get in — each way shown ONLY when it can work (the M18
            rule: never a dead button). Square import needs a Square connection; the
            photo needs an AI provider.

            With Square connected, Import is THE way and the photo shrinks to a small
            link: Import's names are exactly the ones Square prints on every order,
            while a printed menu's "Chicken Burger" may be Square's "Chicken Cheese
            Burger" — a worse match. */}
        {aiConfigured && (
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => onPickPhoto(e.target.files?.[0])}
          />
        )}
        {square.connected ? (
          <div className="mt-4">
            <button
              type="button"
              disabled={importing || extracting}
              onClick={onImportSquare}
              className={BTN}
            >
              {importing ? "Reading Square…" : "Import from Square"}
            </button>
            <p className="mt-2 text-xs text-[#9CA3AF]">
              Import reads your Square item list — the same names Square prints on each
              order, so every order matches its dishes exactly.
            </p>
            {aiConfigured && (
              <button
                type="button"
                disabled={importing || extracting}
                onClick={() => fileRef.current?.click()}
                className="mt-2 text-sm font-medium text-amber-700 underline-offset-2 hover:underline disabled:text-[#9CA3AF] disabled:no-underline"
              >
                {extracting ? "Reading your menu…" : "or photograph a menu"}
              </button>
            )}
          </div>
        ) : aiConfigured ? (
          <div className="mt-4">
            <button
              type="button"
              disabled={extracting}
              onClick={() => fileRef.current?.click()}
              className={BTN}
            >
              {extracting ? "Reading your menu…" : "📷 Photograph your menu"}
            </button>
            <p className="mt-2 text-xs text-[#9CA3AF]">
              We&apos;ll read the dishes off the picture. You can fix anything before
              saving.
            </p>
          </div>
        ) : (
          <p className="mt-4 rounded-xl bg-[#F9FAFB] px-3 py-2.5 text-sm text-[#6B7280]">
            Photo reading isn&apos;t switched on, so type or paste your dishes below.
            Everything else works exactly the same.
          </p>
        )}

        {photoError && (
          <p role="alert" className="mt-3 text-sm font-medium text-red-600">
            {photoError}
          </p>
        )}
        {photoNote && (
          <p role="status" className="mt-3 text-sm font-medium text-green-600">
            {photoNote}
          </p>
        )}

        <form action={saveAction} className="mt-5 flex flex-col gap-3">
          <label htmlFor="dishes" className="text-sm font-medium text-[#111827]">
            Dishes <span className="font-normal text-[#9CA3AF]">one per line</span>
          </label>
          <textarea
            id="dishes"
            name="dishes"
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Chicken Cheese Burger, burger\nChicken Wings, starter\nCold Coffee, coffee"}
            className={`${FIELD} font-mono text-sm`}
          />
          <p className="text-xs text-[#6B7280]">
            Add a category after a comma (burger, pizza, curry, coffee…) and the
            suggestions get better. It&apos;s optional.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={saving} className={BTN}>
              {saving ? "Saving…" : "Save menu"}
            </button>
            {saveState && "ok" in saveState && (
              <span role="status" className="text-sm font-medium text-green-600">
                {saveState.message}
              </span>
            )}
            {saveState && "error" in saveState && (
              <span role="alert" className="text-sm font-medium text-red-600">
                {saveState.error}
              </span>
            )}
          </div>
          {saveState && "ok" in saveState && saveState.warning && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {saveState.warning}
            </p>
          )}
        </form>
      </section>

      {/* ── Suggestions per dish ─────────────────────────────────────────── */}
      {dishes.length > 0 && (
        <section className={CARD}>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[#111827]">
              Suggestions guests see
            </h2>
            <form action={regenAction}>
              <button type="submit" disabled={regenerating} className={BTN_QUIET}>
                {regenerating ? "Regenerating…" : "Regenerate all"}
              </button>
            </form>
          </div>
          <p className={`mb-4 text-sm text-[#6B7280]`}>
            Edit anything that doesn&apos;t sound like your food — you know it better
            than we do. Anything you edit is left alone when you regenerate.
          </p>
          {regenState && "ok" in regenState && (
            <p role="status" className="mb-3 text-sm font-medium text-green-600">
              {regenState.message}
            </p>
          )}
          {/* Never shown before — a failed or empty regenerate looked exactly like
              nothing happening (the M18 rule: never a silent failure). */}
          {regenState && "error" in regenState && (
            <p role="alert" className="mb-3 text-sm font-medium text-red-600">
              {regenState.error}
            </p>
          )}

          <div className="flex flex-col gap-4">
            {dishes.map((d) => (
              <DishChipEditor key={d.id} slug={slug} dish={d} />
            ))}
          </div>
        </section>
      )}

      {/* ── POS connection ───────────────────────────────────────────────── */}
      <PosConnection
        slug={slug}
        connected={posConnected}
        keyPrefix={posKeyPrefix}
        lastOrderAt={lastOrderAt}
        posUrl={posUrl}
        square={square}
        squareNotice={squareNotice}
      />
    </div>
  );
}

/** One dish's two chip lists, editable. */
function DishChipEditor({ slug, dish }: { slug: string; dish: Dish }) {
  const [saveState, saveAction, saving] = useActionState<MenuState, FormData>(
    saveDishChips.bind(null, slug, dish.id),
    undefined
  );
  const [resetState, resetAction, resetting] = useActionState<MenuState, FormData>(
    resetDishChips.bind(null, slug, dish.id),
    undefined
  );
  // "Replace with fresh suggestions" throws away the owner's own wording, so it takes
  // two clicks: the first only asks.
  const [confirmingReset, setConfirmingReset] = useState(false);
  // Once a reset has answered, the question is over (React's "adjust state when a
  // value changes" pattern — no effect needed).
  const [answeredReset, setAnsweredReset] = useState(resetState);
  if (resetState !== answeredReset) {
    setAnsweredReset(resetState);
    setConfirmingReset(false);
  }

  // Whichever button was pressed last speaks. A Save after a Reset (or the reverse)
  // must not leave the older message on screen.
  const [lastPressed, setLastPressed] = useState<"save" | "reset">("save");
  const state = lastPressed === "save" ? saveState : resetState;
  const pending = saving || resetting;

  // Keyed by content: when the saved suggestions change (a reset, a regenerate, a
  // save), the boxes are rebuilt to show them — even if the owner had typed in them.
  const posKey = dish.positiveChips.join("\n");
  const negKey = dish.negativeChips.join("\n");

  return (
    <form action={saveAction} className="rounded-xl border border-[#E5E7EB] p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold text-[#111827]">{dish.name}</span>
        <span className="text-xs text-[#9CA3AF]">
          {dish.chipsSource === "owner"
            ? "edited by you"
            : dish.chipsSource === "ai"
              ? "AI suggestions"
              : "standard suggestions"}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-green-700">
            When they liked it
          </label>
          <textarea
            key={posKey}
            name="positive"
            rows={4}
            defaultValue={posKey}
            className={`${FIELD} text-sm`}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-red-700">
            When they didn&apos;t
          </label>
          <textarea
            key={negKey}
            name="negative"
            rows={4}
            defaultValue={negKey}
            className={`${FIELD} text-sm`}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          onClick={() => {
            setLastPressed("save");
            setConfirmingReset(false);
          }}
          className={BTN_QUIET}
        >
          {saving ? "Saving…" : "Save"}
        </button>

        {/* The way back from "edited by you" — Regenerate all never touches these. */}
        {dish.chipsSource === "owner" &&
          (confirmingReset ? (
            <>
              <button
                type="submit"
                formAction={resetAction}
                disabled={pending}
                onClick={() => setLastPressed("reset")}
                className="rounded-xl bg-amber-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF]"
              >
                {resetting ? "Replacing…" : "Yes, replace my wording"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmingReset(false)}
                className="text-sm font-medium text-[#6B7280] hover:text-[#111827]"
              >
                Keep mine
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmingReset(true)}
              className="text-sm font-medium text-amber-700 hover:text-amber-800"
            >
              Replace with fresh suggestions
            </button>
          ))}

        {state && "ok" in state && (
          <span role="status" className="text-sm font-medium text-green-600">
            {state.message}
          </span>
        )}
        {state && "error" in state && (
          <span role="alert" className="text-sm font-medium text-red-600">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}

/**
 * The POS panel.
 *
 * The owner copies a URL and a key OUT of here and gives them to whoever runs
 * their till — the direction people find surprising, so the copy says it plainly.
 *
 * ⚠️ The "last order received" line is the most important thing on this panel. A
 * restaurant owner cannot read a webhook log; this is the only way they can tell
 * whether the integration is alive, and without it a silently broken connection
 * would look identical to a working one.
 */
function PosConnection({
  slug,
  connected,
  keyPrefix,
  lastOrderAt,
  posUrl,
  square,
  squareNotice,
}: {
  slug: string;
  /** Connected with a till KEY (the developer route) — not Square. */
  connected: boolean;
  keyPrefix: string | null;
  lastOrderAt: string | null;
  posUrl: string;
  square: SquareProps;
  squareNotice: string | null;
}) {
  const [keyState, keyAction, generating] = useActionState<PosKeyState, FormData>(
    generateKey.bind(null, slug),
    undefined
  );
  // The result is READ, not discarded: an unreadable result meant a failed
  // disconnect looked exactly like a click that did nothing (the M18 rule).
  const [disconnectState, disconnectAction, disconnecting] = useActionState<
    PosKeyState,
    FormData
  >(disconnectPos.bind(null, slug), undefined);
  const [copied, setCopied] = useState<string | null>(null);

  // Whether the key section STARTS open — decided once, then left to the owner.
  // Passing `connected` straight to <details open> made it snap shut the moment
  // they clicked Disconnect inside it (the prop flipped to false and React closed
  // it under their cursor). Caught by the regression suite.
  const [keySectionOpen] = useState(connected || !square.configured);

  const freshKey = keyState && "ok" in keyState && "key" in keyState ? keyState.key : null;

  const copy = (label: string, value: string) => {
    navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(label);
        setTimeout(() => setCopied(null), 2000);
      },
      () => setCopied(null)
    );
  };

  return (
    <section className={CARD}>
      <h2 className="text-lg font-semibold text-[#111827]">Connect your till</h2>
      <p className="mt-1 text-sm text-[#6B7280]">
        Optional, and worth it. When your till tells us what was in each order,
        guests get suggestions about{" "}
        <b className="text-[#111827]">the exact dish they ordered</b> — and your
        dashboard can tell you which dish is losing you customers.
      </p>

      {/* Square first: one click, no keys, and the most common till for small UK
          venues. */}
      <SquareConnect slug={slug} square={square} notice={squareNotice} lastOrderAt={lastOrderAt} />

      {/* Every other till: the key-and-address route, which needs whoever runs
          the till to add one web request. Folded away when Square is on offer, so
          the common case isn't buried under developer instructions — but open if
          this branch already uses a key, or if Square isn't available here. */}
      <details className="mt-4 rounded-xl border border-[#E5E7EB] p-4" open={keySectionOpen}>
        <summary className="cursor-pointer text-sm font-medium text-[#111827]">
          Using a different till? Connect it with a key
        </summary>

      {connected ? (
        <>
          <div className="mt-4 rounded-xl bg-[#F9FAFB] p-4">
            <p className="text-sm font-medium text-[#111827]">
              Send each new order to this address
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 font-mono text-xs text-[#111827]">
                {posUrl}
              </code>
              <button type="button" onClick={() => copy("url", posUrl)} className={BTN_QUIET}>
                {copied === "url" ? "Copied" : "Copy"}
              </button>
            </div>

            <p className="mt-4 text-sm font-medium text-[#111827]">With this key</p>
            {freshKey ? (
              <>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 font-mono text-xs text-[#111827]">
                    {freshKey}
                  </code>
                  <button
                    type="button"
                    onClick={() => copy("key", freshKey)}
                    className={BTN_QUIET}
                  >
                    {copied === "key" ? "Copied" : "Copy"}
                  </button>
                </div>
                {/* Said loudly because it is genuinely the only chance — we store
                    a hash, so we cannot show this again even if we wanted to. */}
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                  Copy this now — for your security it can&apos;t be shown again. Lost
                  it? Generate a new one.
                </p>
              </>
            ) : (
              <p className="mt-2 font-mono text-xs text-[#6B7280]">
                {keyPrefix ?? "sk_pos_…"}{" "}
                <span className="font-sans">(hidden for security)</span>
              </p>
            )}
          </div>

          {/* The "is it working?" indicator. */}
          <p className="mt-3 text-sm">
            {lastOrderAt ? (
              <span className="font-medium text-green-700">
                ● Last order received {lastOrderAt}
              </span>
            ) : (
              <span className="text-[#6B7280]">
                ○ No orders received yet. Once your till starts sending them,
                you&apos;ll see it here.
              </span>
            )}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <form action={keyAction}>
              <button type="submit" disabled={generating} className={BTN_QUIET}>
                {generating ? "Generating…" : "Generate a new key"}
              </button>
            </form>
            <form action={disconnectAction}>
              <button
                type="submit"
                disabled={disconnecting}
                className="rounded-xl border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
            </form>
          </div>
        </>
      ) : (
        <div className="mt-4">
          <form action={keyAction}>
            <button type="submit" disabled={generating} className={BTN}>
              {generating ? "Generating…" : "Connect my till"}
            </button>
          </form>
          <p className="mt-2 text-xs text-[#9CA3AF]">
            We&apos;ll give you an address and a key to hand to whoever runs your
            till. Nothing changes for your guests.
          </p>
        </div>
      )}

      {keyState && "error" in keyState && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-600">
          {keyState.error}
        </p>
      )}
      {disconnectState && "error" in disconnectState && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-600">
          {disconnectState.error}
        </p>
      )}
      </details>
    </section>
  );
}
