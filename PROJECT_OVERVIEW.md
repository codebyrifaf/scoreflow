# ScoreFlow — Project Overview & Handoff

> A handoff document describing the whole project: what it is, what's been built,
> how it's architected, and the conventions/gotchas an agent or developer needs
> before making changes. Last updated: **2026-07-11**, **Milestone 16 (Brands & Branches)**.
> LIVE at **https://scoreflow-six.vercel.app** (M14). NOTE: M15 landing redesign + M16 chains are
> built + verified locally but must be **git-pushed** to reach the live Vercel deploy.

---

## 1. What ScoreFlow is

ScoreFlow is a **customer meal-feedback app for restaurants**. The real-world flow:

1. A diner scans a QR code / opens a link at their table (`/r/<restaurant>/feedback?table=7`).
2. They rate the meal **1–10**, enter their **order number**, and optionally leave a **comment**.
3. They see a thank-you screen that nudges them toward leaving a **Google review**.
4. The restaurant **owner** logs in and views a private **dashboard** of all their feedback
   (totals, average rating, lowest-rated orders, full list).

It is **multi-tenant**: one deployment serves many restaurants, each isolated by a URL `slug`
(e.g. `fucco`, `bella-pizza`). Each restaurant's data and dashboard are private to that restaurant.

The project is built deliberately **one scoped milestone at a time** (the owner is a beginner and
asks not to build ahead of the current milestone).

---

## 2. Tech stack (bleeding-edge — verify against installed docs!)

| Layer | Choice | Version |
|---|---|---|
| Framework | Next.js (App Router, Turbopack) | **16.2.10** |
| UI | React | **19.2.4** |
| Styling | Tailwind CSS (v4, CSS-first config) | **^4** |
| ORM | Prisma (driver-adapter model) | **^7.8.0** |
| DB driver | `@prisma/adapter-pg` + `pg` | 7.8 / ^8.22 |
| Database | PostgreSQL (**Neon**, cloud) | — |
| Auth | Auth.js / NextAuth v5 | **^5.0.0-beta.31** |
| Password hashing | `bcryptjs` (pure-JS bcrypt) | **^3.0.3** |
| Server-guard marker | `server-only` | ^0.0.1 |
| Scripts/seed | `tsx`, `dotenv` | ^4.23 / ^17.4 |

> ⚠️ **CRITICAL for agents** — see `AGENTS.md`/`CLAUDE.md`. Next.js 16 and Prisma 7 have
> **breaking changes vs. most training data**. Always read the installed guides in
> `node_modules/next/dist/docs/` before writing framework code. Key differences already hit:
> - **`params` and `searchParams` are Promises** in page props — you must `await` them.
> - Next 16 **renamed `middleware` → `proxy`** (`proxy.ts`), and the docs push doing auth checks
>   in a **Data Access Layer** next to the data, *not* in a global gate. This project follows that.
> - **Prisma 7** uses a **driver adapter** (no bundled engine) and generates the client as
>   **TypeScript into `/generated/prisma`** (git-ignored, rebuilt by `prisma generate`).
> - Prisma 7 does **not** auto-load `.env`; CLI tooling loads it via `prisma.config.ts` and the
>   seed loads it via `import "dotenv/config"`.

---

## 3. Milestone history (how much is done)

