/**
 * AI — the one seam the app goes through for anything a model generates.
 *
 * Everything that needs a model (reading a photographed menu, writing per-dish
 * feedback chips) calls a function here and nothing else. WHICH provider actually
 * runs is chosen by the `AI_PROVIDER` env var, so switching providers never
 * touches a line of calling code — that is the entire point of this file, and it
 * is the same shape as lib/email.ts, which has been doing this for providers of
 * email since M18.
 *
 * Three modes:
 *   • unset            → TEMPLATE chips by category (lib/feedback-chips.ts). No
 *                        API key, no cost, nothing that can fail at runtime. The
 *                        whole menu feature is developable and demoable free, and
 *                        this is the permanent fallback when a provider breaks.
 *   • AI_PROVIDER=gemini → Google Gemini. Free tier, and it reads images, so the
 *                        "photograph your menu" path works. Right for development.
 *   • AI_PROVIDER=anthropic → Claude. The grown-up option for when you're charging
 *                        money. Deliberately a stub for now — see below.
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║ ⚠️ NOTHING HERE MAY BE CALLED ON THE DINER'S PATH.                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * Every function below is invoked from an OWNER action (saving a menu), never
 * from `/api/feedback` or the chips lookup. A diner is standing at a table with a
 * phone in their hand; adding seconds and a third-party outage to that flow to
 * generate text we could have generated hours earlier would be indefensible.
 * Chips are generated once, stored on the `MenuItem` row, and read from there.
 *
 * ⚠️ FREE TIERS ARE A DEVELOPMENT CONVENIENCE, NOT A PRODUCTION PLAN. Rate limits
 * and eligibility change without notice. This adapter exists so that discovering
 * that costs one env var rather than a rewrite.
 */

import "server-only";
import {
  templateChipsFor,
  KNOWN_CATEGORIES,
} from "./feedback-chips";

/** A dish, as extracted from a menu or entered by hand. */
export interface ExtractedDish {
  name: string;
  category: string | null;
}

/** The two chip sets for one dish. */
export interface DishChips {
  positive: string[];
  negative: string[];
}

/** Did a model actually run, or did we fall back? Surfaced to the owner. */
export type AiResult<T> = {
  data: T;
  source: "ai" | "template";
  /** Set when a provider was configured but failed — shown to the owner so a
   *  broken key isn't silently indistinguishable from "AI is off". */
  warning?: string;
};

// ── Bounds. Model output is not trusted input. ───────────────────────────────
//
// React escapes everything, so there's no XSS here — but an over-long, empty, or
// duplicated chip is still a defect on a diner's phone, and an unbounded list is
// still a way for a bad response to bloat the database. Clamp at the boundary
// rather than hoping the prompt was obeyed.
const MAX_CHIP_LENGTH = 28;
const MAX_CHIPS_PER_BAND = 6;
const MAX_DISHES = 200;
const MAX_DISH_NAME_LENGTH = 80;

/** Clean one model-produced chip list into something safe to store and render. */
function boundChips(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const chip = item.trim().replace(/\s+/g, " ").slice(0, MAX_CHIP_LENGTH);
    if (!chip) continue;
    const key = chip.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(chip);
    if (out.length >= MAX_CHIPS_PER_BAND) break;
  }
  return out;
}

/** Clean one model-produced dish into something safe to store. */
function boundDish(raw: unknown): ExtractedDish | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name =
    typeof r.name === "string"
      ? r.name.trim().replace(/\s+/g, " ").slice(0, MAX_DISH_NAME_LENGTH)
      : "";
  if (!name) return null;
  const category =
    typeof r.category === "string" && r.category.trim()
      ? r.category.trim().toLowerCase().slice(0, 40)
      : null;
  return { name, category };
}

// ── The public seam ──────────────────────────────────────────────────────────

/** Is a real provider configured (and usable)? The Settings UI tells the owner
 *  the truth about whether the photo path will actually work. */
