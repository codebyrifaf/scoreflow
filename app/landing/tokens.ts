/**
 * The landing page's shared design tokens (Milestone 40).
 *
 * These used to live as private consts at the top of `app/page.tsx`. M40 split the
 * page's bigger visual sections into their own files (SetupStrip, PlatformRow,
 * ProofCards, GatingCompare) to keep `page.tsx` readable — and the moment more than
 * one file needed "the container width", the constants had to come somewhere shared.
 *
 * A route file (`page.tsx`) is the wrong place to import *from*, so they live here.
 * Plain strings, no dependencies: safe in both server and client components.
 */

/** The page's column: one width, one gutter, everywhere. */
export const CONTAINER = "mx-auto w-full max-w-5xl px-6";

/** Vertical rhythm for a top-level section. */
export const SECTION = "py-24 sm:py-32 lg:py-36";

/** The near-black primary button: 1px lift on hover, gentle press. */
export const BTN_DARK =
  "inline-flex items-center justify-center rounded-full bg-[#1D1D1F] px-7 py-3 text-[15px] font-medium text-white transition-all duration-150 hover:-translate-y-px hover:bg-black hover:shadow-[0_12px_30px_-12px_rgba(0,0,0,0.45)] active:scale-[0.98]";

/** The outlined secondary button. */
export const BTN_LIGHT =
  "inline-flex items-center justify-center rounded-full border border-[#D2D2D7] bg-white px-7 py-3 text-[15px] font-medium text-[#1D1D1F] transition-all duration-150 hover:-translate-y-px hover:border-[#1D1D1F] active:scale-[0.98]";

/** Days of free trial. Quoted in the hero, the pricing cards and the close. */
export const TRIAL_DAYS = 14;
