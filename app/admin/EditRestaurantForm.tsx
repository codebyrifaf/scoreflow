"use client";

/**
 * Edit-restaurant form for the operator (Milestone 12). Pre-filled with the
 * restaurant's current values; submits to the `editRestaurant` server action
 * (which re-validates + re-checks operator + slug uniqueness). Does NOT touch the
 * owner login — that's separate.
 */

import { useActionState, useEffect } from "react";
import { editRestaurant, type EditState } from "./actions";

interface EditData {
  id: number;
  name: string;
  slug: string;
  googleReviewUrl: string; // "" when none
  reviewThreshold: number;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm font-medium text-red-600">{message}</p>;
}

const inputClass =
  "w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3.5 text-base text-[#111827] outline-none transition duration-200 placeholder:text-[#9CA3AF] focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15";

export default function EditRestaurantForm({
  restaurant,
  onSuccess,
}: {
  restaurant: EditData;
  onSuccess?: () => void;
}) {
  const boundEdit = editRestaurant.bind(null, restaurant.id);
  const [state, action, pending] = useActionState<EditState, FormData>(
    boundEdit,
    undefined
  );

  useEffect(() => {
    if (state && "ok" in state) onSuccess?.();
  }, [state, onSuccess]);

  const errors = state && "errors" in state ? state.errors : {};

  return (
    <form action={action} className="flex flex-col gap-5">
      {/* Restaurant name */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="e-name" className="text-sm font-medium text-[#111827]">
          Restaurant name
        </label>
        <input
          id="e-name"
          name="name"
          type="text"
          defaultValue={restaurant.name}
          className={inputClass}
        />
        <FieldError message={errors.name} />
      </div>

      {/* Slug (with a clear warning) */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="e-slug" className="text-sm font-medium text-[#111827]">
          Slug{" "}
          <span className="font-normal text-[#9CA3AF]">(used in the URL)</span>
        </label>
        <input
          id="e-slug"
          name="slug"
          type="text"
          defaultValue={restaurant.slug}
          className={inputClass}
        />
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          ⚠️ Changing the slug changes this restaurant&apos;s URLs — any NFC chips
          or QR codes already made will stop working until they&apos;re
          re-programmed with the new link.
        </p>
        <FieldError message={errors.slug} />
      </div>

      {/* Google review URL */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="e-googleReviewUrl"
          className="text-sm font-medium text-[#111827]"
        >
          Google review URL{" "}
          <span className="font-normal text-[#9CA3AF]">(optional)</span>
        </label>
        <input
          id="e-googleReviewUrl"
          name="googleReviewUrl"
          type="text"
          defaultValue={restaurant.googleReviewUrl}
          placeholder="https://search.google.com/local/writereview?placeid=…"
          className={inputClass}
        />
        <FieldError message={errors.googleReviewUrl} />
      </div>

      {/* Review threshold */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="e-reviewThreshold"
          className="text-sm font-medium text-[#111827]"
        >
          Review threshold{" "}
          <span className="font-normal text-[#9CA3AF]">
            (ratings ≥ this get the Google nudge; below it stay private)
          </span>
        </label>
        <input
          id="e-reviewThreshold"
          name="reviewThreshold"
          type="number"
          min={1}
          max={10}
          defaultValue={restaurant.reviewThreshold}
          className={inputClass}
        />
        <FieldError message={errors.reviewThreshold} />
      </div>

      <FieldError message={errors.form} />

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-amber-500 px-6 py-4 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-amber-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF] disabled:shadow-none disabled:active:scale-100"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