| # | Milestone | Status | What it delivered |
|---|---|---|---|
| 1 | Customer feedback form | ✅ | The rate-1–10 + order# + comment form and thank-you screen. |
| 2 | Owner dashboard | ✅ | Summary + lowest-rated + all-submissions views. |
| 3 | Real database | ✅ | Moved storage from a local JSON file to **Postgres (Neon) via Prisma**. |
| 4 | Multi-tenancy | ✅ | `Restaurant` table; per-restaurant routes `/r/[slug]/...`; feedback isolated by `restaurantId`. Removed the old single-restaurant `/feedback` & `/dashboard` and the `RESTAURANT_NAME` constant. |
| 5 | **Owner authentication** | ✅ | Email+password login (Auth.js v5 + bcrypt); the dashboard is now private and each owner can see **only their own** restaurant. Customer pages stay public. |
| 6 | **Operator admin dashboard** | ✅ | A separate **operator** login + `/admin` area to view all restaurants and add a new one (which also creates that restaurant's owner login). Scope was "List + Add" only. |
| 7 | **Smart review routing** | ✅ | After submitting, happy raters (≥ per-restaurant `reviewThreshold`, default 8) get the Google-review nudge; unhappy raters get a private "sorry" screen with **no** public-review link. Operator sets the threshold when adding a restaurant. |
| 8 | **Owner Tables & NFC links** | ✅ | Owner-facing `/r/[slug]/tables` to add/list/remove tables; each shows a copy-able NFC link (`…/r/[slug]/feedback?table=<label>`) to write onto the table's NFC chip. |
| 9 | **Feedback tags + dashboard analytics + premium redesign** | ✅ | Customer quick-tap chips (preset, by rating) saved as `Feedback.tags`; dashboard time filters (All/Today/Week/Month), "vs previous" delta, 7-day trend, and Top-mentions. Premium white "Apple" redesign of the **customer feedback**, **login**, and **owner dashboard** pages; app is now always-light (dark-mode inversion removed). |
| 10 | **Admin + tables redesign & polish** | ✅ | `/admin` rebuilt in the premium theme: platform-overview stats, restaurant **cards** (replacing the overflowing table), **"+ Add restaurant" modal** (native `<dialog>`, centered via `m-auto`). New `getPlatformStats()`. Owner **`/r/[slug]/tables`** redesigned to cards too. **Every page now uses the premium white theme.** (Scrollbars are now **fully hidden** app-wide in `globals.css`.) |
| 11 | **Operator delete restaurant** | ✅ | Each admin card has a **Delete** that opens a confirmation modal showing the blast radius; the operator must **type the slug** to confirm (server re-checks it, operator-only). `deleteRestaurantCascade(id)` removes feedback → tables → owners → restaurant in one `$transaction` (FKs are `RESTRICT`, so children go first). |
| 12 | **Edit, password, landing page, 404** | ✅ | Operator **edit** restaurant (name/slug/Google URL/threshold; slug-change warns about NFC chips; slug uniqueness excludes self) — `updateRestaurant` + `EditRestaurantForm` + edit modal. Owner **change own password** (verify current → update; session-scoped) — `changePassword` action + `ChangePassword` modal + `updateOwnerPassword`. Real **marketing landing page** at `/`. **404** page redesigned to the premium theme. |
| 13 | **Password reset + feedback spam guard** | ✅ | Operator **resets an owner's password** from `/admin` (no email; operator sets it, owner changes it after) — `resetOwnerPassword` + `ResetPasswordButton`. Public **feedback API spam guard**: a **honeypot** field, **dedupe** (same order # within 10 min), and **per-IP rate-limit** (15/min, 120/hr; hashed IP via new `Feedback.ipHash`; lenient so shared restaurant Wi-Fi isn't blocked). Helpers `countRecentByIpHash` / `hasRecentDuplicate`. |
| 14 | **🚀 DEPLOYED LIVE** | ✅ | **Live at `https://scoreflow-six.vercel.app`** — free Vercel (Hobby) + the existing Neon DB, deployed from `github.com/codebyrifaf/scoreflow` (`master`). Vercel env vars: `DATABASE_URL` (Neon pooled, `sslmode=verify-full`) + a fresh prod `AUTH_SECRET`. `prisma/seed.ts` is **prod-safe**: operator from `OPERATOR_EMAIL`/`OPERATOR_PASSWORD` env, demo restaurants only when `SEED_DEMO=true`. Node pinned ≥20. Operator password **changed off the public dev default**. Verified live 10/10. |
| 15 | **Landing page redesign** | ✅ (local) | Apple-grade, no AI tells: `ScoreFlow` typographic wordmark (no disc), zero icons/emoji, amber only inside product screens. Hero rests on the real feedback form (self-demo). **Pinned scroll story** (`app/ScrollStory.tsx`) — one phone whose screen cross-dissolves through form→rated→Google→private→dashboard. Motion layer in `globals.css` (respects reduced-motion). New: `SiteNav.tsx`, `Reveal.tsx`, `HeroPhone.tsx`, `PhoneFrame.tsx`. |
| 16 | **Brands & Branches (chains)** | ✅ (local, this milestone) | A `Brand` groups branches (each branch = a `Restaurant`). New role **`"brand"`** (a brand owner) alongside `owner` (branch manager) + operator. `Owner.restaurantId` relaxed to nullable; `Owner.brandId`/`Restaurant.brandId` added (all backward-compatible — standalone venues unaffected). New `/b/[brandSlug]` console (overview + branch comparison cards + add/edit/delete branch + reset manager pw). Operator `/admin` gained a **Brands** section. Guard (`lib/auth-guard.ts`): brand owner may cross **their own** branches only; branch manager can't see siblings — **isolation matrix verified 15/15**. Customer URLs unchanged (NFC safe).<br>**Operator brand management (follow-up):** the operator manages a brand's *lifecycle* from `/admin` and **never enters** the private `/b/<slug>` console (same principle as never seeing a restaurant's dashboard) — so the old "Open brand console ›" link (which always hit *Not authorized*) was **removed**. Brand cards now show the branch names + rolled-up responses/tables, and gained **Reset password** (reuses `ResetPasswordButton` — a brand owner is just an `Owner` row) and **Delete brand** → `deleteBrandCascade(brandId)`: one interactive `$transaction` deleting feedback → tables → branch managers → branches → brand-owner → brand (FKs are `RESTRICT`, so children first). Typed-slug confirm + operator re-check, exactly like deleting a restaurant. Verified against the live DB: the cascade removed only the test chain (brand + 2 branches + 4 feedback + 2 tables + 3 logins) and left every other row untouched. |

**Not yet done / deferred (from the pre-sale audit, roughly in priority order):**
**owner self-service settings page** (today an owner cannot change their own name / Google URL /
review threshold — every change is a support ticket, and the landing page already advertises the
threshold); **low-rating email alerts** (the pitch says complaints are "routed quietly to you", but
they're only routed to a *database* — no email/SMS/webhook exists anywhere); **CSV export**; dashboard
**pagination + SQL aggregation** (it currently loads EVERY feedback row and filters in JS);
**per-restaurant timezone** (the server is UTC, so "Today" is wrong for a Dhaka venue);
**error boundaries + Sentry** (a DB blip currently shows a raw crash page *to a diner at the table*);
**splitting dev off the prod database**; **Vercel Pro + a custom domain** (Hobby forbids commercial
use — a blocker the moment you invoice someone); **privacy policy + terms**; **billing** (no
subscription/plan/quota code exists at all); QR codes (the landing page advertises them; they don't
exist); per-table analytics (the `table` field is captured but never aggregated); AI chips/insights;
owner self-signup; automated tests + CI.

| 17 | **🔒 Security hardening ("safe to sell")** | ✅ (local, this milestone) | Fixed four bugs that were **exploitable in production**, found by a pre-sale audit. **(1) Review-bombing:** the spam guard hashed the *leftmost* `X-Forwarded-For` — a value the *caller* writes — so a random header per request gave a fresh "IP" and the rate limit **never fired**. Now `lib/request-ip.ts` trusts only `x-vercel-forwarded-for`/`x-real-ip` (falling back to XFF **in dev only**), *plus* a **per-restaurant ceiling** (30/min, 300/hr) that holds even against rotating IPs. Also capped input sizes (`comment` was unbounded) and **whitelisted `tags`** against the real chip list. **(2)+(3) The token carried AUTHORITY, not just identity** — one root cause, two holes: the guard compared a **slug string baked into the JWT**, so (a) a password reset revoked *nothing* (a fired manager kept access for the 30-day default), and (b) because slugs are **editable and reusable**, a stale cookie could open a **different tenant's** dashboard after a rename/re-use. Fixed by the rule **"the token says who you are; the DATABASE says what you may see"**: added `Owner.tokenVersion`/`Operator.tokenVersion`, the JWT now carries only `accountId`+`kind`+`tokenVersion`, and every guard **re-loads the account** (gone → locked out; tokenVersion moved → locked out) and authorises by comparing **numeric IDs** on freshly-loaded rows. Slugs are now cosmetic. Session `maxAge` set to **7 days** (there was none). **(4) Login brute-force:** there was *no* rate limit on login at all, and `/api/auth/callback/credentials` is directly POSTable (bypassing our form) — so the guard lives **inside `authorize()`**. New `LoginAttempt` table + `lib/login-attempts.ts`: **20 failures/IP** and **10/email** per 15 min, checked **before bcrypt** (which also kills a free CPU-DoS); lockouts auto-expire; success clears the email's failures. Free rides in the same migration: the **missing `Feedback[restaurantId, createdAt]` index** (the app's hottest query was a seq scan across *all* tenants) and the **password minimum 8 → 12** (`lib/passwords.ts`). Also fixed: **brand owners could never change their own password** (the action checked `role !== "owner"`, but their role is `"brand"`). **Verified 28/28** — each of the four attacks re-run for real against the dev server and now blocked, M16 isolation matrix intact, ordinary diners unaffected. |

**⚠️ Deploy note for M17:** old sessions lack the new claims, so **everyone is signed out once** on
release. Optional new env var **`IP_HASH_SALT`** (any random string) — it falls back to `AUTH_SECRET`,
but keeping them separate means rotating `AUTH_SECRET` (the emergency "sign everyone out" lever) no
longer silently wipes the spam guard's memory.

**Post-launch to-dos for the operator (not code):** add real restaurants with their **real Google review
URLs**, and program the NFC chips from each restaurant's Tables page. (The demo Fucco/Bella restaurants
have already been **deleted** — as of 2026-07-11 the DB holds **no restaurants**, just the operator login
and one test brand.)

⚠️ **Live/dev share ONE Neon DB** (by choice). Running the app locally now reads/writes **production**
data. To de-risk later: point local dev at a separate Neon branch and leave Vercel on the main DB.

---

## 4. Routes

| Route | File | Rendering | Public? | Purpose |
|---|---|---|---|---|
| `/` | `app/page.tsx` | static | public | **Marketing landing page** — hero + product mock, how-it-works, features, review-routing highlight, CTA → `/login`. Static (server-rendered, no client JS). |
| `/login` | `app/login/page.tsx` (+ `LoginForm.tsx`, `actions.ts`) | dynamic | public | Sign-in for **both** owners and operators. Redirects by role: operator → `/admin`, owner → their dashboard. |
| `/admin` | `app/admin/page.tsx` (+ `AddRestaurantForm.tsx`, `actions.ts`) | dynamic (`force-dynamic`) | **PROTECTED (operator)** | Operator dashboard: list all restaurants + add a new one (creates its owner). Guarded by `requireOperator()`. |
| `/r/[slug]/feedback` | `app/r/[slug]/feedback/page.tsx` → `FeedbackForm.tsx` | dynamic | **public** | Customer feedback form (reads `?table=`). **Smart routing (M7):** thank-you shows the Google nudge only if `rating ≥ reviewThreshold`, else a private "sorry" screen. |
| `/r/[slug]/dashboard` | `app/r/[slug]/dashboard/page.tsx` | dynamic (`force-dynamic`) | **PROTECTED** | Owner dashboard. Guarded — see §6. Links to the Tables page. |
| `/r/[slug]/tables` | `app/r/[slug]/tables/page.tsx` (+ `TablesManager.tsx`, `actions.ts`) | dynamic (`force-dynamic`) | **PROTECTED (owner)** | Owner manages tables + their NFC links (add/list/remove + copy link). Guarded by `requireDashboardAccess(slug)`. |
| `/api/feedback` | `app/api/feedback/route.ts` | dynamic | **public** | `POST` — validate + save a feedback submission. |
| `/api/auth/[...nextauth]` | `app/api/auth/[...nextauth]/route.ts` | dynamic | public (framework) | Auth.js endpoints (sign-in POST, session, CSRF). Re-exports handlers from `auth.ts`. |
| 404 for unknown slug | `app/r/[slug]/not-found.tsx` | — | — | Rendered when a page calls `notFound()`. |

---

## 5. Data layer & database

### Server data-access modules (`lib/`, imported via the `@/` alias → repo root)
- **`lib/prisma.ts`** — single shared `PrismaClient` (global-singleton to survive dev hot-reload).
  Uses the Prisma 7 `PrismaPg` driver adapter with `DATABASE_URL`. Everything DB goes through this.
- **`lib/restaurants.ts`** — `getRestaurantBySlug(slug)`.
- **`lib/feedback.ts`** — `getFeedbackForRestaurant(restaurantId)` and `createFeedback(restaurantId, input)`.
  **Every function is scoped by `restaurantId` — this scoping is the multi-tenant isolation boundary.**
- **`lib/owners.ts`** — `getOwnerByEmail(email)` (includes the owner's `restaurant`). Added in M5.
- **`lib/operators.ts`** — `getOperatorByEmail(email)`. Added in M6.
- **`lib/auth-guard.ts`** — `requireDashboardAccess(slug)` (owner gate, M5) and `requireOperator()`
  (operator gate, M6). Both are in-page guards.
- **`lib/restaurants.ts`** — also has `getAllRestaurantsForAdmin()` and
  `createRestaurantWithOwner(...)` (a `$transaction` that creates a restaurant + its owner), added in M6.
- **`lib/tables.ts`** — `getTablesForRestaurant` / `createTable` / `deleteTable` (scoped delete). Added in M8.
- **`lib/types.ts`** — `FeedbackPayload` (client→server) and `FeedbackRecord` (dashboard view).

### Prisma schema (`prisma/schema.prisma`) — 4 tables
```
Restaurant (id, slug UNIQUE, name, googleReviewUrl?, reviewThreshold=8, createdAt)   ← reviewThreshold added in M7
   1───∞ Feedback (id, restaurantId FK, table?, orderNumber, rating, comment="", tags[]=[], ipHash?, createdAt)   ← tags M9, ipHash M13
   1───∞ Owner    (id, email UNIQUE, passwordHash, restaurantId FK, createdAt)   ← added in M5
   1───∞ Table    (id, restaurantId FK, label, createdAt; UNIQUE(restaurantId,label))   ← added in M8
Operator   (id, email UNIQUE, passwordHash, createdAt)   ← added in M6 (standalone; no restaurant)
```
- **`Feedback.restaurantId`** ties every submission to one restaurant (M4).
- **`Owner.restaurantId`** ties a login account to the one restaurant it may manage (M5). It's a
  normal many-to-one FK (not `@unique`), so a restaurant *could* have multiple owners later; today
  the seed creates exactly one per restaurant.
- **`Operator`** is a standalone platform-admin login (M6), not linked to any restaurant.
- **`Restaurant.reviewThreshold`** (M7) is the minimum rating (1–10, default 8) that gets the
  Google-review nudge on the thank-you screen; below it, the customer sees a private "sorry" screen.

### Migrations (`prisma/migrations/`) — applied in order
1. `20260707194125_init` — initial `Feedback` table (had a free-text `restaurant` string).
2. `20260707202540_add_restaurants_relation` — added `Restaurant`, replaced the string with `restaurantId` FK.
3. `20260710113638_add_owner_auth` — **additive**: `CREATE TABLE "Owner"` + unique email index + FK.
4. `20260710135400_add_operator` — **additive**: `CREATE TABLE "Operator"` + unique email index. No existing tables altered.
5. `20260710143212_add_review_threshold` — **additive**: `ALTER TABLE "Restaurant" ADD COLUMN "reviewThreshold" INTEGER NOT NULL DEFAULT 8`. Existing rows get 8; no data loss.
6. `20260710151829_add_tables` — **additive**: `CREATE TABLE "Table"` + compound unique `(restaurantId,label)` + FK. No existing tables altered.
7. `20260710165747_add_feedback_tags` — **additive**: `ALTER TABLE "Feedback" ADD COLUMN "tags" TEXT[] DEFAULT '{}'`. Existing rows get an empty array; no data loss.

### Seed (`prisma/seed.ts`, run with `npm run seed`)
Idempotent upserts. Creates two restaurants **and one owner login each**, **plus one operator login**
(passwords bcrypt-hashed; re-running resets them to the known values):

| Account | Login email | Password (DEV ONLY) |
|---|---|---|
| Fucco owner | `owner@fucco.test` | `fucco-dev-2026` |
| Bella Pizza owner | `owner@bella-pizza.test` | `bella-dev-2026` |
| **Platform operator** | `operator@scoreflow.test` | `operator-dev-2026` |

---

## 6. Authentication & the security model (Milestones 5–6)

**Library:** Auth.js v5 (`next-auth@5` beta), **Credentials provider**, **JWT session strategy**
(required by Credentials — so there are **no** session/account adapter tables; the session lives in
a signed, HttpOnly cookie signed with `AUTH_SECRET`). Passwords are hashed with **bcryptjs** and
stored only as `Owner.passwordHash`.

**Files:**
- **`auth.ts`** (repo root) — `NextAuth({...})` config. Exports `{ handlers, auth, signIn, signOut }`.
  - `authorize()` normalizes the email, looks up the owner, `bcrypt.compare`s the password, and on
    success returns `{ id, email, restaurantId, restaurantSlug }`. It **always** runs a bcrypt
    compare (against a dummy hash when the email is unknown) to avoid **user-enumeration by timing**.
  - `jwt`/`session` callbacks carry `restaurantId` + `restaurantSlug` into the token/session.
- **`app/api/auth/[...nextauth]/route.ts`** — `export const { GET, POST } = handlers`.
- **`app/login/`** — `page.tsx` (server), `LoginForm.tsx` (client, `useActionState`),
  `actions.ts` (server actions `login` + `logout`). `login` verifies credentials, then redirects to
  the owner's **own** dashboard; a single generic "Invalid email or password" is shown on any failure.
- **`lib/auth-guard.ts`** — **the security core.** `requireDashboardAccess(slug)`:
  1. Not logged in → `redirect("/login")`.
  2. Logged in but `session.user.restaurantSlug !== slug` → returns `{ authorized: false }`.
  3. Match → returns `{ authorized: true, ownerEmail, restaurantSlug }`.
- **`app/r/[slug]/dashboard/page.tsx`** — calls the guard **at the very top, before any data fetch**.
  If not authorized it renders a clean "Not authorized" screen and **loads none of the other
  restaurant's data**. Also renders the signed-in email + a **Sign out** form (calls `logout`).
- **`types/next-auth.d.ts`** — TS module augmentation adding `restaurantId`/`restaurantSlug` to the
  `Session`, `User`, and `JWT` types. (JWT augmentation targets **`@auth/core/jwt`** — the module that
  actually declares the interface — not `next-auth/jwt`, which only re-exports it.)

**Why it's safe (the guarantees):**
- The restaurant a user is allowed to see is set **server-side at login** from the DB and stored in
  the **signed** session. The browser never supplies it, so it can't be forged → **no cross-restaurant access**.
- The check runs **in the page next to the data** (Next 16's recommended DAL pattern), so it can't be
  skipped and there is no global middleware to misconfigure.
- Customer routes (`/r/[slug]/feedback`, `POST /api/feedback`) import **no** auth code and are fully public.

**Verification done (2026-07-10):** `npm run build` passes on Next 16, and a runtime end-to-end test
against the dev server confirmed all of: logged-out dashboard → redirect to `/login`; public feedback
page → 200 without login; login binds the session to the right restaurant; owner sees their own
dashboard; **Fucco owner is blocked from Bella's dashboard with no data leak**; wrong password →
no session. (A deeper automated multi-agent review was attempted but blocked by an account session
limit; a manual review found no boundary vulnerabilities.)

**Milestone 6 additions (operator):** The session now carries a `role` (`"operator"` | `"owner"`);
`auth.ts` `authorize` checks the `Operator` table first, then `Owner`, and tags the session
accordingly (same dummy-hash timing protection). `/login` redirects operators to `/admin`. `/admin`
is protected by `requireOperator()` in `lib/auth-guard.ts` (same in-page pattern as the owner gate) —
non-operators get a clean "Not authorized" screen, logged-out visitors are redirected to `/login`.
The add-restaurant server action (`app/admin/actions.ts`) re-checks `requireOperator()` (defense in
depth), validates all fields, and writes the restaurant + owner in one transaction. Verified
end-to-end (14/14 checks): operator login → `/admin` lists all restaurants; owner blocked from
`/admin`; a newly added restaurant's owner can log into only their own dashboard; the new slug's
public feedback page works logged-out; duplicate-slug creation rolls back atomically (no orphan owner).

---

## 7. Environment, config & how to run

### Environment variables (`.env` at repo root — git-ignored, never commit)
- **`DATABASE_URL`** — Postgres/Neon connection string (set since M3).
- **`AUTH_SECRET`** — signs the session cookie (added in M5). Generate with
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.

### Config files
- `prisma.config.ts` — Prisma 7 CLI config; loads `.env` via `dotenv/config`; points at the schema
  and migrations and supplies `DATABASE_URL`.
- `next.config.ts` — currently empty/default.
- `tsconfig.json` — path alias `@/* → ./*`; includes `**/*.ts(x)`.
- `.gitignore` — ignores `.env*`, `/generated/prisma`, `/.next`, `/data/`, etc.

### Commands
```bash
npm install                       # also runs `prisma generate` (postinstall)
npm run dev                       # start dev server at http://localhost:3000
npm run build                     # production build (also type-checks)
npm run seed                      # upsert restaurants + owner accounts
npx prisma migrate dev --name X   # create + apply a new migration (dev DB)
npx prisma generate               # rebuild the TS client into /generated/prisma
npx prisma studio                 # browse the DB
```

### Manual browser test (Milestone 5)
1. Logged out, open `/r/fucco/dashboard` → redirected to `/login`.
2. Log in as `owner@fucco.test` / `fucco-dev-2026` → Fucco dashboard.
3. Still logged in, open `/r/bella-pizza/dashboard` → **"Not authorized"** (no Bella data).
4. Click **Sign out** → back to `/login`.
5. Logged out, open `/r/fucco/feedback?table=7` and submit → still works (public).

---

## 8. Conventions & gotchas for the next agent

- **Follow `AGENTS.md`**: read `node_modules/next/dist/docs/` before writing Next/Prisma code; the
  installed versions differ from training data.
- **Keep work scoped to the current milestone.** Don't add features (sign-up, password reset, etc.)
  unless asked. Write clean, **heavily commented** code — the owner is a beginner and relies on it.
- **All DB access goes through `lib/` modules**, and feedback access is **always scoped by
  `restaurantId`**. Don't query `prisma.feedback` directly from a page/route.
- **Never trust the browser for identity.** Restaurant is resolved from the URL slug server-side;
  ownership is resolved from the signed session server-side.
- **Don't print secrets** (`DATABASE_URL`, `AUTH_SECRET`, password hashes). `.env` is git-ignored.
- **Generated Prisma client** lives in `/generated/prisma` (git-ignored). If model access is
  `undefined` after a schema change, run `npx prisma generate`.
- **Cleanup (pre-deploy):** the Create-Next-App boilerplate was removed — the defunct pre-M3
  `data/feedback.json`, the starter `public/*.svg` icons, and the starter homepage. `app/page.tsx` is
  now a minimal ScoreFlow home; `public/` is empty; `<title>` is "ScoreFlow".
- **Design system (M9):** the app is a clean **always-light "white theme"** (the `prefers-color-scheme: dark`
  inversion was removed from `globals.css`; `.font-system` + `.animate-card-in` utilities live there).
  The customer feedback, login, and owner dashboard pages share tokens: white bg, system font,
  `#111827`/`#6B7280`/`#9CA3AF` text, `#E5E7EB` borders, `rounded-2xl` fields, amber-500 accent with a
  soft focus ring and `active:scale` press. **All pages now use these tokens.** `globals.css` also styles
  app-wide **thin scrollbars**. Native modal `<dialog>`s need `m-auto` to stay centered (Tailwind's reset
  removes the default margin) — see `app/admin/AdminRestaurants.tsx`.

---

## 9. File map (excluding `node_modules`, `.next`, `generated/`)

```
auth.ts                         # Auth.js v5 config (handlers/auth/signIn/signOut)
prisma.config.ts                # Prisma 7 CLI config
next.config.ts  tsconfig.json  eslint.config.mjs  postcss.config.mjs
AGENTS.md / CLAUDE.md           # "this is not the Next.js you know" rules
PROJECT_OVERVIEW.md             # (this file)

app/
  layout.tsx                    # root layout (title "ScoreFlow")
  page.tsx                      # minimal ScoreFlow home (links to /login)
  globals.css                   # Tailwind v4 entry + theme vars
  login/  page.tsx  LoginForm.tsx  actions.ts     # sign-in for owners + operators (M5/M6)
  admin/  page.tsx  AdminRestaurants.tsx  AddRestaurantForm.tsx  actions.ts   # PROTECTED operator dashboard (M6, redesigned M10)
  api/
    auth/[...nextauth]/route.ts # Auth.js endpoints (M5)
    feedback/route.ts           # public POST feedback API
  r/[slug]/
    feedback/  page.tsx  FeedbackForm.tsx          # public customer form
    dashboard/ page.tsx                            # PROTECTED owner dashboard
    tables/    page.tsx  TablesManager.tsx  actions.ts   # PROTECTED owner tables + NFC links (M8)
    not-found.tsx                                  # unknown-slug 404

lib/
  prisma.ts  restaurants.ts  feedback.ts  owners.ts  operators.ts  tables.ts
  feedback-chips.ts (M9 preset chips)  auth-guard.ts  types.ts

prisma/
  schema.prisma  seed.ts
  migrations/ (init, add_restaurants_relation, add_owner_auth, add_operator,
              add_review_threshold, add_tables, add_feedback_tags, add_feedback_iphash)

types/next-auth.d.ts            # session/JWT type augmentation incl. role (M5/M6)
.env                            # DATABASE_URL, AUTH_SECRET (git-ignored)
```
