/**
 * A phone device frame for the landing-page product shots (Milestone 15).
 *
 * Plain markup (no client JS) so both the server page and the client HeroPhone can
 * use it. Dark bezel + deep soft shadow — the product is the only thing with
 * colour on the page, so it needs to sit convincingly in space.
 */

import type { ReactNode } from "react";

export default function PhoneFrame({
  children,
  className = "",
  width = "w-[300px]",
}: {
  children: ReactNode;
  className?: string;
  /** Tailwind width class — smaller for the side-by-side split. */
  width?: string;
}) {
  return (
    <div
      className={`relative ${width} rounded-[42px] bg-[#1D1D1F] p-[9px] shadow-[0_50px_100px_-25px_rgba(0,0,0,0.30),0_25px_50px_-30px_rgba(0,0,0,0.35)] ${className}`}
    >
      <div className="relative overflow-hidden rounded-[34px] bg-white">
        {children}
      </div>
    </div>
  );
}
