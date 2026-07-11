"use client";

/**
 * The operator's customer list (Milestone 21) — who signed up, who's paying, and
 * who's about to churn.
 *
 * Note what is NOT here: no ratings, no comments, no averages. The operator sees
 * whether a customer is USING the product (submissions, last activity) — which is
 * the churn signal they need — but never what their diners actually said. That
 * boundary is enforced in lib/operator-stats.ts and by the guards.
 */

import { useActionState, useEffect, useRef, useState } from "react";
import {
  recordPaymentAction,
  suspendAccountAction,
  rescueAccountEmail,
  deleteAccountAsOperator,
  type PaymentState,
  type RescueState,
  type DeleteAccountState,
} from "./actions";
import { formatGbp } from "@/lib/money";

export interface AccountRow {
  id: number;
  name: string;
  slug: string;
  ownerEmail: string;
  createdAt: string;
  locations: number;
  responses: number;
  lastActivity: string | null;
  isComped: boolean;
  subStatus: string;
  live: boolean;
  trialDaysLeft: number | null;
  monthlyPricePence: number;
  totalPaid: number;
  currentPeriodEnd: string | null;
}


function shortDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

/** How long since the last diner submitted — the churn tell. */
function quietFor(iso: string | null): { text: string; cold: boolean } {
  if (!iso) return { text: "never used", cold: true };
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return { text: "today", cold: false };
  if (days === 1) return { text: "yesterday", cold: false };
  return { text: `${days}d ago`, cold: days >= 14 };
}

function StatusBadge({ a }: { a: AccountRow }) {
  if (a.isComped) {
    return (
      <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-xs font-medium text-[#6B7280]">
        Comped
      </span>
    );
  }
  const label =
    a.subStatus === "active"
      ? "Paying"
      : a.subStatus === "canceled"
        ? "Suspended"
        : a.trialDaysLeft !== null
          ? `Trial · ${a.trialDaysLeft}d`
          : "Trial ended";
  const tone = !a.live
    ? "bg-red-100 text-red-700"
    : a.subStatus === "active"
      ? "bg-green-100 text-green-700"
      : "bg-amber-100 text-amber-700";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {label}
    </span>
  );
}

/** "Record payment" modal — logs the money received and switches them on. */
function PaymentDialog({
  target,
  onClose,
}: {
  target: AccountRow;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const bound = recordPaymentAction.bind(null, target.id);
  const [state, action, pending] = useActionState<PaymentState, FormData>(
    bound,
    undefined
  );

  useEffect(() => {
    ref.current?.showModal();
  }, []);
  useEffect(() => {
    if (state && "ok" in state) onClose();
  }, [state, onClose]);

  const error = state && "error" in state ? state.error : undefined;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-white p-0 shadow-xl backdrop:bg-black/40"
    >
      <div className="p-6">
        <h2 className="text-xl font-bold text-[#111827]">Record payment</h2>
        <p className="mt-1 text-sm text-[#6B7280]">
          {target.name} — logs the money received and switches the account on.
        </p>

        <form action={action} className="mt-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="amountPounds" className="text-sm font-medium text-[#111827]">
              Amount received (£)
            </label>
            {/* Typed in POUNDS; the server converts to integer pence exactly once
                (see lib/money.ts). `step` allows the pence. */}
            <input
              id="amountPounds"
              name="amountPounds"
              type="number"
              min={0.01}
              step={0.01}
              autoFocus
              placeholder="29.99"
              className="w-full rounded-2xl border border-[#E5E7EB] px-4 py-3 text-base outline-none focus:border-[#111827] focus:ring-4 focus:ring-[#111827]/10"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="periodDays" className="text-sm font-medium text-[#111827]">
              Covers
            </label>
            <select
              id="periodDays"
              name="periodDays"
              defaultValue={30}
              className="w-full rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-base outline-none focus:border-[#111827]"
            >
              <option value={30}>1 month</option>
              <option value={90}>3 months</option>
              <option value={365}>1 year</option>
            </select>
            <p className="text-xs text-[#9CA3AF]">
              Renewing early keeps any days they&apos;ve already paid for.
            </p>
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-red-600">
              {error}
            </p>
          )}

          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => ref.current?.close()}
              className="flex-1 rounded-2xl border border-[#E5E7EB] px-4 py-3 font-semibold text-[#111827] hover:bg-[#F9FAFB]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-2xl bg-[#111827] px-4 py-3 font-semibold text-white hover:bg-black disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF]"
            >
              {pending ? "Saving…" : "Record"}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}

/**
 * The two EMERGENCY levers (M22), tucked behind a disclosure so they're never a
 * casual click. These are the only powers the operator keeps over a customer's
 * account — everything else is now the customer's own.
 */
