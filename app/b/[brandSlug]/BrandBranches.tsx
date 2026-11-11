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
  inviteBranchManager,
  type BranchState,
  type DeleteBranchState,
  type ResetState,
  type InviteManagerState,
} from "./actions";
// Pure, dependency-free (lib/slug.ts imports nothing) — safe in a client component,
// and it's the SAME function the server derives the real slug with.
import { slugify } from "@/lib/slug";

interface BranchData {
  id: number;
  name: string;
  slug: string;
  positiveThreshold: number;
  responses: number;
  tables: number;
  managerEmails: string[];
  avgRating: number | null;
}

const FIELD =
  "w-full rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 text-base text-[#0F172A] outline-none transition duration-200 placeholder:text-[#94A3B8] focus:border-aqua-600 focus:ring-4 focus:ring-aqua-500/25";
const DIALOG =
  "m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-md rounded-3xl bg-white p-0 shadow-xl backdrop:bg-black/40";

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="text-sm font-medium text-red-600">{message}</p>
  ) : null;
}

function ratingTone(v: number | null) {
  if (v === null) return "text-[#94A3B8]";
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
  // CREATE only: the name is controlled so we can preview the slug it will produce.
  const [name, setName] = useState("");
  // Who runs this location. Defaults to "self" — the common case for a one-restaurant
  // owner, and the reversible choice (a manager can be invited afterwards).
  const [mode, setMode] = useState<"self" | "invite">("self");
  const warning = state && "ok" in state ? state.warning : undefined;
  useEffect(() => {
    // Close on success — unless there's something the owner has to read first (the
    // location was created, but its manager's invite email couldn't be sent).
    if (state && "ok" in state && !state.warning) onSuccess();
  }, [state, onSuccess]);
  const errors = state && "errors" in state ? state.errors : {};

  if (warning) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          {warning}
        </p>
        <button
          type="button"
          onClick={onSuccess}
          className="w-full rounded-2xl bg-brand px-6 py-3 font-semibold text-white"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[#0F172A]">
          {branch ? "Branch name" : "Location name"}
        </label>
        <input
          name="name"
          defaultValue={branch?.name}
          value={branch ? undefined : name}
          onChange={branch ? undefined : (e) => setName(e.target.value)}
          placeholder="e.g. Uncle Bobo's Dhanmondi"
          className={FIELD}
        />
        {/* CREATE: show the URL this name will produce, BEFORE they commit to it. The
            slug is printed onto QR cards and written to NFC chips, so it's worth
            seeing once — and it's otherwise invisible until the branch already exists.
            `slugify` is the SAME pure function the server uses; lib/slug.ts is kept
            free of Prisma precisely so a client component can import it. The server
            still resolves the real slug and may append "-2" to dodge a collision. */}
        {!branch && name.trim() !== "" && (
          <p className="text-xs text-[#94A3B8]">
            Feedback link:{" "}
            <span className="font-mono text-[#64748B]">
              /r/{slugify(name)}/feedback
            </span>
          </p>
        )}
        <FieldError message={errors.name} />
      </div>

      {/* EDIT ONLY. Adding a location derives the slug from the name — asking a
          non-technical owner to invent a URL was a typo waiting to become a reprint.
          Editing keeps the field, because an owner may want to tidy a URL *before*
          printing, and the warning spells out the cost of doing it after. */}
      {branch && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[#0F172A]">
            Slug <span className="font-normal text-[#94A3B8]">(used in the URL)</span>
          </label>
          <input name="slug" defaultValue={branch.slug} className={FIELD} />
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            ⚠️ Changing the slug changes this branch&apos;s URLs — existing QR codes
            and NFC chips stop working until reprinted or re-programmed.
          </p>
          <FieldError message={errors.slug} />
        </div>
      )}
      {/* Review links are NOT set here (M35). All four platforms live in the branch's
          own Settings, set by whoever runs it — the same as a solo restaurant — so
          they're never split between "creation" and "Settings". */}
      <p className="rounded-xl bg-[#F8FAFC] px-3 py-2.5 text-xs text-[#64748B]">
        Review links (Google, Tripadvisor, Yelp, Zomato) are set in the branch&apos;s{" "}
        <b className="text-[#0F172A]">Settings</b>, by whoever runs it — just like a
        single restaurant.
      </p>
      {/* EDIT ONLY, for the same reason as the slug: a brand-new customer asked for a
          1–10 "review threshold" as their very first action has no way to answer it.
          It defaults to 8 and is explained properly in the location's own Settings. */}
      {branch && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[#0F172A]">
            Review threshold{" "}
            <span className="font-normal text-[#94A3B8]">(1–10)</span>
          </label>
          <input
            name="positiveThreshold"
            type="number"
            min={1}
            max={10}
            defaultValue={branch.positiveThreshold}
            className={FIELD}
          />
          <FieldError message={errors.positiveThreshold} />
        </div>
      )}

      {/* ── CREATE ONLY: who runs this location? ────────────────────────────────
          Both answers are first-class. "Myself" is the normal case for someone with
          one restaurant — forcing them to invent a second email address to be their
          own manager would be absurd. And it is NOT a one-way door: a manager can be
          invited later from the location's card, without disturbing its feedback,
          its tables, or any QR code already printed and stood on a table. */}
      {!branch && (
        <>
          <hr className="border-[#E2E8F0]" />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-[#0F172A]">
              Who runs this location?
            </legend>

            <label
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors ${
                mode === "self"
                  ? "border-aqua-600 bg-aqua-50/60"
                  : "border-[#E2E8F0] hover:bg-[#F8FAFC]"
              }`}
            >
              <input
                type="radio"
                name="managerMode"
                value="self"
                checked={mode === "self"}
                onChange={() => setMode("self")}
                className="mt-1 accent-brand"
              />
              <span>
                <span className="block text-sm font-medium text-[#0F172A]">
                  I&apos;ll run it myself
                </span>
                <span className="mt-0.5 block text-xs text-[#64748B]">
                  You manage it from your own login. You can hand it to a manager
                  later.
                </span>
              </span>
            </label>

            <label
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors ${
                mode === "invite"
                  ? "border-aqua-600 bg-aqua-50/60"
                  : "border-[#E2E8F0] hover:bg-[#F8FAFC]"
              }`}
            >
              <input
                type="radio"
                name="managerMode"
                value="invite"
                checked={mode === "invite"}
                onChange={() => setMode("invite")}
                className="mt-1 accent-brand"
              />
              <span>
                <span className="block text-sm font-medium text-[#0F172A]">
                  Invite a manager
                </span>
                <span className="mt-0.5 block text-xs text-[#64748B]">
                  They get their own login and see only this location. You still see
                  everything.
                </span>
              </span>
            </label>
          </fieldset>

          {mode === "invite" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#0F172A]">
                Manager email
              </label>
              <input
                name="managerEmail"
                type="email"
                placeholder="dhanmondi@unclebobos.com"
                className={FIELD}
              />
              {/* No password field (M36). We email the manager a link to set their OWN
                  password — the owner never has to create or share one. */}
              <p className="text-xs text-[#64748B]">
                We&apos;ll email them a link to set their own password and sign in. You
                don&apos;t need to create or share a password.
              </p>
              <FieldError message={errors.managerEmail} />
            </div>
          )}
        </>
      )}

      <FieldError message={errors.form} />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-brand px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-brand-deep active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#E2E8F0] disabled:text-[#94A3B8]"
      >
        {pending ? "Saving…" : branch ? "Save changes" : "Add location"}
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
          <h2 className="text-xl font-bold text-[#0F172A]">{title}</h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-[#64748B] hover:bg-[#F1F5F9]"
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
      <p className="text-sm text-[#64748B]">This permanently deletes:</p>
      <ul className="mt-2 space-y-1 text-sm text-[#334155]">
        <li>
          • <b className="text-[#0F172A]">{branch.responses}</b> feedback responses
        </li>
        <li>
          • <b className="text-[#0F172A]">{branch.tables}</b> tables
        </li>
        <li>• manager login: {branch.managerEmails.join(", ") || "—"}</li>
      </ul>
      <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
        This cannot be undone.
      </p>
      <form action={action} className="mt-4 flex flex-col gap-3">
        <label className="text-sm text-[#0F172A]">
          Type <span className="font-mono font-semibold">{branch.slug}</span> to
          confirm
        </label>
        <input
          name="confirm"
          autoFocus
          autoComplete="off"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={FIELD.replace("focus:ring-aqua-500/25", "focus:ring-red-500/15").replace(
            "focus:border-aqua-600",
            "focus:border-red-500"
          )}
        />
        <FieldError message={error} />
        <button
          type="submit"
          disabled={confirm.trim() !== branch.slug || pending}
          className="w-full rounded-2xl bg-red-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#E2E8F0] disabled:text-[#94A3B8]"
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
  // DERIVED, not copied into state by an effect. `useActionState` already keeps the
  // result across renders, so a `done` flag set inside a `useEffect` was a second
  // source of truth and an extra render for nothing — the same call the invite dialog
  // below documents, and what react-hooks/set-state-in-effect was flagging here.
  const done = !!state && "ok" in state;
  const error = state && "error" in state ? state.error : undefined;

  return (
    <Modal title="Reset manager password" onClose={onClose}>
      {done ? (
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-2xl text-green-600">
            ✓
          </div>
          <p className="text-[15px] text-[#334155]">
            Password reset for <b>{managerEmail}</b>. Share it with them.
          </p>
          <button
            onClick={onClose}
            className="w-full rounded-2xl bg-brand px-6 py-3 font-semibold text-white"
          >
            Done
          </button>
        </div>
      ) : (
        <form action={action} className="flex flex-col gap-4">
          <p className="text-sm text-[#64748B]">
            Set a new password for{" "}
            <span className="font-medium text-[#0F172A]">{managerEmail}</span>.
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
            className="w-full rounded-2xl bg-brand px-6 py-3 font-semibold text-white disabled:bg-[#E2E8F0] disabled:text-[#94A3B8]"
          >
            {pending ? "Resetting…" : "Reset password"}
          </button>
        </form>
      )}
    </Modal>
  );
}

// ── One branch card ───────────────────────────────────────────────────────────
// ── Hand a location you run yourself to a manager ─────────────────────────────
/**
 * The other half of "I'll run it myself" at creation time.
 *
 * Without this, choosing to run a location yourself would be a ONE-WAY DOOR: the only
 * way to add a manager later would be to delete the location and recreate it, which
 * destroys its feedback, its tables, and every QR code already printed and placed.
 *
 * ⚠️ Reassures the owner explicitly that they keep their own access. That isn't just
 * copy — a brand owner is authorised on `brandId`, so adding a manager genuinely
 * cannot take a branch away from them (see lib/auth-guard.ts).
 */
function InviteManagerDialog({
  brandSlug,
  branch,
  onClose,
}: {
  brandSlug: string;
  branch: BranchData;
  onClose: () => void;
}) {
  const bound = inviteBranchManager.bind(null, brandSlug, branch.slug);
  const [state, action, pending] = useActionState<InviteManagerState, FormData>(
    bound,
    undefined
  );
  // DERIVED, not mirrored into state via an effect. `useActionState` already holds the
  // result across renders, so copying it into a `done` flag inside a `useEffect` would
  // be a second source of truth and an extra render for no gain — the exact thing
  // react-hooks/set-state-in-effect warns about.
  const done = !!state && "ok" in state;
  const warning = state && "ok" in state ? state.warning : undefined;
  const error = state && "error" in state ? state.error : undefined;

  return (
    <Modal title={`Invite a manager for ${branch.name}`} onClose={onClose}>
      {done ? (
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          {/* The account is made either way; the tick is only for an invite that went. */}
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl ${warning ? "bg-amber-50 text-amber-600" : "bg-green-50 text-green-600"}`}
          >
            {warning ? "!" : "✓"}
          </div>
          <p className="text-[15px] text-[#334155]">
            {warning ??
              "Invite sent. They'll get a link to set their own password and sign in."}
          </p>
          <button
            onClick={onClose}
            className="w-full rounded-2xl bg-brand px-6 py-3 font-semibold text-white"
          >
            Done
          </button>
        </div>
      ) : (
        <form action={action} className="flex flex-col gap-4">
          <p className="text-sm text-[#64748B]">
            They&apos;ll get their own login and see{" "}
            <b className="text-[#0F172A]">only {branch.name}</b>.{" "}
            <b className="text-[#0F172A]">You keep full access</b> to this location and
            everything else.
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#0F172A]">
              Manager email
            </label>
            <input
              name="managerEmail"
              type="email"
              autoFocus
              placeholder="manager@example.com"
              className={FIELD}
            />
            {/* We never email a password (M36) — only a link to choose one. */}
            <p className="text-xs text-[#64748B]">
              We&apos;ll email them a link to set their own password. You don&apos;t
              need to create or share one.
            </p>
          </div>
          <FieldError message={error} />
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-2xl bg-brand px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-brand-deep active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#E2E8F0] disabled:text-[#94A3B8]"
          >
            {pending ? "Sending invite…" : "Send invite"}
          </button>
        </form>
      )}
    </Modal>
  );
}

function BranchCard({
  b,
  onEdit,
  onDelete,
  onReset,
  onInvite,
}: {
  b: BranchData;
  onEdit: (b: BranchData) => void;
  onDelete: (b: BranchData) => void;
  onReset: (email: string) => void;
  onInvite: (b: BranchData) => void;
}) {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-[#0F172A]">
            {b.name}
          </h3>
          <p className="font-mono text-sm text-[#64748B]">{b.slug}</p>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${ratingTone(b.avgRating)}`}>
            {b.avgRating === null ? "—" : b.avgRating.toFixed(1)}
          </div>
          <div className="text-xs text-[#94A3B8]">avg</div>
        </div>
      </div>

      {/* "No manager" read like something was missing. Running a location yourself is
          a deliberate, supported choice — say so, and offer the way out of it. */}
      <p className="mt-2 truncate text-sm text-[#334155]">
        {b.managerEmails.length ? (
          b.managerEmails.join(", ")
        ) : (
          <span className="text-[#64748B]">You run this location</span>
        )}
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#64748B]">
        <span className="rounded-full bg-[#F1F5F9] px-2.5 py-1">
          <b className="text-[#0F172A]">{b.responses}</b> responses
        </span>
        <span className="rounded-full bg-[#F1F5F9] px-2.5 py-1">
          <b className="text-[#0F172A]">{b.tables}</b> tables
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-1 border-t border-[#F1F5F9] pt-3">
        <Link
          href={`/r/${b.slug}/dashboard`}
          className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
        >
          Dashboard
        </Link>
        <Link
          href={`/r/${b.slug}/tables`}
          className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm font-medium text-[#0F172A] hover:bg-[#F8FAFC]"
        >
          Tables
        </Link>
        <button
          type="button"
          onClick={() => onEdit(b)}
          className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-[#0F172A] hover:bg-[#F1F5F9]"
        >
          Edit
        </button>
        {/* One or the other, never both: a location either has a manager (reset their
            password) or doesn't (invite one). Replacing an existing manager is a
            different, more dangerous operation and isn't folded in here. */}
        {b.managerEmails[0] ? (
          <button
            type="button"
            onClick={() => onReset(b.managerEmails[0])}
            className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-aqua-700 hover:bg-aqua-50"
          >
            Reset password
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onInvite(b)}
            className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-aqua-700 hover:bg-aqua-50"
          >
            Invite manager
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
  const [inviteTarget, setInviteTarget] = useState<BranchData | null>(null);

  const empty = branches.length === 0;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[#0F172A]">
          {empty ? "Your locations" : "Locations"}
        </h2>
        {/* Hidden while empty — the empty state below carries its own, bigger CTA, and
            two competing "add" buttons on a first-run screen is noise. */}
        {!empty && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-brand-deep active:scale-[0.98]"
          >
            + Add location
          </button>
        )}
      </div>

      {empty ? (
        /* THE FIRST SCREEN A NEW CUSTOMER SEES. Signup creates the account and stops,
           so this is where they land — it has to explain what to do next and make
           doing it the obvious action, not just report that a list is empty. */
        <div className="rounded-2xl border border-dashed border-[#E2E8F0] p-8 text-center">
          <h3 className="text-lg font-semibold text-[#0F172A]">
            Add your first location
          </h3>
          <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-[#64748B]">
            A location is one restaurant — its own feedback, its own tables and QR
            codes. Add one if you have a single restaurant, or one for each site if you
            run several.
          </p>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-5 rounded-2xl bg-brand px-6 py-3 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-brand-deep active:scale-[0.98]"
          >
            + Add your first location
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {branches.map((b) => (
            <BranchCard
              key={b.id}
              b={b}
              onEdit={setEditTarget}
              onDelete={setDeleteTarget}
              onReset={setResetEmail}
              onInvite={setInviteTarget}
            />
          ))}
        </div>
      )}

      {adding && (
        <Modal title="Add a location" onClose={() => setAdding(false)}>
          <BranchForm brandSlug={brandSlug} onSuccess={() => setAdding(false)} />
        </Modal>
      )}
      {inviteTarget && (
        <InviteManagerDialog
          key={inviteTarget.id}
          brandSlug={brandSlug}
          branch={inviteTarget}
          onClose={() => setInviteTarget(null)}
        />
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
