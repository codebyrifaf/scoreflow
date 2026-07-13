/**
 * Render a QR module matrix as inline SVG (Milestone 30).
 *
 * Presentational and PURE — it takes a plain boolean grid (which serialises cleanly
 * across the server→client boundary) and draws it. It imports no encoder, so it's safe
 * in a client component; the matrix is produced server-side by lib/qr.ts.
 *
 * Why one `<path>` and not a grid of `<rect>`s: a dense URL is ~30×30 = 900 modules, and
 * ~450 dark. 450 `<rect>` elements is a heavy DOM (and a heavy print job); one `<path>`
 * with 450 little "move + 1×1 box" sub-paths is a fraction of the size and renders
 * identically. It stays razor-sharp at any print size because it's vector.
 */

import type { QrMatrix } from "@/lib/qr";

/** Modules of blank margin around the code. The QR spec REQUIRES a "quiet zone" of at
 *  least 4, or many scanners refuse to read it — a classic "works on my phone, fails on
 *  the customer's" bug. */
const QUIET_ZONE = 4;

export default function QrCode({
  matrix,
  className = "",
  title = "QR code",
}: {
  matrix: QrMatrix;
  className?: string;
  /** Accessible label — this is a meaningful image, not decoration. */
  title?: string;
}) {
  const { size, modules } = matrix;
  const full = size + QUIET_ZONE * 2;

  // Build one path string: for each dark module, a 1×1 box at its offset position.
  let d = "";
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (modules[row][col]) {
        const x = col + QUIET_ZONE;
        const y = row + QUIET_ZONE;
        d += `M${x} ${y}h1v1h-1z`;
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${full} ${full}`}
      className={className}
      role="img"
      aria-label={title}
      shapeRendering="crispEdges"
    >
      {/* White backing so the quiet zone is real even on a coloured/pattern surface. */}
      <rect width={full} height={full} fill="#ffffff" />
      <path d={d} fill="#111827" />
    </svg>
  );
}
