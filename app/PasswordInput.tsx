"use client";

/**
 * A password field with a show/hide toggle (the "eye").
 *
 * Every password box in the app — login, operator login, signup, reset, change
 * password — used a bare `<input type="password">` with no way to see what you'd
 * typed, which is a real usability problem (you can't tell if caps-lock is on, or
 * whether you fat-fingered a long password). This is the one component they all now
 * use, so the behaviour is identical everywhere and lives in a single place.
 *
 * It's a drop-in for `<input>`: pass the same props (id, name, autoComplete,
 * placeholder, className, …). We control `type` ourselves (that's the whole point),
 * so any `type` passed in is ignored. The value still posts normally — toggling only
 * changes how the text is displayed, never the field's name or value.
 */

import { useState, type InputHTMLAttributes } from "react";

/** Eye icon — inline SVG, no icon dependency (currentColor so it inherits text colour). */
function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

/** Eye with a slash — the "hidden" state. */
function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 5.2A9.5 9.5 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3M6.1 6.1A17 17 0 0 0 2 12s3.5 7 10 7a9.5 9.5 0 0 0 3.2-.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PasswordInput({
  className = "",
  style,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        // We own `type` — placed AFTER the spread so it overrides any `type` a caller
        // might pass. Toggling it is the whole point of this component.
        type={show ? "text" : "password"}
        className={className}
        // Inline padding-right makes room for the toggle and beats the field class's
        // `px-4` no matter the CSS source order (inline style wins) — no `!important`
        // needed.
        style={{ paddingRight: "2.75rem", ...style }}
      />
      <button
        type="button" // never submit the form
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        title={show ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#9CA3AF] transition-colors hover:text-[#6B7280]"
      >
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
