import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

/**
 * Only the MONO face is a real webfont — it's used by `font-mono` for slugs and NFC
 * links, where a fixed-width face genuinely helps you read a URL character by
 * character.
 *
 * Geist SANS used to be downloaded here too and was never rendered once: `body` fell
 * back to Arial and every screen set `.font-system` (the native stack) over the top.
 * The app's whole look is built on the platform's own UI font, so the sans webfont
 * was pure weight on every page load — including the diner's, on restaurant wifi.
 */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** The public origin. Used to make OG/canonical URLs absolute. */
const SITE_URL =
  process.env.APP_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://scoreflow-six.vercel.app");

/**
 * Site metadata (rewritten in M23).
 *
 * ⚠️ The old description read: "…sends happy guests to Google and routes complaints
 * quietly to you." That is the description Google puts in its search results and
 * that WhatsApp/LinkedIn show when someone shares the link — so the product's most
 * public sentence was advertising **review gating**, the exact thing we removed.
 *
 * There was also no Open Graph data at all, which meant sharing the link — the way
 * one restaurant owner tells another about it — produced a bare grey rectangle.
 * For a product whose whole pitch is "premium", that was the first impression.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ScoreFlow — hear it at the table, not on Google",
    template: "%s · ScoreFlow",
  },
  description:
    "Guests rate their meal out of ten by tapping a chip on the table. If someone's unhappy, you get an email in seconds — while they're still sitting there. Every guest is invited to review you; we never hide the link.",
  applicationName: "ScoreFlow",
  keywords: [
    "restaurant feedback",
    "guest feedback",
    "NFC table feedback",
    "Google reviews for restaurants",
    "restaurant review management",
  ],
  openGraph: {
    type: "website",
    siteName: "ScoreFlow",
    locale: "en_GB",
    url: SITE_URL,
    title: "Hear it at the table. Not on Google.",
    description:
      "Guests rate their meal in ten seconds. If someone's unhappy, you know before they've left the building.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hear it at the table. Not on Google.",
    description:
      "Guests rate their meal in ten seconds. If someone's unhappy, you know before they've left the building.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      // en-GB, not en-US: the product is sold in the UK.
      lang="en-GB"
      className={`${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/*
          Page-view analytics (M23). Without it you are selling blind: you cannot
          answer "how many people saw the landing page, and how many started a
          trial?" — which is the only number that tells you whether the page works.
          Cookie-free and no personal data, so it needs no consent banner.
        */}
        <Analytics />
      </body>
    </html>
  );
}
