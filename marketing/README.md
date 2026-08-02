# ScoreFlow — sales presentation

**`ScoreFlow.pptx`** — 13 slides, 16:9, with transitions, automatic animations,
clickable navigation and speaker notes. Double-click it; press **F5** to present.

## What's in it

| # | Slide | |
|---|---|---|
| 1 | Title | |
| 2 | **Menu** | clickable — jumps to any section |
| 3–4 | The problem | a guest leaves unhappy and says nothing |
| 5 | The turn | *"What if you knew in 30 seconds?"* |
| 6–8 | How it works | card on the table · NFC · the alert |
| 9–10 | **Which dish** | the slide that closes the sale |
| 11 | Why trust it | every guest gets the review link |
| 12 | Price & setup | |
| 13 | Close | live QR + "Start 14 days free" button |

**Interactive bits.** The five cards on slide 2 jump to their section. Every content
slide has a **Menu** button (top right) that jumps back. The amber button on the last
slide opens the signup page in a browser. All of it works in Slide Show mode (F5) —
click actions do nothing while you're editing.

**Speaker notes** are on all 13 slides. Presenter View (Alt+F5) shows them.

## Rebuilding it

The deck is generated, not hand-built — so it can't go stale when copy changes.

```bash
python marketing/build_pptx.py      # -> marketing/ScoreFlow.pptx
```

Needs `python-pptx` once: `pip install python-pptx`.

Edit the copy in [`build_pptx.py`](build_pptx.py) and re-run. Transitions and
animations are written as raw OOXML (python-pptx has no API for either) — see
`set_transition` and `animate` near the top.

## Re-capturing the product images

`assets/*.png` are screenshots of the **real UI** on `/pitch`, not illustrations. If
the product changes, re-shoot them rather than editing the pictures.

⚠️ **The QR codes must be captured against the live URL.** `appUrl()` falls back to
`localhost:3000`, so a deck built from a plain dev server ships a QR that goes nowhere
for everyone you show it to. Start the server with `APP_URL` set first:

```bash
APP_URL=https://scoreflow-six.vercel.app npx next dev
```

Then run the capture script and rebuild. Both QRs in the current deck decode to
`https://scoreflow-six.vercel.app/signup` — **check that's still your domain** before
presenting, since the Vercel project was recreated.

## The rule this deck follows

No fabricated proof: no testimonials, no invented statistics, no customer logos. The
dashboard numbers are labelled "Example dashboard". The product's whole pitch is that
it doesn't fake your reviews — a deck with invented praise on it would refute the
thing it's selling.