function SupportTools({ a }: { a: AccountRow }) {
  const [open, setOpen] = useState(false);

  const boundRescue = rescueAccountEmail.bind(null, a.id);
  const [rescueState, rescueAction, rescuing] = useActionState<RescueState, FormData>(
    boundRescue,
    undefined
  );
  const boundDelete = deleteAccountAsOperator.bind(null, a.id);
  const [delState, delAction, deleting] = useActionState<DeleteAccountState, FormData>(
    boundDelete,
    undefined
  );

  const [confirmText, setConfirmText] = useState("");
  const rescueErr = rescueState && "error" in rescueState ? rescueState.error : undefined;
  const rescueOk = rescueState && "ok" in rescueState;
  const delErr = delState && "error" in delState ? delState.error : undefined;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 text-xs font-medium text-[#9CA3AF] underline hover:text-[#6B7280]"
      >
        Support tools
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
          Support tools
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-[#9CA3AF] hover:text-[#6B7280]"
        >
          Hide
        </button>
      </div>

      {/* RESCUE — the only way back for someone who lost their inbox. */}
      <form action={rescueAction} className="mt-3">
        <label className="text-xs text-[#6B7280]">
          Lost access to their email? Move the login to a new address. They&apos;ll
          be signed out everywhere, and <b>both</b> addresses are emailed.
        </label>
        <div className="mt-1.5 flex gap-2">
          <input
            name="newEmail"
            type="email"
            placeholder="new@email.com"
            className="min-w-0 flex-1 rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-sm outline-none focus:border-[#111827]"
          />
          <button
            type="submit"
            disabled={rescuing}
            className="flex-none rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm font-medium text-[#111827] hover:bg-[#F3F4F6] disabled:text-[#9CA3AF]"
          >
            {rescuing ? "Moving…" : "Move login"}
          </button>
        </div>
        {rescueErr && <p className="mt-1 text-xs font-medium text-red-600">{rescueErr}</p>}
        {rescueOk && (
          <p className="mt-1 text-xs font-medium text-green-600">
            Login moved. Both addresses have been emailed.
          </p>
        )}
      </form>

      {/* DELETE — abuse / legal / purge. Suspend first if it's just non-payment. */}
      <form action={delAction} className="mt-4 border-t border-[#E5E7EB] pt-3">
        <label className="text-xs text-[#6B7280]">
          Delete this account and all its data (abuse or a legal request). For
          non-payment, <b>suspend</b> instead — that&apos;s reversible; this isn&apos;t.
          Type <span className="font-semibold text-[#111827]">{a.name}</span> to confirm.
        </label>
        <div className="mt-1.5 flex gap-2">
          <input
            name="confirm"
            autoComplete="off"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={a.name}
            className="min-w-0 flex-1 rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-sm outline-none focus:border-red-500"
          />
          <button
            type="submit"
            disabled={deleting || confirmText.trim() !== a.name}
            className="flex-none rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF]"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
        {delErr && <p className="mt-1 text-xs font-medium text-red-600">{delErr}</p>}
      </form>

      <p className="mt-3 text-[11px] leading-relaxed text-[#9CA3AF]">
        Both actions are recorded in the audit log with your email and the time.
      </p>
    </div>
  );
}

export default function OperatorAccounts({
  accounts,
}: {
  accounts: AccountRow[];
}) {
  const [payTarget, setPayTarget] = useState<AccountRow | null>(null);

  if (accounts.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-[#E5E7EB] p-8 text-center text-sm text-[#6B7280]">
        No customers yet. When a restaurant signs up at{" "}
        <span className="font-mono">/signup</span>, they&apos;ll appear here.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {accounts.map((a) => {
          const quiet = quietFor(a.lastActivity);
          return (
            <div
              key={a.id}
              className="rounded-2xl border border-[#E5E7EB] bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-semibold text-[#111827]">
                      {a.name}
                    </h3>
                    <StatusBadge a={a} />
                  </div>
                  <p className="mt-0.5 truncate text-sm text-[#6B7280]">
                    {a.ownerEmail}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!a.isComped && (
                    <button
                      type="button"
                      onClick={() => setPayTarget(a)}
                      className="rounded-lg bg-[#111827] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-black"
                    >
                      Record payment
                    </button>
                  )}
                  {a.subStatus === "active" && (
                    <form action={suspendAccountAction.bind(null, a.id)}>
                      <button
                        type="submit"
                        className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                      >
                        Suspend
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {/* Money + usage. Usage is the churn signal — a quiet account is
                  about to leave, and that's what you act on. */}
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <div className="text-xs text-[#9CA3AF]">Paid to date</div>
                  <div className="font-semibold text-[#111827]">
                    {a.totalPaid > 0 ? formatGbp(a.totalPaid) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#9CA3AF]">Per month</div>
                  <div className="font-semibold text-[#111827]">
                    {a.monthlyPricePence > 0 ? formatGbp(a.monthlyPricePence) : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#9CA3AF]">Responses</div>
                  <div className="font-semibold text-[#111827]">{a.responses}</div>
                </div>
                <div>
                  <div className="text-xs text-[#9CA3AF]">Last used</div>
                  <div
                    className={`font-semibold ${quiet.cold ? "text-red-600" : "text-[#111827]"}`}
                  >
                    {quiet.text}
                  </div>
                </div>
              </div>

              <p className="mt-3 border-t border-[#F3F4F6] pt-3 text-xs text-[#9CA3AF]">
                Joined {shortDate(a.createdAt)} ·{" "}
                {a.locations === 1 ? "1 location" : `${a.locations} locations`}
                {a.currentPeriodEnd
                  ? ` · paid until ${shortDate(a.currentPeriodEnd)}`
                  : ""}
              </p>

              <SupportTools a={a} />
            </div>
          );
        })}
      </div>

      {payTarget && (
        <PaymentDialog
          key={payTarget.id}
          target={payTarget}
          onClose={() => setPayTarget(null)}
        />
      )}
    </>
  );
}
