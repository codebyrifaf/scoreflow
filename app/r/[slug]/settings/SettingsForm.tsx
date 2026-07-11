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

interface SettingsFormProps {
  slug: string;
  name: string;
  googleReviewUrl: string;
  reviewThreshold: number;
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

          <div className="flex flex-col gap-1.5">
            <label htmlFor="googleReviewUrl" className={LABEL}>
              Google review link
            </label>
            <input
              id="googleReviewUrl"
              name="googleReviewUrl"
              defaultValue={props.googleReviewUrl}
              placeholder="https://g.page/r/…/review"
              className={FIELD}
            />
            <p className={HINT}>
              Where happy diners are sent to leave a public review.{" "}
              {props.googleReviewUrl ? (
                "Paste the link from your Google Business profile."
              ) : (
                <span className="font-medium text-red-600">
                  You haven&apos;t set this yet, so happy diners aren&apos;t being
                  sent anywhere.
                </span>
              )}
            </p>
            <FieldError message={errors.googleReviewUrl} />
          </div>
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

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reviewThreshold" className={LABEL}>
              Ask for a Google review at
            </label>
            <input
              id="reviewThreshold"
              name="reviewThreshold"
              type="number"
              min={1}
              max={10}
              defaultValue={props.reviewThreshold}
              className={`${FIELD} max-w-28`}
            />
            <p className={HINT}>
              A diner who rates this or higher is invited to review you on Google.
              Below it, their feedback stays private — it only comes to you.
            </p>
            <FieldError message={errors.reviewThreshold} />
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
