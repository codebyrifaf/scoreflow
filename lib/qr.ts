/**
 * QR code generation (Milestone 30) — turns a URL into a module matrix.
 *
 * We deliberately return the raw BOOLEAN GRID, not an SVG string or a PNG. The caller
 * (app/QrCode.tsx) renders it as real JSX `<svg>`, which keeps two properties:
 *   • no `dangerouslySetInnerHTML` anywhere (the security review counts its absence);
 *   • the output is inline SVG, so it needs no external image fetch — inside the M25
 *     CSP (`img-src 'self' data: blob:`, `connect-src 'self'`) a QR that had to be
 *     fetched from a CDN, or even generated as a `data:` image the browser re-requests,
 *     would be a headache. Inline vector is just DOM.
 *
 * Encoder: `qrcode-generator` — a single-file, ZERO-dependency implementation (the
 * canonical Kazuhiko Arase one). Chosen over the more popular `qrcode` package because
 * that pulls in a CLI toolchain (yargs, pngjs, …) with its own advisories, just to draw
 * a square. Don't hand-roll this — QR encoding (Reed–Solomon ECC, data masking, version
 * selection) is subtly hard, and a bug yields codes that scan on one phone and silently
 * fail on another.
 */

import qrcode from "qrcode-generator";

export interface QrMatrix {
  /** The grid is `size × size` modules. */
  size: number;
  /** `modules[row][col]` — true = a dark (filled) square. */
  modules: boolean[][];
}

/**
 * Encode `data` (a URL) into a QR module matrix.
 *
 * Error-correction level **M** (~15% recoverable): the sweet spot for a printed code —
 * robust to a smudge or a crease, without inflating the module count (which would make
 * the squares tiny and HARDER to scan). Type 0 = auto-select the smallest version that
 * fits the URL, so short slugs get a coarser, easier-to-scan code.
 */
export function qrMatrix(data: string): QrMatrix {
  const qr = qrcode(0, "M");
  qr.addData(data);
  qr.make();

  const size = qr.getModuleCount();
  const modules: boolean[][] = [];
  for (let row = 0; row < size; row++) {
    const line: boolean[] = [];
    for (let col = 0; col < size; col++) {
      line.push(qr.isDark(row, col));
    }
    modules.push(line);
  }

  return { size, modules };
}
