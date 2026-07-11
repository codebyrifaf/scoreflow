"use client";

/**
 * The operator's Brands list + "Add brand" modal + brand-owner password reset +
 * "Delete brand" cascade (Milestone 16).
 *
 * A brand groups several branches. The operator manages the brand's *lifecycle*
 * here — create it (+ its brand-owner login), re-issue the owner's password, and
 * delete the whole brand. The operator does NOT enter the private brand console
 * (/b/<slug>) — that's the brand owner's area, exactly like a restaurant's private
 * dashboard is the restaurant owner's. So there's no "open console" link here.
 */

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createBrand,
  deleteBrand,
  type BrandState,
  type DeleteState,
} from "./actions";
import ResetPasswordButton from "./ResetPasswordButton";

interface BrandCardData {
  id: number;
  name: string;
  slug: string;
  branchCount: number;
  branchNames: string[];
  responses: number;
  tables: number;
  ownerEmails: string[];
}

const FIELD =
  "w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3.5 text-base text-[#111827] outline-none transition duration-200 placeholder:text-[#9CA3AF] focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15";

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-sm font-medium text-red-600">{message}</p>
  ) : null;
}

function AddBrandForm({ onSuccess }: { onSuccess: () => void }) {
  const [state, action, pending] = useActionState<BrandState, FormData>(
    createBrand,
    undefined
  );
  useEffect(() => {
    if (state && "ok" in state) onSuccess();
  }, [state, onSuccess]);
  const errors = state && "errors" in state ? state.errors : {};

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[#111827]">Brand name</label>
        <input name="name" placeholder="e.g. KFC" className={FIELD} />
        <FieldError message={errors.name} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[#111827]">
          Slug{" "}
          <span className="font-normal text-[#9CA3AF]">
            (brand console is /b/<b>kfc</b>)
          </span>
        </label>
        <input name="slug" placeholder="kfc" className={FIELD} />
        <FieldError message={errors.slug} />
      </div>
      <hr className="border-[#E5E7EB]" />
      <p className="text-sm text-[#6B7280]">
        This also creates the <b>brand owner login</b> (sees all branches).
      </p>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[#111827]">
          Brand owner email
        </label>
        <input
          name="ownerEmail"
          type="email"
          placeholder="owner@kfc.test"
          className={FIELD}
        />
        <FieldError message={errors.ownerEmail} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[#111827]">
          Owner initial password{" "}
          <span className="font-normal text-[#9CA3AF]">(12+ chars)</span>
        </label>
        <input name="ownerPassword" type="text" className={FIELD} />
        <FieldError message={errors.ownerPassword} />
      </div>
      <FieldError message={errors.form} />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-amber-500 px-6 py-4 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-amber-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF]"
      >
        {pending ? "Creating…" : "Create brand"}
      </button>
    </form>
  );
}

/**
 * The delete-confirmation modal for a whole brand. The operator must type the
 * brand slug to enable Delete (the server re-checks it). It spells out the FULL
 * cascade — every branch plus their feedback, tables, and logins — because this
 * can't be undone. Mirrors the restaurant delete dialog. Rendered with a `key`
 * per brand so it mounts fresh each time.
 */
function DeleteBrandDialog({
  target,
  onClose,
}: {
  target: BrandCardData;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [confirmText, setConfirmText] = useState("");
  const boundDelete = deleteBrand.bind(null, target.slug);
  const [state, action, pending] = useActionState<DeleteState, FormData>(
    boundDelete,
    undefined
  );

  useEffect(() => {
    ref.current?.showModal();
  }, []);
  useEffect(() => {
    if (state && "ok" in state) onClose();
  }, [state, onClose]);

  const matches = confirmText.trim() === target.slug;
  const error = state && "error" in state ? state.error : undefined;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-md rounded-3xl bg-white p-0 shadow-xl backdrop:bg-black/40"
    >
      <div className="max-h-[85vh] overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#111827]">
            Delete &ldquo;{target.name}&rdquo;?
          </h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-[#6B7280] transition-colors hover:bg-[#F3F4F6]"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-[#6B7280]">
          This permanently deletes the{" "}
          <b className="text-[#111827]">entire brand</b> and everything under it:
        </p>
        <ul className="mt-2 space-y-1 text-sm text-[#374151]">
          <li>
            • <b className="text-[#111827]">{target.branchCount}</b> branch
            {target.branchCount === 1 ? "" : "es"}
            {target.branchNames.length > 0 && (
              <span className="text-[#6B7280]">
                {" "}
                ({target.branchNames.join(", ")})
              </span>
            )}
          </li>
          <li>
            • <b className="text-[#111827]">{target.responses}</b> feedback
            response{target.responses === 1 ? "" : "s"} across all branches
          </li>
          <li>
            • <b className="text-[#111827]">{target.tables}</b> table
            {target.tables === 1 ? "" : "s"}
          </li>
          <li>
            • every branch-manager login + the brand-owner login (
            {target.ownerEmails.join(", ") || "—"})
          </li>
        </ul>
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          This cannot be undone.
        </p>

        <form action={action} className="mt-4 flex flex-col gap-3">
          <label htmlFor="confirm-brand" className="text-sm text-[#111827]">
            Type{" "}
            <span className="font-mono font-semibold">{target.slug}</span> to
            confirm
          </label>
          <input
            id="confirm-brand"
            name="confirm"
            type="text"
            autoComplete="off"
            autoFocus
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-base text-[#111827] outline-none transition duration-200 placeholder:text-[#9CA3AF] focus:border-red-500 focus:ring-4 focus:ring-red-500/15"
          />
          {error && (
            <p role="alert" className="text-sm font-medium text-red-600">
              {error}
            </p>
          )}
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => ref.current?.close()}
              className="flex-1 rounded-2xl border border-[#E5E7EB] px-4 py-3 text-base font-semibold text-[#111827] transition-colors hover:bg-[#F9FAFB]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!matches || pending}
              className="flex-1 rounded-2xl bg-red-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF] disabled:shadow-none disabled:active:scale-100"
            >
              {pending ? "Deleting…" : "Delete brand"}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}

export default function AdminBrands({ brands }: { brands: BrandCardData[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<BrandCardData | null>(null);

  return (
    <section className="mb-12">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[#111827]">
          Brands ({brands.length})
        </h2>
        <button
          type="button"
          onClick={() => dialogRef.current?.showModal()}
          className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-amber-600 active:scale-[0.98]"
        >
          + Add brand
        </button>
      </div>

      {brands.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#E5E7EB] p-6 text-center text-sm text-[#6B7280]">
          No brands yet. A brand groups several branches (e.g. KFC → KFC Gulshan,
          KFC Uttara).
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {brands.map((b) => (
            <div key={b.id} className="rounded-2xl border border-[#E5E7EB] p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-semibold text-[#111827]">
                    {b.name}
                  </h3>
                  <p className="font-mono text-sm text-[#6B7280]">{b.slug}</p>
                </div>
                <span className="flex-none rounded-full bg-[#F3F4F6] px-3 py-1 text-xs font-medium text-[#6B7280]">
                  {b.branchCount} {b.branchCount === 1 ? "branch" : "branches"}
                </span>
              </div>

              {/* Brand-owner login + password reset. The operator can re-issue the
                  brand owner's credentials (same as a restaurant owner), but never
                  enters the private brand console. */}
              <div className="mt-2 flex items-center gap-2 text-sm text-[#374151]">
                <span className="min-w-0 truncate">
                  {b.ownerEmails.length ? b.ownerEmails.join(", ") : "No owner"}
                </span>
                {b.ownerEmails.length > 0 && (
                  <ResetPasswordButton ownerEmail={b.ownerEmails[0]} />
                )}
              </div>

              {/* What's inside the brand — visibility for the operator now that the
                  (private) console link is gone. */}
              <p className="mt-2 truncate text-xs text-[#9CA3AF]">
                {b.branchNames.length
                  ? `Branches: ${b.branchNames.join(", ")}`
                  : "No branches yet."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#6B7280]">
                <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1">
                  <b className="text-[#111827]">{b.responses}</b> responses
                </span>
                <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1">
                  <b className="text-[#111827]">{b.tables}</b> tables
                </span>
              </div>

              <div className="mt-4 border-t border-[#F3F4F6] pt-3">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(b)}
                  className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  Delete brand
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add-brand modal — native <dialog> gives Esc-to-close + focus trap. */}
      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
        className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-md rounded-3xl bg-white p-0 shadow-xl backdrop:bg-black/40"
      >
        <div className="max-h-[85vh] overflow-y-auto p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#111827]">Add a brand</h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-[#6B7280] hover:bg-[#F3F4F6]"
            >
              ✕
            </button>
          </div>
          <AddBrandForm onSuccess={() => dialogRef.current?.close()} />
        </div>
      </dialog>

      {/* Delete-confirmation modal (only for the selected brand). */}
      {deleteTarget && (
        <DeleteBrandDialog
          key={deleteTarget.id}
          target={deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </section>
  );
}
