# Till survey — what to ask restaurant owners

## Why this exists

ScoreFlow's best feature needs to know what was on each order. That comes from the
till. But "can we connect to your till?" is unanswerable by the person we're asking —
**restaurant owners are not technical**, and most genuinely do not know whether their
POS has an API.

So this survey never asks a technical question. It asks about **brand names, who they
ring, what they can see, and what's printed on a receipt** — things every owner knows —
and we work out the technical answer ourselves from the pattern of replies.

### What we're actually trying to learn

Which of four buckets each restaurant falls into:

| Bucket | What it means for us |
|---|---|
| **A — Big cloud POS** (Square, Toast, Lightspeed, Zettle, Clover, Epos Now, TouchBistro, SumUp) | Best case. These publish public APIs. We build the integration **once** and every owner on that brand connects themselves. The POS company's permission is not required. |
| **B — Custom / local-developer POS** | Easy per restaurant, doesn't scale. Their developer adds one HTTP call using `docs/POS_INTEGRATION.md`. |
| **C — Vendor-locked on-premise till** | The hard one. No public API, and a reseller with no reason to help. May be impossible. |
| **D — No till, or paper** | Not connectable. They still get menu-wide chips — the product degrades gracefully. |

⚠️ **This survey is for prioritising, not gatekeeping.** ScoreFlow works without any
till connection ([lib/chips-for-order.ts](e:/scoreflow/lib/chips-for-order.ts) falls
back to menu-wide chips, then generic ones). Nobody is disqualified by their answers.
The point is to find **which two or three POS brands to build first**, because those
will cover most of the market.

---

## The survey

Keep it under five minutes. Every question offers "I'm not sure" as a real answer —
an owner who feels tested will abandon it, and "not sure" is itself useful data.

### Section 1 — Your till

**Q1. What's the name of your till system?**
*The brand name on the screen when you start it, or printed on your receipts.*

- [ ] Free text: ______________________
- [ ] I don't know the name — **I'll send a photo instead** (see Q11)

> **The single most valuable question.** One brand name decides everything else. Most
> owners can answer it; the ones who can't are covered by the photo.

**Q2. Did you buy the till outright, or do you pay for it every month?**

- [ ] Monthly or yearly subscription
- [ ] Bought once, no ongoing fee
- [ ] It came free with our card payment provider
- [ ] Not sure

> A subscription almost always means a modern cloud system — bucket A. A one-off
> purchase years ago points at bucket C.

**Q3. Can you check today's sales from your phone or your computer at home — without
being at the restaurant?**

- [ ] Yes, I log into a website or an app
- [ ] No, only on the till itself
- [ ] Not sure

> **The best non-technical proxy we have.** If the data already leaves the building,
> there is almost certainly an API. This question alone separates A from C.

**Q4. How do you take card payments?**

- [ ] The same machine as the till
- [ ] A separate card machine
- [ ] Both, depending on the till point

> An all-in-one usually means Square/SumUp/Zettle — bucket A, and we may already know
> the API.

### Section 2 — Who looks after it

**Q5. When the till stops working, who do you ring first?**

- [ ] The company that sold it to us — name: ______________________
- [ ] A local computer or IT person
- [ ] Someone who works for us
- [ ] Nobody — we turn it off and on again

> Tells us whether a human exists who could do a 30-minute job for us. "Someone who
> works for us" is bucket B and the easiest sale of all.

**Q6. Was your till built specially for your restaurant, or is it a product that lots
of restaurants use?**

- [ ] Built specially for us
- [ ] A product lots of restaurants use
- [ ] Not sure

> Confirms B vs A. "Built specially for us" means there's a developer we can hand
> `docs/POS_INTEGRATION.md` to today.

**Q7. If we sent your till company a one-page instruction, what do you think would
happen?**

- [ ] They'd do it — they're helpful
- [ ] They'd do it, but they'd charge
- [ ] They'd ignore it or take months
- [ ] I'd rather not ask them
- [ ] Not sure

> This is the bucket-C detector. Ask it plainly; owners are usually very honest and
> often quite funny about their POS supplier.

### Section 3 — How your orders work

**Q8. Does each order get a number the customer can see?**

- [ ] Yes, printed on the receipt
- [ ] Yes, we call the number out
- [ ] No, we use table numbers instead
- [ ] No numbers at all

> **Critical, and easy to overlook.** ScoreFlow matches feedback to an order by order
> number. "Table numbers instead" isn't fatal but changes the matching, and "no
> numbers at all" means bucket D regardless of how good the till is.

**Q9. On your receipts, do dishes print with their full names or short codes?**

- [ ] Full names — "Chicken Burger"
- [ ] Short codes — "CHK BRG" or "ITEM 214"
- [ ] A mix
- [ ] Not sure

> **The question nobody thinks to ask.** Our dish matching compares the till's item
> names against the menu. A till that sends `CHKBRG1` matches nothing, and the owner
> would see the feature silently do nothing. If short codes are common we need a
> mapping step — better to learn that now than after launch.

**Q10. On a normal Friday night, roughly how many orders do you take?**

- [ ] Under 50   [ ] 50–150   [ ] 150–300   [ ] 300+

> Sizing, and it tells us whose data would actually be worth having.

### Section 4 — The shortcut

**Q11. Could you send two photos?**

- [ ] A photo of a receipt (the whole thing, including the very bottom)
- [ ] A photo of the till screen on its main page

> **This rescues every "I don't know" above.** Receipts very often print the POS brand
> in the footer, and the till's home screen is unmistakable. Two photos can answer Q1,
> Q4, Q8 and Q9 at once, from an owner who couldn't answer any of them in words.

**Q12. May we contact your till provider directly, on your behalf?**

- [ ] Yes — their contact: ______________________
- [ ] I'd rather introduce you myself
- [ ] No

> Owners often *want* this taken off their plate. It also gets us talking to the POS
> company, which is how a bucket-C restaurant occasionally turns into a bucket-A
> partnership.

---

## Reading the answers

| Signal | Bucket |
|---|---|
| Q3 = "yes, I log in" + Q2 = subscription | **A** — check whether that brand's API is already on our list |
| Q6 = "built specially" or Q5 = "someone who works for us" | **B** — send `docs/POS_INTEGRATION.md` today |
| Q3 = "only on the till" + Q7 = "ignore it" | **C** — deprioritise; sell them the menu-wide fallback honestly |
| Q8 = "no numbers at all" | **D** — regardless of the till |

**What to do with the results.** Count the brand names from Q1. If one brand shows up
in a third of replies, that's the integration to build first — one build, every
restaurant on it. That is the entire purpose of running this.

---

## How to ask it

- **Keep it to one page.** Twelve questions is already near the limit for a busy owner.
- **Never use the words** API, webhook, endpoint, integration, JSON, or POST. If a
  question can't be asked without them, it belongs in this document's notes, not in
  the survey.
- **Ask it in person or by phone if you can.** An owner will happily tell you their
  POS company is useless out loud, and tick "not sure" on a form.
- **Lead with what they get**, not what you need: *"I'm working out whether we can
  show your guests feedback options about the exact dish they ordered."*
- Offer the photos (Q11) early to anyone who hesitates — it turns a hard survey into
  an easy one.
