"use client";

/**
 * The landing-page nav (Milestone 15).
 *
 * Fully transparent at the very top; once you scroll, it gains a blurred
 * translucent background and a hairline — Apple's exact behaviour.
 *
 * The wordmark IS the logo: "ScoreFlow" set in the system font, tight tracking,
 * near-black. No mark, no disc, no icon.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

export default function SiteNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScrolled(window.scrollY > 8));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-all duration-200 ${
        scrolled
          ? "border-[#D2D2D7]/70 bg-white/80 backdrop-blur-xl"
          : "border-transparent bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
        <Link
          href="/"
          className="text-[17px] font-semibold tracking-[-0.02em] text-[#1D1D1F]"
        >
          ScoreFlow
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="link-underline text-[14px] font-medium text-[#6E6E73] transition-colors hover:text-[#1D1D1F]"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-[#1D1D1F] px-4 py-2 text-[14px] font-medium text-white transition-colors hover:bg-black"
          >
            Get started
          </Link>
        </div>
      </nav>
    </header>
  );
}
