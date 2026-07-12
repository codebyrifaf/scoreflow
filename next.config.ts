import type { NextConfig } from "next";

/**
 * Security response headers (Milestone 25).
 *
 * next.config.ts used to be empty — no CSP, no clickjacking protection, no HSTS.
 * The owner dashboard was iframe-able (clickjacking), and there was no
 * defence-in-depth behind the app's XSS-safety.
 *
 * ── About the CSP ────────────────────────────────────────────────────────────
 * A truly strict, nonce-based CSP in Next needs per-request nonces wired through
 * the proxy/middleware — worth doing later, but fiddly and easy to break. This CSP
 * is the pragmatic, non-breaking version:
 *   • `frame-ancestors 'none'` + `X-Frame-Options: DENY` → no clickjacking.
 *   • `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` → close the
 *     usual injection escape hatches.
 *   • `script-src`/`style-src` must allow `'unsafe-inline'` because Next injects
 *     inline hydration scripts and styles with no nonce. That weakens the CSP's
 *     XSS value, but the app has no XSS sink today (verified: no
 *     dangerouslySetInnerHTML, React escapes everything), so this is real
 *     defence-in-depth, not the primary control.
 *   • `'unsafe-eval'` is added ONLY in development, where Turbopack's fast-refresh
 *     needs it. Production never gets it.
 * Everything is same-origin (`'self'`): the API, Auth.js, Vercel Analytics, the
 * self-hosted fonts and the generated OG image all serve from our own domain.
 */
const isDev = process.env.NODE_ENV !== "production";

const csp =
  [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ") + ";";

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Belt-and-braces clickjacking protection for older browsers that ignore CSP's
  // frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Force HTTPS for two years, incl. subdomains. Ignored by browsers over plain
  // http (localhost), so it's safe to send everywhere.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Don't hand out browser features we don't use.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
