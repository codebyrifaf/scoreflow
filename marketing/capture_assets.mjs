/**
 * Re-shoot the product images in marketing/assets/ from the real /pitch page.
 *
 *   1. npm install --no-save puppeteer-core jsqr pngjs      (tools only — not saved)
 *   2. Start the app WITH your live address, so its QR codes point there:
 *        PowerShell:  $env:APP_URL = "https://your-app.vercel.app"; npm run dev
 *   3. In a second terminal, with the SAME address:
 *        PowerShell:  $env:SCOREFLOW_URL = "https://your-app.vercel.app"; node marketing/capture_assets.mjs
 *   4. Then rebuild the deck:  python marketing/build_pptx.py
 *
 * ⚠️ WHY THE CHECKS AT BOTH ENDS. The first version of this script lived only in a
 * scratch folder and captured QR codes for `scoreflow-six.vercel.app` — an address
 * that had stopped existing. The QR decoded perfectly; it just led nowhere. So this
 * refuses to run unless the address answers, and afterwards DECODES the captured QR
 * and fails if it points anywhere else.
 */
import { mkdir, readFile } from "node:fs/promises";
import puppeteer from "puppeteer-core";

const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const APP = process.env.CAPTURE_FROM ?? "http://localhost:3000";
const OUT = new URL("./assets/", import.meta.url);
const site = (process.env.SCOREFLOW_URL ?? "").trim().replace(/\/+$/, "");

// ── 1. The address must be real, and alive ──────────────────────────────────
if (!site.startsWith("https://")) {
  console.error("\n  Set SCOREFLOW_URL to your live address first (see the header of this file).\n");
  process.exit(1);
}
const expected = `${site}/signup`;
const live = await fetch(expected).catch(() => null);
if (!live || live.status !== 200) {
  console.error(`\n  ${expected} answered ${live?.status ?? "nothing"} — is that the live address?\n`);
  process.exit(1);
}

await mkdir(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });

try {
  const page = await browser.newPage();
  // 4x, so the images stay sharp on a projector.
  await page.setViewport({ width: 1280, height: 1400, deviceScaleFactor: 4 });
  await page.goto(`${APP}/pitch`, { waitUntil: "networkidle0" });

  // `SlideVisual` is the one element with `flex-1` on each slide — stable whether or
  // not the slide is light (which adds an extra decorative div) or dark.
  const shots = [
    ["review-card", 1, ".flex-1 > *:nth-child(1)"],
    ["table-card-phone", 3, ".flex-1 > *:nth-child(1)"],
    ["nfc-pill", 3, ".flex-1 > *:nth-child(2)"],
    ["alert-card", 4, ".flex-1 > *:nth-child(1)"],
    ["by-dish", 5, ".flex-1 > *:nth-child(1)"],
    ["platforms", 6, ".flex-1 > *:nth-child(1)"],
    ["steps", 7, ".flex-1 > *:nth-child(1)"],
    ["qr-block", 8, ".flex-1 > *:nth-child(1)"],
    // The QR on its own. `qr-block` bakes in the closing slide's headline text.
    ["qr-only", 8, ".flex-1 > *:nth-child(1) > div:nth-of-type(2)"],
  ];
  for (const [name, slide, sel] of shots) {
    const el = await page.$(`figure:nth-of-type(${slide}) ${sel}`);
    if (!el) throw new Error(`couldn't find ${name} on slide ${slide} — did /pitch change?`);
    await el.screenshot({ path: new URL(`${name}.png`, OUT) });
    console.log(`  ok  ${name}.png`);
  }
  for (const n of [1, 5]) {
    await (await page.$(`figure:nth-of-type(${n})`)).screenshot({ path: new URL(`slide-${n}-full.png`, OUT) });
    console.log(`  ok  slide-${n}-full.png`);
  }
} finally {
  await browser.close();
}

// ── 2. Prove the QR we just captured leads to the live address ──────────────
const { default: jsQR } = await import("jsqr");
const { default: pngjs } = await import("pngjs");
const png = pngjs.PNG.sync.read(await readFile(new URL("qr-only.png", OUT)));
const px = png.data;
for (let i = 0; i < px.length; i += 4) {
  // Flatten any transparency onto white, the way a camera would see it.
  const a = px[i + 3] / 255;
  for (let c = 0; c < 3; c++) px[i + c] = Math.round(px[i + c] * a + 255 * (1 - a));
  px[i + 3] = 255;
}
const decoded = jsQR(Uint8ClampedArray.from(px), png.width, png.height)?.data;
if (decoded !== expected) {
  console.error(
    `\n  ✗ The captured QR leads to ${decoded ?? "(unreadable)"}, not ${expected}.` +
      `\n    Restart the app with APP_URL set to your live address, then run this again.\n`
  );
  process.exit(1);
}
console.log(`\n  ✓ QR verified: ${decoded}\n`);
