"use client";

/**
 * The owner's settings form (Milestone 18) — CLIENT component.
 *
 * Everything a restaurant owner can now change WITHOUT phoning the operator.
 * The server action re-validates all of it (see actions.ts); nothing here is
 * trusted.
 */

import { useActionState, useEffect, useState } from "react";
import { saveSettings, type SettingsState } from "./actions";
import { REVIEW_PLATFORMS, type ReviewPlatformDef } from "@/lib/review-platforms";
import { isValidReviewUrl } from "@/lib/review-url";

interface SettingsFormProps {
  slug: string;
  name: string;
  /** The four review links (M29). Empty string = not set = no tile for that platform. */
  googleReviewUrl: string;
  tripadvisorUrl: string;
  yelpUrl: string;
  zomatoUrl: string;
  positiveThreshold: number;
  alertThreshold: number;
  /** The signed-in person's own notification preferences. */
  alertsEnabled: boolean;
  digestEnabled: boolean;
  /** True for a brand owner — they oversee several branches, so the copy differs. */
  isBrandOwner: boolean;
  /** False while email has no provider wired up — we say so rather than lying. */
  emailConfigured: boolean;
}

const FIELD =
  "w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3.5 text-base text-[#111827] outline-none transition duration-200 placeholder:text-[#9CA3AF] focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15";
const LABEL = "text-sm font-medium text-[#111827]";
const HINT = "text-sm text-[#6B7280]";
const CARD = "rounded-2xl border border-[#E5E7EB] bg-white p-5";

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-sm font-medium text-red-600">
      {message}
    </p>
  ) : null;
}

/** A labelled on/off switch. */
function Toggle({
  name,
  defaultChecked,
  title,
  description,
}: {
  name: string;
  defaultChecked: boolean;
  title: string;
  description: string;
}) {
  const [on, setOn] = useState(defaultChecked);
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span className="min-w-0">
        <span className="block text-[15px] font-medium text-[#111827]">{title}</span>
        <span className={`mt-0.5 block ${HINT}`}>{description}</span>
      </span>
      {/* The real checkbox carries the value into the form post; the pill is the UI. */}
      <input
        type="checkbox"
        name={name}
        checked={on}
        onChange={(e) => setOn(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`relative mt-1 h-6 w-11 flex-none rounded-full transition-colors duration-200 ${
          on ? "bg-amber-500" : "bg-[#E5E7EB]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-200 ${
            on ? "left-[22px]" : "left-0.5"
          }`}
        />
      </span>
    </label>
  );
}

/**
 * One review-link field (Milestone 29) — logo, input, and a "Test this link" escape
 * hatch.
 *
 * ── Why "Test this link" exists ──────────────────────────────────────────────
 * We can prove a link points at yelp.com. We CANNOT prove it points at *this*
 * restaurant rather than the one next door. An owner who pastes a neighbour's page
 * would silently send their diners to review someone else's venue, and nothing would
 * look broken. So we can't validate it away — we make it visible, and let the owner
 * see for themselves where the link actually lands.
 *
 * ── ⚠️ Why the link is GATED, and why that is not optional ───────────────────
 * This puts a user-typed string into an `href`. If an owner typed — or was talked
 * into pasting — `javascript:alert(document.cookie)`, clicking it would execute IN
 * OUR ORIGIN, inside their authenticated session: self-XSS, ending in session theft.
 *
 * So the anchor is only RENDERED when the typed value already passes
 * `isValidReviewUrl`, the very same allowlist the server enforces — which demands
 * `https:` and a known host. A `javascript:`/`data:` URL, or any off-allowlist domain,
 * simply never becomes a clickable element. Plus `rel="noopener"`, so the page we open
 * can't reach back through `window.opener`.
 */
