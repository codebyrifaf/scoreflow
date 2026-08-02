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
  extractMenuPhoto,
  generateKey,
  disconnectPos,
  type MenuState,
  type PosKeyState,
} from "./menu-actions";

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

export default function MenuManager(props: Props) {
  const { slug, dishes, aiConfigured, posConnected, posKeyPrefix, lastOrderAt, posUrl } =
    props;

  // The dish list as editable text — one per line, "Name, category". Both entry
  // paths (photo and paste) fill this same box, so what the owner reviews is
  // exactly what gets saved.
  const [text, setText] = useState(
    dishes.map((d) => (d.category ? `${d.name}, ${d.category}` : d.name)).join("\n")
  );
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const [extracting, startExtract] = useTransition();
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

        {/* Photo path. Only offered when a provider is actually configured —
            showing a button that can't work would be a dead button, the exact
            silent failure M18 exists to prevent. */}
        {aiConfigured ? (
          <div className="mt-4">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => onPickPhoto(e.target.files?.[0])}
            />
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
      />
    </div>
  );
}

/** One dish's two chip lists, editable. */
function DishChipEditor({ slug, dish }: { slug: string; dish: Dish }) {
  const [state, action, pending] = useActionState<MenuState, FormData>(
    saveDishChips.bind(null, slug, dish.id),
    undefined
  );

  return (
    <form action={action} className="rounded-xl border border-[#E5E7EB] p-4">
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
            name="positive"
            rows={4}
            defaultValue={dish.positiveChips.join("\n")}
            className={`${FIELD} text-sm`}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-red-700">
            When they didn&apos;t
          </label>
          <textarea
            name="negative"
            rows={4}
            defaultValue={dish.negativeChips.join("\n")}
            className={`${FIELD} text-sm`}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button type="submit" disabled={pending} className={BTN_QUIET}>
          {pending ? "Saving…" : "Save"}
        </button>
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
}: {
  slug: string;
  connected: boolean;
  keyPrefix: string | null;
  lastOrderAt: string | null;
  posUrl: string;
}) {
  const [keyState, keyAction, generating] = useActionState<PosKeyState, FormData>(
    generateKey.bind(null, slug),
    undefined
  );
  const [, disconnectAction, disconnecting] = useActionState<PosKeyState, FormData>(
    disconnectPos.bind(null, slug),
    undefined
  );
  const [copied, setCopied] = useState<string | null>(null);

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
    </section>
  );
}
