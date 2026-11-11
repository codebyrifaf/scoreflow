"use client";

/**
 * The owner's interactive Tables manager (CLIENT component, Milestone 8;
 * redesigned to the premium theme + cards in M10).
 *
 * Shows each table as a card with its NFC link + Copy + Remove, plus an
 * "Add table" form. The server does the real work (see actions.ts); this handles
 * the browser bits: building the absolute link, copy-to-clipboard, and clearing
 * the input after a successful add.
 */

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { addTable, removeTable, type AddTableState } from "./actions";
import QrCode from "@/app/QrCode";
import type { QrMatrix } from "@/lib/qr";

interface TableRow {
  id: number;
  label: string;
  /** The table's feedback-link QR, generated server-side (M30). */
  qr: QrMatrix;
}

/** One table as a card: its QR, label, link, and Copy / Remove actions. */
function TableItem({
  slug,
  table,
  origin,
}: {
  slug: string;
  table: TableRow;
  origin: string;
}) {
  const [copied, setCopied] = useState(false);

  // The link customers reach when they tap the chip. We show the absolute URL
  // once we know the origin (after mount); before that we show the path.
  const path = `/r/${slug}/feedback?table=${encodeURIComponent(table.label)}`;
  const url = origin ? `${origin}${path}` : path;

  // Remove is a server action with slug + this table's id already bound in.
  const boundRemove = removeTable.bind(null, slug, table.id);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can fail (e.g. insecure context) — ignore silently.
    }
  }

  return (
    <div className="flex gap-4 rounded-2xl border border-[#E2E8F0] bg-white p-4">
      {/* QR preview (M30) — the owner can screen-share or photograph one table's code
          without printing the whole kit. */}
      <QrCode
        matrix={table.qr}
        title={`Feedback QR for table ${table.label}`}
        className="h-16 w-16 flex-none"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 text-base font-semibold text-[#0F172A]">
            {table.label}
          </div>
          <div className="flex flex-none items-center gap-1">
            <button
              type="button"
              onClick={copy}
              className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-sm font-medium text-[#0F172A] transition-colors hover:bg-[#F8FAFC]"
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
            <form action={boundRemove}>
              <button
                type="submit"
                aria-label={`Remove table ${table.label}`}
                className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                Remove
              </button>
            </form>
          </div>
        </div>
        <code className="mt-2 block break-all font-mono text-xs text-[#64748B]">
          {url}
        </code>
      </div>
    </div>
  );
}

export default function TablesManager({
  slug,
  tables,
}: {
  slug: string;
  /** Each row carries its server-generated QR matrix (M30). */
  tables: TableRow[];
}) {
  // Bind the slug so useActionState only deals with (prevState, formData).
  const boundAdd = addTable.bind(null, slug);
  const [state, action, pending] = useActionState<AddTableState, FormData>(
    boundAdd,
    undefined
  );

  // Absolute-URL origin (client only). Renders "" on the server AND on the first
  // client render, so the HTML matches and there's no hydration mismatch; the real
  // origin appears straight after.
  //
  // `useSyncExternalStore` is React's own way to read a browser-only value: the third
  // argument is the server snapshot (""), the second is the browser's. It replaces a
  // "setState in an effect", which renders twice and is what the lint rule objects to.
  // The store never changes during the page's life, so `subscribe` has nothing to do.
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => ""
  );

  // Clear the input after a successful add.
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state && "ok" in state) formRef.current?.reset();
  }, [state]);

  const error = state && "error" in state ? state.error : undefined;

  return (
    <div className="flex flex-col gap-6">
      {/* Tables list (cards) */}
      {tables.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#E2E8F0] p-8 text-center text-[#64748B]">
          No tables yet. Add your first table below.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {tables.map((t) => (
            <TableItem key={t.id} slug={slug} table={t} origin={origin} />
          ))}
        </div>
      )}

      {/* Add-table form */}
      <form
        ref={formRef}
        action={action}
        className="flex flex-col gap-2 sm:flex-row sm:items-start"
      >
        <div className="flex-1">
          <label htmlFor="label" className="sr-only">
            Table name or number
          </label>
          <input
            id="label"
            name="label"
            type="text"
            placeholder="Table name or number, e.g. 4 or Patio 2"
            className="w-full rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3.5 text-base text-[#0F172A] outline-none transition duration-200 placeholder:text-[#94A3B8] focus:border-aqua-600 focus:ring-4 focus:ring-aqua-500/25"
          />
          {error && (
            <p role="alert" className="mt-1 text-sm font-medium text-red-600">
              {error}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-2xl bg-brand px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-brand-deep active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] disabled:shadow-none disabled:active:scale-100"
        >
          {pending ? "Adding…" : "Add table"}
        </button>
      </form>
    </div>
  );
}