export function aiIsConfigured(): boolean {
  const provider = process.env.AI_PROVIDER;
  if (provider === "gemini") return !!process.env.GEMINI_API_KEY;
  if (provider === "anthropic") return !!process.env.ANTHROPIC_API_KEY;
  return false;
}

/**
 * Read a photographed menu into a list of dishes.
 *
 * Needs vision, so it only works with a configured provider. With none, this
 * returns empty and the caller falls back to the type/paste path — which is
 * exactly why that path is not optional.
 *
 * `dataUrl` is the same shrunk-in-the-browser `data:` URL the M26 logo uploader
 * produces, and is validated by the caller before it reaches here.
 */
export async function extractMenu(
  dataUrl: string
): Promise<AiResult<ExtractedDish[]>> {
  const provider = process.env.AI_PROVIDER;

  if (provider !== "gemini") {
    return {
      data: [],
      source: "template",
      warning:
        provider === "anthropic"
          ? "The Anthropic provider isn't wired up yet — type or paste your menu instead."
          : undefined,
    };
  }

  try {
    const dishes = await geminiExtractMenu(dataUrl);
    return { data: dishes, source: "ai" };
  } catch (err) {
    console.error("[ai] menu extraction failed:", err);
    return {
      data: [],
      source: "template",
      warning:
        "We couldn't read that photo. Try a clearer picture, or type your menu below.",
    };
  }
}

/**
 * Write positive and negative chips for each dish.
 *
 * ⚠️ ALWAYS RETURNS A USABLE RESULT. With no provider, a broken key, or a failed
 * request, every dish still gets template chips — the product is never blocked on
 * an AI provider being reachable. That is the difference between AI as a feature
 * and AI as a dependency.
 */
export async function generateChips(
  dishes: ExtractedDish[]
): Promise<AiResult<Map<string, DishChips>>> {
  const fallback = () => {
    const map = new Map<string, DishChips>();
    for (const d of dishes) map.set(d.name, templateChipsFor(d.name, d.category));
    return map;
  };

  if (process.env.AI_PROVIDER !== "gemini") return { data: fallback(), source: "template" };

  try {
    const generated = await geminiGenerateChips(dishes);
    // Any dish the model skipped still gets templates — a partial response must
    // never leave a dish with no chips at all.
    const map = fallback();
    for (const [name, chips] of generated) {
      if (chips.positive.length && chips.negative.length) map.set(name, chips);
    }
    return { data: map, source: "ai" };
  } catch (err) {
    console.error("[ai] chip generation failed:", err);
    return {
      data: fallback(),
      source: "template",
      warning:
        "We couldn't reach the AI service, so we've used standard suggestions. You can edit them below.",
    };
  }
}

// ── Google Gemini ────────────────────────────────────────────────────────────
//
// ⚠️ Written against the INSTALLED SDK's own type definitions (`@google/genai`
// v2.x — `new GoogleGenAI({apiKey})`, `ai.models.generateContent({model, contents,
// config})`), not from memory. Two things were verified there rather than assumed:
// the package is `@google/genai` (the older `@google/generative-ai` is a different,
// legacy SDK), and structured output uses `responseJsonSchema` alongside
// `responseMimeType` on `GenerateContentConfig`. Re-check both on upgrade —
// AGENTS.md's rule about Next and Prisma applies at least as hard to an AI SDK.

/** Free-tier friendly and handles images. Override per environment if needed. */
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/** One client, created lazily so importing this module opens nothing. */
let geminiClient: import("@google/genai").GoogleGenAI | null = null;

async function gemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("AI_PROVIDER=gemini but GEMINI_API_KEY is not set");
  if (!geminiClient) {
    // Dynamic import so the SDK is only loaded when Gemini is actually the
    // provider — the same reason lib/email.ts dynamic-imports nodemailer.
    const { GoogleGenAI } = await import("@google/genai");
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

/** Split a `data:image/png;base64,XXX` URL into the parts the SDK wants. */
function splitDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Not a base64 data URL");
  return { mimeType: match[1], data: match[2] };
}

