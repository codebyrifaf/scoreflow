"use client";

/**
 * The "Add a restaurant" form for the operator admin dashboard (CLIENT component).
 *
 * Like the login form, it uses `useActionState` to talk to a server action
 * (`createRestaurant`) — the server does all validation and writing. This
 * component just collects the fields, shows per-field errors, and shows a success
 * message (then clears itself) when a restaurant is created.
 */

import { useActionState, useEffect, useRef } from "react";
import { createRestaurant, type CreateState } from "./actions";

/** Small helper to render a field's error message, if any. */
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm font-medium text-red-600">{message}</p>;
}

export default function AddRestaurantForm({
  onSuccess,
}: {
  /** Called after a restaurant is created (used by the modal to close itself). */
  onSuccess?: () => void;
}) {
  const [state, action, pending] = useActionState<CreateState, FormData>(
    createRestaurant,
    undefined
  );

  // On a successful add: clear the form and let the parent know (e.g. close modal).
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      onSuccess?.();
    }
  }, [state, onSuccess]);

  // Pull out per-field errors (only present on a failed submit).
  const errors = state && !state.ok ? state.errors : {};

  const inputClass =
    "w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3.5 text-base text-[#111827] outline-none transition duration-200 placeholder:text-[#9CA3AF] focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15";

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-5">
      {/* Restaurant name */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium text-[#111827]">
          Restaurant name
        </label>
        <input id="name" name="name" type="text" placeholder="e.g. Test Cafe" className={inputClass} />
        <FieldError message={errors.name} />
      </div>

      {/* Slug */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="slug" className="text-sm font-medium text-[#111827]">
          Slug{" "}
          <span className="font-normal text-[#9CA3AF]">
            (used in the URL, e.g. /r/<b>test-cafe</b>/feedback)
          </span>
        </label>
        <input id="slug" name="slug" type="text" placeholder="test-cafe" className={inputClass} />
        <FieldError message={errors.slug} />
      </div>

      {/* Google review URL (optional) */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="googleReviewUrl"
          className="text-sm font-medium text-[#111827]"
        >
          Google review URL{" "}
          <span className="font-normal text-[#9CA3AF]">(optional)</span>
        </label>
        <input
          id="googleReviewUrl"
          name="googleReviewUrl"
          type="text"
          placeholder="https://search.google.com/local/writereview?placeid=…"
          className={inputClass}
        />
        <FieldError message={errors.googleReviewUrl} />
      </div>

      {/* Review threshold (smart routing, M7) */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="reviewThreshold"
          className="text-sm font-medium text-[#111827]"
        >
          Review threshold{" "}
          <span className="font-normal text-[#9CA3AF]">
            (ratings at or above this get the Google review nudge; below it stay
            private)
          </span>
        </label>
        <input
          id="reviewThreshold"
          name="reviewThreshold"
          type="number"
          min={1}
          max={10}
          defaultValue={8}
          className={inputClass}
        />
        <FieldError message={errors.reviewThreshold} />
      </div>

      <hr className="border-[#E5E7EB]" />
      <p className="text-sm text-[#6B7280]">
        This also creates the restaurant&apos;s <b>owner login</b>. Share these
        credentials with the restaurant.
      </p>

      {/* Owner email */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="ownerEmail"
          className="text-sm font-medium text-[#111827]"
        >
          Owner email
        </label>
        <input
          id="ownerEmail"
          name="ownerEmail"
          type="email"
          placeholder="owner@test-cafe.test"
          className={inputClass}
        />
        <FieldError message={errors.ownerEmail} />
      </div>

      {/* Owner initial password */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="ownerPassword"
          className="text-sm font-medium text-[#111827]"
        >
          Owner initial password{" "}
          <span className="font-normal text-[#9CA3AF]">(at least 12 characters)</span>
        </label>
        {/* type="text" so you (the operator) can read it to pass it on. */}
        <input
          id="ownerPassword"
          name="ownerPassword"
          type="text"
          placeholder="e.g. testcafe-2026"
          className={inputClass}
        />
        <FieldError message={errors.ownerPassword} />
      </div>

      {/* Whole-form error (e.g. not authorized, or a race) */}
      <FieldError message={errors.form} />

      {/* Success message */}
      {state?.ok && (
        <p
          role="status"
          className="rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700"
        >
          ✓ {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-amber-500 px-6 py-4 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-amber-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF] disabled:shadow-none disabled:active:scale-100"
      >
        {pending ? "Adding…" : "Add restaurant"}
      </button>
    </form>
  );
}
