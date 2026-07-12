"use client";

/**
 * Brand logo uploader (Milestone 26) — CLIENT component.
 *
 * The account owner picks an image file; the BROWSER shrinks it to a small icon
 * (~256px, WebP) on a <canvas> and hands the server a compact data: URL. Doing the
 * resize here means we never upload a multi-megabyte photo, and there's no external
 * file store to run — the tiny data URL lives on the Brand row.
 *
 * ⚠️ Nothing here is trusted. `saveLogo` re-checks the size and MIME type on the
 * server (a hostile client could skip this component entirely), and only the
 * account owner is allowed to call it. This is purely the friendly path.
 */

import { useRef, useState, useTransition } from "react";
import { saveLogo } from "./actions";

/** Longest edge of the stored logo, in pixels. Small = tiny data URL. */
const MAX_EDGE = 256;
/** Reject absurd source files before we even try to decode them (10 MB). */
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
/** Must mirror the server's list (see actions.ts). */
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

/**
 * Draw the chosen file onto a canvas at no more than MAX_EDGE on its longest side
 * (keeping the aspect ratio), then export a compact data URL. WebP is smallest and
 * keeps transparency; if the browser can't produce WebP we fall back to PNG.
 */
function resizeToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Your browser could not process that image."));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);

      let url = canvas.toDataURL("image/webp", 0.85);
      if (!url.startsWith("data:image/webp")) {
        url = canvas.toDataURL("image/png"); // older browsers
      }
      resolve(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("That file isn't an image we can read."));
    };
    img.src = objectUrl;
  });
}

/** The rounded frame that previews the logo (or a placeholder initial). */
function Preview({ src, fallback }: { src: string | null; fallback: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- data: URL, not a remote asset
      <img
        src={src}
        alt="Your logo"
        className="h-20 w-20 rounded-2xl border border-[#E5E7EB] bg-white object-contain p-1"
      />
    );
  }
  return (
    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-500 text-4xl font-semibold text-white">
      {fallback}
    </div>
  );
}

export default function LogoUploader({
  slug,
  currentLogo,
  fallbackInitial,
}: {
  slug: string;
  currentLogo: string | null;
  /** First letter of the restaurant name — the placeholder when there's no logo. */
  fallbackInitial: string;
}) {
  const [logo, setLogo] = useState<string | null>(currentLogo);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  /** Send a data URL (or null to remove) to the server, and reflect the result. */
  function persist(dataUrl: string | null) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveLogo(slug, dataUrl);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      setLogo(dataUrl);
      setSaved(true);
    });
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Let the same file be re-picked later (onChange won't fire otherwise).
    e.target.value = "";
    if (!file) return;

    setError(null);
    setSaved(false);

    if (!ACCEPTED.includes(file.type)) {
      setError("Please choose a PNG, JPG or WebP image.");
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setError("That image is too large — please pick one under 10 MB.");
      return;
    }

    try {
      const dataUrl = await resizeToDataUrl(file);
      persist(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that image.");
    }
  }

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
      <h2 className="text-lg font-semibold text-[#111827]">Logo</h2>
      <p className="mt-1 text-sm text-[#6B7280]">
        Shown to diners at the top of your feedback page, so it looks like your own.
        A square image works best.
      </p>

      <div className="mt-4 flex items-center gap-5">
        <Preview src={logo} fallback={fallbackInitial} />

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={isPending}
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-60"
            >
              {logo ? "Change logo" : "Upload logo"}
            </button>
            {logo && (
              <button
                type="button"
                onClick={() => persist(null)}
                disabled={isPending}
                className="rounded-xl border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#6B7280] transition-colors hover:bg-[#F9FAFB] disabled:opacity-60"
              >
                Remove
              </button>
            )}
          </div>
          <p className="text-xs text-[#9CA3AF]">PNG, JPG or WebP.</p>
        </div>

        {/* Hidden real input — the styled buttons above drive it. */}
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED.join(",")}
          onChange={onPick}
          className="hidden"
        />
      </div>

      {isPending && (
        <p className="mt-3 text-sm text-[#6B7280]">Saving…</p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-600">
          {error}
        </p>
      )}
      {saved && !isPending && !error && (
        <p className="mt-3 text-sm font-medium text-green-600">Saved.</p>
      )}
    </div>
  );
}
