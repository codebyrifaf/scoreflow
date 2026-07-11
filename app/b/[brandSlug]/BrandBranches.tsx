"use client";

/**
 * The brand owner's branch manager (Milestone 16). Comparison cards for every
 * branch + modals to add / edit / delete a branch and reset a manager's password.
 * Mirrors the operator's AdminRestaurants patterns (native <dialog> with m-auto
 * centring, useActionState forms), but every action is bound to THIS brand.
 */

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  addBranch,
  editBranch,
  deleteBranch,
  resetManagerPassword,
  type BranchState,
  type DeleteBranchState,
  type ResetState,
} from "./actions";

interface BranchData {
  id: number;
  name: string;
  slug: string;
  googleReviewUrl: string;
  reviewThreshold: number;
  responses: number;
  tables: number;
  managerEmails: string[];
  avgRating: number | null;
}

const FIELD =
  "w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-base text-[#111827] outline-none transition duration-200 placeholder:text-[#9CA3AF] focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15";
const DIALOG =
  "m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-md rounded-3xl bg-white p-0 shadow-xl backdrop:bg-black/40";

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-sm font-medium text-red-600">{message}</p>
  ) : null;
}

function ratingTone(v: number | null) {
  if (v === null) return "text-[#9CA3AF]";
  if (v >= 8) return "text-green-600";
  if (v >= 5) return "text-amber-600";
  return "text-red-600";
}

