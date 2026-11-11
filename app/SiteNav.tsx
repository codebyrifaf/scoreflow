"use client";

/**
 * The landing-page nav (Milestone 15).
 *
 * Fully transparent at the very top; once you scroll, it gains a blurred
 * translucent background and a hairline — Apple's exact behaviour.
 *
 * The logo sits top-left — the SF mark beside the two-tone name (BrandLogo), the
 * same place every product puts it, and the first thing seen after the opening
 * video, which ends on that same mark.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import BrandLogo from "./BrandLogo";

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
        // `.glass-nav` (globals.css) adds the saturation boost the old
        // `bg-white/80 backdrop-blur-xl` was missing — blur alone reads as grey fog;
        // it's the saturation that makes colour bloom through and look like glass.
        scrolled
          ? "glass-nav border-[#CBD5E1]/60"
          : "border-transparent bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
        <Link href="/" className="flex-none" aria-label="ScoreFlow home">
          <BrandLogo markOnlyOnTinyScreens />
        </Link>
        <div className="flex items-center gap-5">
          {/* Pricing in the nav is not decoration: an SMB buyer who can't find a
              price assumes it's expensive and leaves. */}
          <Link
            href="/#pricing"
            className="link-underline hidden whitespace-nowrap text-[14px] font-medium text-[#64748B] transition-colors hover:text-[#0F172A] sm:block"
          >
            Pricing
          </Link>
          <Link
            href="/login"
            className="link-underline whitespace-nowrap text-[14px] font-medium text-[#64748B] transition-colors hover:text-[#0F172A]"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="whitespace-nowrap rounded-full bg-brand px-4 py-2 text-[14px] font-medium text-white transition-colors hover:bg-brand-deep"
          >
            Get started
          </Link>
        </div>
      </nav>
    </header>
  );
}
