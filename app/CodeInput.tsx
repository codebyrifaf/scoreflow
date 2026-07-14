"use client";

/**
 * A segmented 6-digit code input (Milestone 37) — the "boxes" OTP field used on the
 * signup-verify and password-reset screens.
 *
 * Behaviour, so it feels like every other OTP box you've used:
 *   • type a digit → focus jumps to the next box; Backspace on an empty box jumps back;
 *   • paste a whole code → it spreads across the boxes;
 *   • a phone's "from Messages" autofill (which drops the whole code into the first
 *     box) is spread across the boxes too — see `onChange`'s multi-char branch;
 *   • arrow keys move between boxes.
 *
 * How it feeds the form: a single hidden `<input name={name}>` carries the joined
 * value, so the server action receives `code` exactly as before — the verification
 * logic is completely untouched. Only digits are accepted.
 */

import { useRef, useState } from "react";

const BOX =
  "h-14 w-11 rounded-2xl border border-[#E5E7EB] bg-white text-center text-2xl font-semibold text-[#111827] outline-none transition duration-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15";

export default function CodeInput({
  name = "code",
  length = 6,
  defaultValue = "",
  autoFocus = false,
}: {
  name?: string;
  length?: number;
  /** Pre-fill (e.g. from an invite link's `?code=`). Non-digits are ignored. */
  defaultValue?: string;
  autoFocus?: boolean;
}) {
  const init = defaultValue.replace(/\D/g, "").slice(0, length);
  const [digits, setDigits] = useState<string[]>(() =>
    Array.from({ length }, (_, i) => init[i] ?? "")
  );
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const focus = (i: number) => refs.current[i]?.focus();

  /** Write `str`'s digits into the boxes starting at `start`, then focus the last. */
  function fillFrom(start: number, str: string) {
    const clean = str.replace(/\D/g, "");
    if (!clean) return;
    setDigits((prev) => {
      const next = [...prev];
      for (let k = 0; k < clean.length && start + k < length; k++) {
        next[start + k] = clean[k];
      }
      return next;
    });
    focus(Math.min(start + clean.length, length) - 1);
  }

  function onChange(i: number, raw: string) {
    const clean = raw.replace(/\D/g, "");
    if (clean === "") {
      setDigits((prev) => {
        const n = [...prev];
        n[i] = "";
        return n;
      });
      return;
    }
    if (clean.length === 1) {
      setDigits((prev) => {
        const n = [...prev];
        n[i] = clean;
        return n;
      });
      if (i < length - 1) focus(i + 1);
    } else {
      // More than one char (autofill / fast paste into a box) — spread it.
      fillFrom(i, clean);
    }
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && digits[i] === "" && i > 0) {
      e.preventDefault();
      setDigits((prev) => {
        const n = [...prev];
        n[i - 1] = "";
        return n;
      });
      focus(i - 1);
    } else if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      focus(i - 1);
    } else if (e.key === "ArrowRight" && i < length - 1) {
      e.preventDefault();
      focus(i + 1);
    }
  }

  return (
    <div>
      <div
        className="flex justify-center gap-2"
        onPaste={(e) => {
          const text = e.clipboardData.getData("text");
          if (/\d/.test(text)) {
            e.preventDefault();
            fillFrom(0, text);
          }
        }}
      >
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={d}
            inputMode="numeric"
            // Only the first box advertises one-time-code, so a phone offers autofill
            // once and drops the full code in (spread by onChange).
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={1}
            aria-label={`Digit ${i + 1} of ${length}`}
            autoFocus={autoFocus && i === 0}
            onChange={(e) => onChange(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            onFocus={(e) => e.currentTarget.select()}
            className={BOX}
          />
        ))}
      </div>
      {/* What the form actually submits. */}
      <input type="hidden" name={name} value={digits.join("")} />
    </div>
  );
}