async function geminiExtractMenu(dataUrl: string): Promise<ExtractedDish[]> {
  const ai = await gemini();
  const { mimeType, data } = splitDataUrl(dataUrl);
  const { createPartFromBase64 } = await import("@google/genai");

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          createPartFromBase64(data, mimeType),
          {
            text:
              "This is a photograph of a restaurant menu. List every dish you can " +
              "read on it.\n\n" +
              "For each dish give its name exactly as printed, and a category from " +
              `this list where one fits: ${KNOWN_CATEGORIES.join(", ")}. ` +
              "Use null for the category if none fits.\n\n" +
              "Ignore prices, section headings, opening hours, addresses and any " +
              "text that is not a dish. If the image is not a menu, return an " +
              "empty list.",
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object",
        properties: {
          dishes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                category: { type: "string" },
              },
              required: ["name"],
            },
          },
        },
        required: ["dishes"],
      },
    },
  });

  const parsed = JSON.parse(response.text ?? "{}") as { dishes?: unknown };
  const list = Array.isArray(parsed.dishes) ? parsed.dishes : [];
  const out: ExtractedDish[] = [];
  const seen = new Set<string>();
  for (const raw of list.slice(0, MAX_DISHES)) {
    const dish = boundDish(raw);
    if (!dish) continue;
    const key = dish.name.toLowerCase();
    if (seen.has(key)) continue; // a menu often prints a dish twice
    seen.add(key);
    out.push(dish);
  }
  return out;
}

async function geminiGenerateChips(
  dishes: ExtractedDish[]
): Promise<Map<string, DishChips>> {
  const ai = await gemini();

  // ONE request for the whole menu, not one per dish. Cheaper, faster, and the
  // model can keep the wording consistent across dishes because it sees them all.
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              "You write the one-tap feedback options a restaurant guest sees on " +
              "their phone after a meal.\n\n" +
              "For each dish below, write:\n" +
              `  • up to ${MAX_CHIPS_PER_BAND} POSITIVE options — what a guest who ` +
              "enjoyed it would say\n" +
              `  • up to ${MAX_CHIPS_PER_BAND} NEGATIVE options — what a guest who ` +
              "was disappointed would say\n\n" +
              "Rules:\n" +
              `  • Each option must be at most ${MAX_CHIP_LENGTH} characters. They ` +
              "are buttons on a phone, not sentences.\n" +
              "  • Be specific to the dish. 'Dry' and 'Bun fell apart' are useful; " +
              "'Bad' and 'Food was not good' are not.\n" +
              "  • Describe the FOOD, not the service — service is asked about " +
              "separately.\n" +
              "  • Plain language a guest would actually use. No emoji.\n\n" +
              "Dishes:\n" +
              dishes
                .map((d) => `- ${d.name}${d.category ? ` (${d.category})` : ""}`)
                .join("\n"),
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object",
        properties: {
          dishes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                positive: { type: "array", items: { type: "string" } },
                negative: { type: "array", items: { type: "string" } },
              },
              required: ["name", "positive", "negative"],
            },
          },
        },
        required: ["dishes"],
      },
    },
  });

  const parsed = JSON.parse(response.text ?? "{}") as { dishes?: unknown };
  const list = Array.isArray(parsed.dishes) ? parsed.dishes : [];

  // Match the model's names back to ours case-insensitively — it may echo a
  // slightly different capitalisation than we sent.
  const byLower = new Map(dishes.map((d) => [d.name.toLowerCase(), d.name]));
  const out = new Map<string, DishChips>();
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.name !== "string") continue;
    const ourName = byLower.get(r.name.trim().toLowerCase());
    if (!ourName) continue; // a dish we didn't ask about
    out.set(ourName, {
      positive: boundChips(r.positive),
      negative: boundChips(r.negative),
    });
  }
  return out;
}