// ── The add / edit branch form ───────────────────────────────────────────────
function BranchForm({
  brandSlug,
  branch,
  onSuccess,
}: {
  brandSlug: string;
  branch?: BranchData; // present = edit mode
  onSuccess: () => void;
}) {
  const action = branch
    ? editBranch.bind(null, brandSlug, branch.slug)
    : addBranch.bind(null, brandSlug);
  const [state, formAction, pending] = useActionState<BranchState, FormData>(
    action,
    undefined
  );
  useEffect(() => {
    if (state && "ok" in state) onSuccess();
  }, [state, onSuccess]);
  const errors = state && "errors" in state ? state.errors : {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[#111827]">Branch name</label>
        <input
          name="name"
          defaultValue={branch?.name}
          placeholder="e.g. KFC Gulshan"
          className={FIELD}
        />
        <FieldError message={errors.name} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[#111827]">
          Slug <span className="font-normal text-[#9CA3AF]">(used in the URL)</span>
        </label>
        <input
          name="slug"
          defaultValue={branch?.slug}
          placeholder="kfc-gulshan"
          className={FIELD}
        />
        {branch && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            ⚠️ Changing the slug changes this branch&apos;s URLs — existing NFC
            chips stop working until re-programmed.
          </p>
        )}
        <FieldError message={errors.slug} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[#111827]">
          Google review URL{" "}
          <span className="font-normal text-[#9CA3AF]">(optional)</span>
        </label>
        <input
          name="googleReviewUrl"
          defaultValue={branch?.googleReviewUrl}
          placeholder="https://search.google.com/local/writereview?placeid=…"
          className={FIELD}
        />
        <FieldError message={errors.googleReviewUrl} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[#111827]">
          Review threshold{" "}
          <span className="font-normal text-[#9CA3AF]">(1–10)</span>
        </label>
        <input
          name="reviewThreshold"
          type="number"
          min={1}
          max={10}
          defaultValue={branch?.reviewThreshold ?? 8}
          className={FIELD}
        />
        <FieldError message={errors.reviewThreshold} />
      </div>

      {!branch && (
        <>
          <hr className="border-[#E5E7EB]" />
          <p className="text-sm text-[#6B7280]">
            This also creates the branch&apos;s <b>manager login</b>.
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#111827]">
              Manager email
            </label>
            <input
              name="managerEmail"
              type="email"
              placeholder="gulshan@kfc.test"
              className={FIELD}
            />
            <FieldError message={errors.managerEmail} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#111827]">
              Manager initial password{" "}
              <span className="font-normal text-[#9CA3AF]">(12+ chars)</span>
            </label>
            <input name="managerPassword" type="text" className={FIELD} />
            <FieldError message={errors.managerPassword} />
          </div>
        </>
      )}

      <FieldError message={errors.form} />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-amber-500 px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-amber-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF]"
      >
        {pending ? "Saving…" : branch ? "Save changes" : "Add branch"}
      </button>
    </form>
  );
}

// ── A native-dialog wrapper ───────────────────────────────────────────────────
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
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
      className={DIALOG}
    >
      <div className="max-h-[85vh] overflow-y-auto p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#111827]">{title}</h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-[#6B7280] hover:bg-[#F3F4F6]"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

// ── Delete confirmation ───────────────────────────────────────────────────────
function DeleteDialog({
  brandSlug,
  branch,
  onClose,
}: {
  brandSlug: string;
  branch: BranchData;
  onClose: () => void;
}) {
  const [confirm, setConfirm] = useState("");
  const bound = deleteBranch.bind(null, brandSlug, branch.slug);
  const [state, action, pending] = useActionState<DeleteBranchState, FormData>(
    bound,
    undefined
  );
  useEffect(() => {
    if (state && "ok" in state) onClose();
  }, [state, onClose]);
  const error = state && "error" in state ? state.error : undefined;

  return (
    <Modal title={`Delete “${branch.name}”?`} onClose={onClose}>
      <p className="text-sm text-[#6B7280]">This permanently deletes:</p>
      <ul className="mt-2 space-y-1 text-sm text-[#374151]">
        <li>
          • <b className="text-[#111827]">{branch.responses}</b> feedback responses
        </li>
        <li>
          • <b className="text-[#111827]">{branch.tables}</b> tables
        </li>
        <li>• manager login: {branch.managerEmails.join(", ") || "—"}</li>
      </ul>
      <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
        This cannot be undone.
      </p>
      <form action={action} className="mt-4 flex flex-col gap-3">
        <label className="text-sm text-[#111827]">
          Type <span className="font-mono font-semibold">{branch.slug}</span> to
          confirm
        </label>
        <input
          name="confirm"
          autoFocus
          autoComplete="off"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={FIELD.replace("focus:ring-amber-500/15", "focus:ring-red-500/15").replace(
            "focus:border-amber-500",
            "focus:border-red-500"
          )}
        />
        <FieldError message={error} />
        <button
          type="submit"
          disabled={confirm.trim() !== branch.slug || pending}
          className="w-full rounded-2xl bg-red-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF]"
        >
          {pending ? "Deleting…" : "Delete branch"}
        </button>
      </form>
    </Modal>
  );
}

// ── Reset manager password ────────────────────────────────────────────────────
function ResetDialog({
  brandSlug,
  managerEmail,
  onClose,
}: {
  brandSlug: string;
  managerEmail: string;
  onClose: () => void;
}) {
  const bound = resetManagerPassword.bind(null, brandSlug, managerEmail);
  const [state, action, pending] = useActionState<ResetState, FormData>(
    bound,
    undefined
  );
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (state && "ok" in state) setDone(true);
  }, [state]);
  const error = state && "error" in state ? state.error : undefined;

  return (
    <Modal title="Reset manager password" onClose={onClose}>
      {done ? (
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-2xl text-green-600">
            ✓
          </div>
          <p className="text-[15px] text-[#374151]">
            Password reset for <b>{managerEmail}</b>. Share it with them.
          </p>
          <button
            onClick={onClose}
            className="w-full rounded-2xl bg-amber-500 px-6 py-3 font-semibold text-white"
          >
            Done
          </button>
        </div>
      ) : (
        <form action={action} className="flex flex-col gap-4">
          <p className="text-sm text-[#6B7280]">
            Set a new password for{" "}
            <span className="font-medium text-[#111827]">{managerEmail}</span>.
          </p>
          <input
            name="newPassword"
            type="text"
            autoComplete="off"
            placeholder="New password (12+ chars)"
            className={FIELD}
          />
          <FieldError message={error} />
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-2xl bg-amber-500 px-6 py-3 font-semibold text-white disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF]"
          >
            {pending ? "Resetting…" : "Reset password"}
          </button>
        </form>
      )}
    </Modal>
  );
}