function ReviewLinkField({
  platform,
  initial,
  error,
}: {
  platform: ReviewPlatformDef;
  initial: string;
  error?: string;
}) {
  const [value, setValue] = useState(initial);
  const trimmed = value.trim();

  // THE GATE. Same function the server calls — see the note above.
  const safeToOpen = trimmed !== "" && isValidReviewUrl(platform.id, trimmed);
  const looksWrong = trimmed !== "" && !safeToOpen;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={platform.field}
        className={`flex items-center gap-2 ${LABEL}`}
      >
        {/* Local SVG — the CSP forbids remote images. Decorative, so alt="". */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={platform.logo}
          alt=""
          width={20}
          height={20}
          className="h-5 w-5 flex-none object-contain"
        />
        {platform.name}
        <span className="font-normal text-[#9CA3AF]">Optional</span>
      </label>

      <input
        id={platform.field}
        name={platform.field}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={platform.example}
        className={FIELD}
      />

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className={HINT}>{platform.help}</p>

        {safeToOpen && (
          <a
            href={trimmed}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-none text-sm font-medium text-amber-600 underline-offset-2 hover:underline"
          >
            Test this link ↗
          </a>
        )}
      </div>

      {/* Live nudge while typing. The server re-checks regardless; this just saves the
          owner a round-trip to find out they pasted the wrong thing. */}
      {looksWrong && (
        <p className="text-sm text-amber-700">
          That doesn&apos;t look like a {platform.name} link yet.
        </p>
      )}

      {/* The full URL, readable. An <input> visually truncates a long link, so an
          owner could never actually check what they'd pasted. Plain React text, so
          it's escaped and inert. */}
      {trimmed !== "" && (
        <p className="break-all text-xs text-[#9CA3AF]">Goes to: {trimmed}</p>
      )}

      <FieldError message={error} />
    </div>
  );
}

