"use client";

/**
 * The "Print / Save as PDF" button on the QR kit (Milestone 30).
 *
 * A one-line client island: the whole kit is a server-rendered page, and this is the
 * only interactive bit — it calls the browser's own print dialog, from which the owner
 * can print directly or "Save as PDF". No PDF library, no server round-trip; the browser
 * does the work, which keeps us fully inside the CSP (nothing external).
 *
 * It's `print:hidden`, so it never appears in the printed output itself.
 */
export default function PrintButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={className}
    >
      Print / Save as PDF
    </button>
  );
}
