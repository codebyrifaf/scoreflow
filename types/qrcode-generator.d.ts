/**
 * Minimal ambient types for `qrcode-generator` (Milestone 30).
 *
 * The package ships no types, and rather than pull in another dependency
 * (@types/qrcode-generator) we declare only the tiny surface we actually use — the
 * matrix API. `qrcode-generator` is a single-file, zero-dependency QR encoder (the
 * canonical Kazuhiko Arase implementation), chosen over `qrcode` precisely to keep the
 * dependency + advisory surface at zero for a feature that just draws a square.
 */
declare module "qrcode-generator" {
  /** One built QR code — we only ever read its module grid. */
  interface QRCode {
    /** Feed the data to encode. Call before `make()`. */
    addData(data: string, mode?: string): void;
    /** Build the code (runs version selection + masking). */
    make(): void;
    /** The grid is `getModuleCount() × getModuleCount()` modules square. */
    getModuleCount(): number;
    /** Is the module at (row, col) dark (filled)? */
    isDark(row: number, col: number): boolean;
  }

  /**
   * @param typeNumber 0 = auto-pick the smallest version that fits the data.
   * @param errorCorrectionLevel "L" | "M" | "Q" | "H".
   */
  function qrcode(
    typeNumber: number,
    errorCorrectionLevel: "L" | "M" | "Q" | "H"
  ): QRCode;

  export = qrcode;
}