export default function SettingsForm(props: SettingsFormProps) {
  const boundSave = saveSettings.bind(null, props.slug);
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    boundSave,
    undefined
  );
  const [saved, setSaved] = useState(false);

  // Show a brief "Saved" confirmation, then let it fade.
  useEffect(() => {
    if (state && "ok" in state) {
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(t);
    }
  }, [state]);

  const errors = state && "errors" in state ? state.errors : {};

  // Has the owner set ANY review link? Drives the "nobody is being invited anywhere"
  // warning. Checked across all four platforms — an owner who has deliberately chosen
  // Tripadvisor-only must not be nagged about Google.
  const hasAnyLink = REVIEW_PLATFORMS.some(
    (p) => (props[p.field] ?? "").trim() !== ""
  );

  return (
    <form action={action} className="flex flex-col gap-6">
      {/* ── Your restaurant ─────────────────────────────────────────────────── */}
      <section className={CARD}>
        <h2 className="mb-4 text-lg font-semibold text-[#111827]">
          Your restaurant
        </h2>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className={LABEL}>
              Restaurant name
            </label>
            <input
              id="name"
              name="name"
              defaultValue={props.name}
              className={FIELD}
            />
            <FieldError message={errors.name} />
          </div>

        </div>
      </section>

      {/* ── Review links (M29) ──────────────────────────────────────────────────
          Four platforms, all optional and independent. A link you set becomes a logo
          tile on your feedback page; one you leave blank shows nothing at all — never
          a dead button (the M18 silent-failure rule). */}
      <section className={CARD}>
        <h2 className="mb-1 text-lg font-semibold text-[#111827]">Review links</h2>
        <p className={`mb-4 ${HINT}`}>
          Add the ones you actually care about. Each link you set appears as a logo on
          your feedback page after a guest submits; the rest simply don&apos;t show.
        </p>

        {!hasAnyLink && (
          <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            <b>You haven&apos;t set any review link yet</b>, so guests aren&apos;t
            being invited to review you anywhere.
          </p>
        )}

        {/* ⚠️ Paste YOUR restaurant's page on each site. We check the link really
            belongs to that platform, but we can't tell whose restaurant it points at —
            so use "Test this link" and make sure it opens YOUR page. */}
        <p className="mb-5 rounded-xl bg-[#F9FAFB] px-3 py-2.5 text-sm text-[#6B7280]">
          Paste the link to <b className="text-[#111827]">your own page</b> on each
          site. We check it really is a Google/Tripadvisor/Yelp/Zomato link — but we
          can&apos;t tell whether it&apos;s <i>your</i> restaurant, so tap{" "}
          <b className="text-[#111827]">Test this link</b> and make sure it opens your
          page, not someone else&apos;s.
        </p>

        <div className="flex flex-col gap-6">
          {REVIEW_PLATFORMS.map((platform) => (
            <ReviewLinkField
              key={platform.id}
              platform={platform}
              initial={props[platform.field] ?? ""}
              error={errors[platform.field]}
            />
          ))}
        </div>
      </section>

      {/* ── The two scores ──────────────────────────────────────────────────── */}
      <section className={CARD}>
        <h2 className="mb-1 text-lg font-semibold text-[#111827]">
          Ratings that matter
        </h2>
        <p className={`mb-4 ${HINT}`}>
          Two different jobs, so two different numbers.
        </p>

        {/* Be upfront with the restaurant that we do NOT gate reviews. It's a
            selling point, and it's the honest thing to tell someone whose Google
            listing is on the line. */}
        <p className="mb-5 rounded-xl bg-[#F9FAFB] px-3 py-2.5 text-sm text-[#6B7280]">
          <b className="text-[#111827]">Every guest is invited to review you.</b>{" "}
          We never hide the review link from unhappy diners — showing it only to happy
          ones breaches Google&apos;s policy and UK review rules, and puts{" "}
          <i>your</i> listing at risk. Complaints still come straight to you, first.
        </p>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="positiveThreshold" className={LABEL}>
              Treat it as a good experience from
            </label>
            <input
              id="positiveThreshold"
              name="positiveThreshold"
              type="number"
              min={1}
              max={10}
              defaultValue={props.positiveThreshold}
              className={`${FIELD} max-w-28`}
            />
            <p className={HINT}>
              At this score or above we ask the guest <i>&ldquo;what did you
              love?&rdquo;</i>; below it, <i>&ldquo;what could be better?&rdquo;</i>.
              It only changes the question we ask — it does <b>not</b> change who is
              invited to leave a Google review.
            </p>
            <FieldError message={errors.positiveThreshold} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="alertThreshold" className={LABEL}>
              Treat it as a complaint at
            </label>
            <input
              id="alertThreshold"
              name="alertThreshold"
              type="number"
              min={1}
              max={10}
              defaultValue={props.alertThreshold}
              className={`${FIELD} max-w-28`}
            />
            <p className={HINT}>
              A diner who rates this or <b>lower</b> is genuinely unhappy: they land
              in <b>Needs attention</b> on your dashboard and trigger an alert. Keep
              it low — set it too high and you&apos;ll be alerted about perfectly
              good meals.
            </p>
            <FieldError message={errors.alertThreshold} />
          </div>
        </div>
      </section>

      {/* ── Notifications (this person's own inbox) ─────────────────────────── */}
      <section className={CARD}>
        <h2 className="mb-1 text-lg font-semibold text-[#111827]">
          Your notifications
        </h2>
        <p className={`mb-4 ${HINT}`}>
          These are just for you — other people on this restaurant set their own.
        </p>

        {!props.emailConfigured && (
          <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Email delivery isn&apos;t switched on yet, so nothing will actually land
            in your inbox for now. Unhappy diners still show up in{" "}
            <b>Needs attention</b> on your dashboard.
          </p>
        )}

        <div className="flex flex-col gap-5">
          <Toggle
            name="alertsEnabled"
            defaultChecked={props.alertsEnabled}
            title="Email me when a diner is unhappy"
            description={
              props.isBrandOwner
                ? "Every complaint, from every branch, as it happens. Off by default — with several branches this can be a lot of email."
                : "As it happens, so you can put it right before they leave."
            }
          />
          <Toggle
            name="digestEnabled"
            defaultChecked={props.digestEnabled}
            title="Send me a daily summary"
            description={
              props.isBrandOwner
                ? "One email a day covering all your branches — what came in, and what's still open."
                : "One email a day instead of an alert each time."
            }
          />
        </div>
      </section>

      <FieldError message={errors.form} />

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-2xl bg-amber-500 px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-amber-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF]"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        {saved && (
          <span role="status" className="text-sm font-medium text-green-600">
            Saved.
          </span>
        )}
      </div>
    </form>
  );
}
