# Connecting your POS to ScoreFlow

ScoreFlow can show your guests feedback options **about the exact dish they
ordered** — "Burger was dry" instead of "Food was cold". To do that, ScoreFlow needs
to know what was in each order.

Your till already knows. This guide connects the two.

---

## Part 1 — For the restaurant owner

### What this gives you

Without it, a guest who had a bad burger taps *"Food was cold"* and you learn almost
nothing. With it, they tap *"Burger was dry"* — and your dashboard tells you which
dish is losing you customers.

**Your guests do nothing differently.** They still just type their order number and
tap a score. Everything here happens behind the scenes.

### What you need

- A till/POS that can **send information to a web address** (most modern systems
  can — it's usually called a *webhook* or an *integration*)
- Five minutes, or one message to whoever supports your POS

### What to do

The part people find surprising: **you don't get anything from your POS.**
ScoreFlow gives *you* two values, and you put them *into* your till. It's like
giving someone your phone number so they can call you.

1. In ScoreFlow, open **Settings → Connect your till**
2. Press **Connect my till**. You'll see two things:
   - a **web address** (URL)
   - a **key** — a long password for machines
3. **Send both to your POS provider** and ask:
   > *"Please configure our till to send each new order to this URL, with this key
   > in the Authorization header. ScoreFlow's setup guide is here: [link to this
   > file]"*
4. That's it. When it's working, Settings shows
   **"● Last order received 2 minutes ago"**.

### Keep the key private

The key lets a system send orders into **your** ScoreFlow account. Treat it like a
password — share it only with your POS provider. If it ever leaks, press
**Generate a new key** and give your provider the new one; the old one stops
working immediately.

The full key is shown **once**, when it's created. After that ScoreFlow only shows
its first few characters, because we store it scrambled and genuinely cannot read
it back. Lost it? Generate a new one.

### If your POS can't do this

Some older tills can't send anything out. **You still get better suggestions than
the old generic ones** — just based on your menu as a whole rather than the exact
dish. Add your menu in **Settings → Your menu** and everything else works normally.

---

## Part 2 — For developers

### Overview

Send ScoreFlow one HTTP request per order, as soon as the order is created. That is
the entire integration.

```
POST https://scoreflow-six.vercel.app/api/pos/orders
Authorization: Bearer <the restaurant's ScoreFlow POS key>
Content-Type: application/json

{
  "orderNumber": "102",
  "items": ["Chicken Cheese Burger", "Fries", "Cold Coffee"],
  "placedAt": "2026-07-28T19:12:00Z"
}
```

The restaurant is identified by the key. There is no restaurant id, slug, or name
in the payload — and there deliberately never will be, because identity has to come
from a secret you were given rather than a field you can set.

### Fields

| Field | Required | Notes |
|---|---|---|
| `orderNumber` | yes | **The number printed on the guest's receipt** — the one they'll type into the feedback form. Not your internal order ID, unless they happen to be the same. Max 32 characters. |
| `items` | yes | Dish names as they appear on the menu. Max 50, each max 80 characters. Quantities and modifiers can be omitted. |
| `placedAt` | no | ISO 8601. Defaults to the time we receive it. |

> ⚠️ **`orderNumber` is the single most important field.** ScoreFlow matches on what
> the guest types, and guests type what's printed in front of them. If you send an
> internal UUID, nothing will ever match — the request will succeed and the feature
> will silently do nothing.

Dish names don't have to match the restaurant's ScoreFlow menu exactly. Matching is
case-insensitive and tolerates extra text, so `"CHICKEN CHEESE BURGER (L)"` still
matches a menu entry of `"Chicken Cheese Burger"`.

### Responses

| Status | Meaning |
|---|---|
| `201` | Stored |
| `400` | Malformed payload — check the field rules above; the body explains which field |
| `401` | Missing or wrong key, or the `Bearer ` prefix was omitted |
| `429` | Too many orders this hour; back off and retry |
| `500` | Our problem — safe to retry |

### Timing

Send the order **when it is created**, not at end of day. Guests submit feedback
10–40 minutes after ordering, so the order must already be with us by then.

- Orders are matched against feedback for **6 hours** after we receive them.
- Orders are **deleted after 24 hours.** We only need the recent ones, and keeping a
  restaurant's full order history would be holding their commercial data for no
  reason.

Re-sending the same order **updates** the existing record rather than duplicating
it, so retries are safe.

### Examples

**cURL — use this to test before writing any code:**

```bash
curl -X POST https://scoreflow-six.vercel.app/api/pos/orders \
  -H "Authorization: Bearer sk_pos_YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{"orderNumber":"102","items":["Chicken Cheese Burger","Fries"]}'
```

Then open the restaurant's feedback page, type `102`, and tap a low score — the
suggestions should be about the burger.

**JavaScript / Node — if you built your own POS, add this where an order is saved:**

```js
// After the order is committed — never before.
try {
  await fetch("https://scoreflow-six.vercel.app/api/pos/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SCOREFLOW_POS_KEY}`,
    },
    body: JSON.stringify({
      orderNumber: order.receiptNumber,
      items: order.lines.map((l) => l.name),
      placedAt: order.createdAt.toISOString(),
    }),
  });
} catch (err) {
  // Log and move on. Feedback suggestions are a nice-to-have; taking the
  // customer's money is not. Never let this roll back or block a sale.
  console.error("ScoreFlow order push failed:", err);
}
```

**Python:**

```python
import os, requests

try:
    requests.post(
        "https://scoreflow-six.vercel.app/api/pos/orders",
        headers={"Authorization": f"Bearer {os.environ['SCOREFLOW_POS_KEY']}"},
        json={"orderNumber": order.receipt_number,
              "items": [line.name for line in order.lines]},
        timeout=5,
    )
except requests.RequestException as err:
    log.warning("ScoreFlow order push failed: %s", err)
```

**No webhook support?** Any automation tool (Zapier, Make, n8n) can watch your POS
and make this request. A cron job polling your own database every minute works too —
anything that delivers the order within a few minutes.

### Getting the key

The restaurant owner generates it: **ScoreFlow → Settings → Connect your till**.

The full key is shown **once**, at generation — only a hash is stored, so it cannot
be retrieved later. If it's lost, generate a new one; the old one is invalidated
immediately.

**One key per location.** A group with three restaurants has three keys, and each
location's till must send its own orders under its own key. That separation is what
keeps each location's data its own.

### Troubleshooting

| Symptom | Cause |
|---|---|
| `401` | Key is wrong, or the header is missing the `Bearer ` prefix |
| `201` but suggestions unchanged | `orderNumber` doesn't match what the guest typed — you're almost certainly sending an internal id rather than the receipt number |
| Worked, then stopped | A new key was generated; update your configuration |
| Settings shows no orders received | Nothing is reaching us. Check the URL, and check the POS is firing on **order creation** rather than on payment |
| Works, but only sometimes | The order is arriving more than 6 hours before the feedback, or after it. Send on order creation. |

### Notes for whoever maintains ScoreFlow

The endpoint is [app/api/pos/orders/route.ts](../app/api/pos/orders/route.ts); key
handling and matching are in [lib/pos-orders.ts](../lib/pos-orders.ts).

⚠️ **This document is the contract.** If you change the payload, the caps, the
retention window, or the status codes, change this file in the same commit — an
integration guide that lies is worse than none, because the developer trusts it over
the error message they're seeing.
