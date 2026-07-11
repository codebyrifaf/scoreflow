"use client";

/**
 * The operator's restaurant list + "Add restaurant" modal + "Delete" flow
 * (CLIENT component; cards in M10, delete added in M11).
 *
 * The server page passes the restaurant data in; this handles the browser bits:
 * per-card "copy link", the add-restaurant modal, and the DELETE confirmation
 * modal (which requires typing the slug — the server re-checks it too).
 */

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import AddRestaurantForm from "./AddRestaurantForm";
import EditRestaurantForm from "./EditRestaurantForm";
import ResetPasswordButton from "./ResetPasswordButton";
import { deleteRestaurant, type DeleteState } from "./actions";

interface RestaurantCardData {
  id: number;
  name: string;
  slug: string;
  googleReviewUrl: string;
  ownerEmails: string[];
  responses: number;
  tables: number;
  reviewThreshold: number;
}

/** One restaurant as a card, with copy-link + edit + delete actions. */
function RestaurantCard({
  r,
  onEdit,
  onDelete,
}: {
  r: RestaurantCardData;
  onEdit: (r: RestaurantCardData) => void;
  onDelete: (r: RestaurantCardData) => void;
}) {
  const [copied, setCopied] = useState(false);
  const path = `/r/${r.slug}/feedback`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can fail in insecure contexts — ignore.
    }
  }

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-[#111827]">
            {r.name}
          </h3>
          <p className="font-mono text-sm text-[#6B7280]">{r.slug}</p>
        </div>
        <span className="flex-none rounded-full bg-[#F3F4F6] px-3 py-1 text-xs font-medium text-[#6B7280]">
          Google ≥ {r.reviewThreshold}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2 text-sm text-[#374151]">
        <span className="min-w-0 truncate">
          {r.ownerEmails.length ? r.ownerEmails.join(", ") : "No owner"}
        </span>
        {r.ownerEmails.length > 0 && (
          <ResetPasswordButton ownerEmail={r.ownerEmails[0]} />
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#6B7280]">
        <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1">
          <b className="text-[#111827]">{r.responses}</b> responses
        </span>
        <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1">
          <b className="text-[#111827]">{r.tables}</b> tables
        </span>
      </div>

      <div className="mt-4 border-t border-[#F3F4F6] pt-3">
        <Link
          href={path}
          className="block truncate font-mono text-sm text-amber-600 hover:underline"
        >
          {path}
        </Link>
        <div className="mt-2 flex flex-wrap gap-1">
          <button
            type="button"
            onClick={copy}
            className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-sm font-medium text-[#111827] transition-colors hover:bg-[#F9FAFB]"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
          <button
            type="button"
            onClick={() => onEdit(r)}
            className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-[#111827] transition-colors hover:bg-[#F3F4F6]"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(r)}
            className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The delete-confirmation modal. Shown for one restaurant at a time; the operator
 * must type the slug to enable the Delete button (the server re-checks it).
 * Rendered with a `key` per restaurant so it mounts fresh each time.
 */
function DeleteDialog({
  target,
  onClose,
}: {
  target: RestaurantCardData;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [confirmText, setConfirmText] = useState("");
  const boundDelete = deleteRestaurant.bind(null, target.slug);
  const [state, action, pending] = useActionState<DeleteState, FormData>(
    boundDelete,
    undefined
  );

  // Open on mount; on a successful delete, close (which unmounts this).
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
      <div className="p-6">
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

        <p className="text-sm text-[#6B7280]">This permanently deletes:</p>
        <ul className="mt-2 space-y-1 text-sm text-[#374151]">
          <li>
            • <b className="text-[#111827]">{target.responses}</b> feedback
            response{target.responses === 1 ? "" : "s"}
          </li>
          <li>
            • <b className="text-[#111827]">{target.tables}</b> table
            {target.tables === 1 ? "" : "s"}
          </li>
          <li>• owner login: {target.ownerEmails.join(", ") || "—"}</li>
        </ul>
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          This cannot be undone.
        </p>

        <form action={action} className="mt-4 flex flex-col gap-3">
          <label htmlFor="confirm" className="text-sm text-[#111827]">
            Type{" "}
            <span className="font-mono font-semibold">{target.slug}</span> to
            confirm
          </label>
          <input
            id="confirm"
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
              {pending ? "Deleting…" : "Delete"}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}

/** Edit modal — wraps the pre-filled EditRestaurantForm. */
function EditDialog({
  target,
  onClose,
}: {
  target: RestaurantCardData;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);

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
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#111827]">Edit restaurant</h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-[#6B7280] transition-colors hover:bg-[#F3F4F6]"
          >
            ✕
          </button>
        </div>
        <EditRestaurantForm
          restaurant={{
            id: target.id,
            name: target.name,
            slug: target.slug,
            googleReviewUrl: target.googleReviewUrl,
            reviewThreshold: target.reviewThreshold,
          }}
          onSuccess={() => ref.current?.close()}
        />
      </div>
    </dialog>
  );
}

export default function AdminRestaurants({
  restaurants,
}: {
  restaurants: RestaurantCardData[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const open = () => dialogRef.current?.showModal();
  const close = () => dialogRef.current?.close();

  // Which restaurant (if any) is pending edit / deletion.
  const [editTarget, setEditTarget] = useState<RestaurantCardData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RestaurantCardData | null>(
    null
  );

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[#111827]">
          Your restaurants
        </h2>
        <button
          type="button"
          onClick={open}
          className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-amber-600 active:scale-[0.98]"
        >
          + Add restaurant
        </button>
      </div>

      {restaurants.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#E5E7EB] p-8 text-center text-[#6B7280]">
          No restaurants yet. Tap &ldquo;+ Add restaurant&rdquo; to create your
          first one.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {restaurants.map((r) => (
            <RestaurantCard
              key={r.id}
              r={r}
              onEdit={(x) => setEditTarget(x)}
              onDelete={(x) => setDeleteTarget(x)}
            />
          ))}
        </div>
      )}

      {/* Add-restaurant modal — native <dialog> gives Esc-to-close + focus trap. */}
      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
        className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-md rounded-3xl bg-white p-0 shadow-xl backdrop:bg-black/40"
      >
        <div className="max-h-[85vh] overflow-y-auto p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#111827]">
              Add a restaurant
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-[#6B7280] transition-colors hover:bg-[#F3F4F6]"
            >
              ✕
            </button>
          </div>
          <AddRestaurantForm onSuccess={close} />
        </div>
      </dialog>

      {/* Edit modal (only for the selected restaurant). */}
      {editTarget && (
        <EditDialog
          key={editTarget.id}
          target={editTarget}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* Delete-confirmation modal (only for the selected restaurant). */}
      {deleteTarget && (
        <DeleteDialog
          key={deleteTarget.id}
          target={deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </section>
  );
}