// ── One branch card ───────────────────────────────────────────────────────────
function BranchCard({
  brandSlug,
  b,
  onEdit,
  onDelete,
  onReset,
}: {
  brandSlug: string;
  b: BranchData;
  onEdit: (b: BranchData) => void;
  onDelete: (b: BranchData) => void;
  onReset: (email: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-[#111827]">
            {b.name}
          </h3>
          <p className="font-mono text-sm text-[#6B7280]">{b.slug}</p>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${ratingTone(b.avgRating)}`}>
            {b.avgRating === null ? "—" : b.avgRating.toFixed(1)}
          </div>
          <div className="text-xs text-[#9CA3AF]">avg</div>
        </div>
      </div>

      <p className="mt-2 truncate text-sm text-[#374151]">
        {b.managerEmails.length ? b.managerEmails.join(", ") : "No manager"}
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#6B7280]">
        <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1">
          <b className="text-[#111827]">{b.responses}</b> responses
        </span>
        <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1">
          <b className="text-[#111827]">{b.tables}</b> tables
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-1 border-t border-[#F3F4F6] pt-3">
        <Link
          href={`/r/${b.slug}/dashboard`}
          className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-sm font-medium text-[#111827] hover:bg-[#F9FAFB]"
        >
          Dashboard
        </Link>
        <Link
          href={`/r/${b.slug}/tables`}
          className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-sm font-medium text-[#111827] hover:bg-[#F9FAFB]"
        >
          Tables
        </Link>
        <button
          type="button"
          onClick={() => onEdit(b)}
          className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-[#111827] hover:bg-[#F3F4F6]"
        >
          Edit
        </button>
        {b.managerEmails[0] && (
          <button
            type="button"
            onClick={() => onReset(b.managerEmails[0])}
            className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-amber-600 hover:bg-amber-50"
          >
            Reset password
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(b)}
          className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default function BrandBranches({
  brandSlug,
  branches,
}: {
  brandSlug: string;
  branches: BranchData[];
}) {
  const [adding, setAdding] = useState(false);
  const [editTarget, setEditTarget] = useState<BranchData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BranchData | null>(null);
  const [resetEmail, setResetEmail] = useState<string | null>(null);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[#111827]">Branches</h2>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-amber-600 active:scale-[0.98]"
        >
          + Add branch
        </button>
      </div>

      {branches.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#E5E7EB] p-8 text-center text-[#6B7280]">
          No branches yet. Tap &ldquo;+ Add branch&rdquo; to add your first
          location.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {branches.map((b) => (
            <BranchCard
              key={b.id}
              brandSlug={brandSlug}
              b={b}
              onEdit={setEditTarget}
              onDelete={setDeleteTarget}
              onReset={setResetEmail}
            />
          ))}
        </div>
      )}

      {adding && (
        <Modal title="Add a branch" onClose={() => setAdding(false)}>
          <BranchForm brandSlug={brandSlug} onSuccess={() => setAdding(false)} />
        </Modal>
      )}
      {editTarget && (
        <Modal
          key={editTarget.id}
          title="Edit branch"
          onClose={() => setEditTarget(null)}
        >
          <BranchForm
            brandSlug={brandSlug}
            branch={editTarget}
            onSuccess={() => setEditTarget(null)}
          />
        </Modal>
      )}
      {deleteTarget && (
        <DeleteDialog
          key={deleteTarget.id}
          brandSlug={brandSlug}
          branch={deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />
      )}
      {resetEmail && (
        <ResetDialog
          key={resetEmail}
          brandSlug={brandSlug}
          managerEmail={resetEmail}
          onClose={() => setResetEmail(null)}
        />
      )}
    </section>
  );
}
