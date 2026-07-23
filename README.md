# Pre-Meal — Phase 1, 2, auth & real payments

A real, runnable Next.js + PostgreSQL app implementing the core of Pre-Meal:
sign up/log in → browse restaurants → pick a delivery slot → place an order
→ restaurant confirms within 30 minutes (charging happens right then,
Amazon-style) → order status tracking → restaurant gets paid automatically
after delivery.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind v4)
- **PostgreSQL** via **Prisma 6** ORM
- **Zod** for API input validation
- **Auth**: email + password, hashed with Node's built-in `scrypt`, sessions
  as a signed HMAC cookie — no third-party auth library. See "How auth
  works" below for why.
- **Stripe** + **Stripe Connect** for payments and restaurant payouts — see
  the "Payments" section below, this is real, not stubbed.

## Run it locally

You'll need PostgreSQL (any way of running it — Homebrew, Docker, Postgres.app,
a hosted service) and Node 20+.

```bash
# 1. Install dependencies (this also runs `prisma generate` automatically)
npm install

# 2. Make sure Postgres is running and a `premeal` database exists, then
#    point .env at it (DATABASE_URL). .env already has a working default if
#    you're using the included docker-compose.yml.

# 3. Set AUTH_SECRET in .env if it isn't already — any long random string:
#    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 4. Create the database tables
npx prisma migrate dev --name init

# 5. Add demo data (2 restaurants, menus, a week of delivery slots, and
#    working login credentials — see below)
npm run seed

# 6. Run the app
npm run dev
```

Open the printed localhost URL — that's the customer app.

In a second terminal, run the background sweep that auto-declines orders
whose 30-minute window ran out with no restaurant response:

```bash
npm run worker
```

### Demo logins (created by `npm run seed`)

| Email | Password | Role |
|---|---|---|
| `owner@sakurasushi.test` | `password123` | Restaurant owner (Sakura Sushi) |
| `owner@luigiskitchen.test` | `password123` | Restaurant owner (Luigi's Kitchen) |
| `customer@premeal.test` | `password123` | Customer |

Restaurant owners land on `/restaurant/dashboard` after logging in — no more
copying IDs out of Prisma Studio. You can also sign up fresh accounts of
either kind at `/signup`.

## How the flow actually works

1. **Customer places an order** (`POST /api/orders`, must be logged in) —
   runs inside one database transaction that (a) atomically reserves a spot
   on the chosen delivery slot and (b) creates the order as
   `PENDING_CONFIRMATION` with a 30-minute deadline. No payment happens here.
2. **Restaurant accepts or declines** from their dashboard
   (`POST /api/orders/:id/confirm` or `/decline` — both check that the
   logged-in user actually owns that restaurant before doing anything).
   - **Confirm** → status becomes `CONFIRMED`. This is where a real Stripe
     charge would fire (currently stubbed).
   - **Decline** → the slot's capacity is released back for someone else to
     book, no charge to refund since nothing was charged.
3. **If nobody responds in 30 minutes**, the worker script (or, in
   production, a scheduled job) calls `expireStaleOrders()`, which finds
   overdue orders, releases their capacity, and marks them `EXPIRED` —
   functionally identical to a decline.
4. **The customer's order page polls every 4 seconds** and shows a live
   countdown against `confirmationDeadline`, then reflects whatever the
   restaurant (or the timeout) decided.

## How auth works

Login creates a cookie shaped like `userId.expiryTimestamp.signature`, where
the signature is `HMAC-SHA256(userId.expiryTimestamp, AUTH_SECRET)`. A
request is trusted only if recomputing that signature matches — so nobody
can forge or extend a session without knowing `AUTH_SECRET`. Passwords are
hashed with `scrypt` (built into Node, no extra dependency).

I deliberately didn't reach for NextAuth/Clerk/etc. here: this app's auth
needs are simple (two roles, no OAuth, no magic links yet), and a bespoke
~150-line implementation is easier for you to read, audit, and modify than
learning a third-party library's config surface. If you later need OAuth
login, passkeys, or multi-device session management, that's the point to
swap in a real auth provider — the `getCurrentUser()` /
`setSessionCookie()` boundary in `src/lib/auth.ts` is designed to make that
swap contained to one file.

**Known limitations of this auth system**, worth fixing before real users:
- No email verification on signup.
- No "forgot password" flow.
- No rate limiting on login attempts.
- No server-side session revocation ("log out everywhere") — rotating
  `AUTH_SECRET` invalidates *all* sessions at once, there's no per-session
  revoke.
- The order-tracking page (`/orders/:id`) doesn't check that the viewer is
  the customer who placed it — it relies on the ID being unguessable. Fine
  for a demo, not fine once orders matter.

## Why the capacity logic is written the way it is

The one thing that must never happen: two customers both booking the last
spot on a slot. `src/lib/capacity.ts` reserves a spot with a single atomic
SQL statement —

```sql
UPDATE "DeliverySlot"
SET "bookedCount" = "bookedCount" + 1
WHERE "id" = $1 AND "bookedCount" < "capacity"
RETURNING "id"
```

— run inside the same database transaction that creates the Order row. If
the row count comes back 0, the slot was already full and the whole
transaction rolls back cleanly. This is safe under real concurrency; a
"read the count, check it in JavaScript, then write" approach would not be.

## What's stubbed / deliberately left for later

- **Cancellations** — the schema has `CANCELLED` and `cancelledAt`, but no
  API route yet.
- **Delivery tracking beyond "confirmed"** — `PREPARING` /
  `OUT_FOR_DELIVERY` / `DELIVERED` exist as states but nothing transitions
  orders through them yet.
- **The full weekly meal-planner UI** — the order form here places one
  order for one slot at a time; bundling several days into one checkout is
  a UI feature on top of this same API.
- **Production cron** — `npm run worker` is a dev stand-in. In production,
  replace it with Vercel Cron (or similar) calling
  `POST /api/jobs/expire-orders` on a schedule, or a proper queue worker.
- Auth limitations listed above.

## A note on Prisma's version

This project intentionally uses **Prisma 6.19.3**, not the newly-released
Prisma 7. Prisma 7 requires a bigger architectural change (a separate
`prisma.config.ts`, mandatory database driver adapters, ESM-only output) and
had open bugs with local Postgres connections at the time this was built.
Prisma 6 is stable, simpler to set up, and does everything this app needs.
Worth revisiting once Prisma 7 has settled.

## Project structure

```
prisma/
  schema.prisma       — data model (see comments inline)
  seed.ts             — demo data + demo login credentials
src/
  lib/
    db.ts             — shared Prisma client
    capacity.ts        — the capacity engine (see above)
    password.ts         — scrypt password hashing (no Next.js dependency,
                           safe to import from scripts like seed.ts)
    auth.ts             — sessions (cookies), re-exports password.ts
    format.ts           — money/date formatting helpers
  app/
    page.tsx                          — customer home (restaurant list)
    login/, signup/                    — auth pages
    components/nav.tsx, logout-button.tsx
    restaurants/[id]/page.tsx          — restaurant + order form
    orders/[id]/page.tsx               — order status / countdown
    restaurant/dashboard/              — restaurant portal (session-based,
                                          no ID in the URL)
    api/
      auth/signup|login|logout|me      — auth routes
      restaurants/                    — GET list, GET one (with live slots)
      orders/                         — POST create, GET list/filter (owner-only)
      orders/[id]/confirm|decline     — restaurant actions (owner-only)
      jobs/expire-orders              — the timeout sweep
scripts/
  expire-orders-worker.ts — dev stand-in for a production cron
docker-compose.yml    — local Postgres (optional — any Postgres works)
```

## Restaurant onboarding flow

After signing up at `/signup` as a restaurant owner, a new restaurant has no
menu and no delivery slots — it's intentionally **not visible to customers**
until both exist (see the "Live" query in `src/app/page.tsx`). The dashboard
shows a setup checklist pointing at the two things needed:

1. **`/restaurant/menu`** — pick a prebuilt starter menu template (see
   `src/lib/menu-templates.ts`) for a one-click starting point, or add items
   by hand. Items can be marked unavailable or removed afterward.
2. **`/restaurant/deliveries`** — set a recurring delivery window, capacity,
   and same-day cutoff hour, then generate the next N days in one action.
   Individual days can have their capacity adjusted afterward (e.g. to
   close a day for a holiday — capacity can't be dropped below what's
   already booked, to avoid silently overbooking).

This is **self-serve with no admin approval step** — a deliberate choice to
keep friction low for now. Real platforms (Just Eat, etc.) gate this behind
document/compliance review before going live; that's a reasonable thing to
add later under Admin Panel work, not before.

## Delivery lifecycle & disputes

After confirmation, an order moves through:

`CONFIRMED` → (restaurant clicks "Mark out for delivery") → `OUT_FOR_DELIVERY` → (restaurant clicks "Mark delivered") → `DELIVERED`

Two safety mechanisms sit around this, in `src/lib/delivery.ts`:

- **Auto-complete safety net**: if a restaurant leaves an order
  `OUT_FOR_DELIVERY` for more than `AUTO_DELIVER_AFTER_HOURS` (3h) without
  marking it delivered, the worker sweep auto-completes it. Otherwise a
  restaurant could indefinitely stall a customer's ability to ever report a
  problem or see closure.
- **Report-a-problem window**: a customer can report a problem any time
  from dispatch up to `PAYOUT_GRACE_PERIOD_HOURS` (24h) after delivery.
  Doing so sets `disputedAt` and clears `payoutEligibleAt`, which is what
  will eventually keep it out of the (not yet built) Stripe payout job's
  query. No dispute in that window = eligible for payout automatically —
  the standard "trust the seller, time-boxed buyer override" pattern most
  marketplaces use.

`Order.payoutEligibleAt` / `payoutSentAt` exist in the schema now
specifically so the future Stripe Connect step doesn't need another
migration — nothing consumes them yet.

## Location-based search

Restaurants set an address and a delivery radius (they deliver themselves —
this is "how far will I drive," not a marketplace-wide setting) at
`/restaurant/location`. Customers search by address on the homepage; the
address is geocoded via Mapbox, and restaurants are filtered to ones whose
own radius covers that distance (`src/lib/geo.ts` does the distance math —
plain Haversine, no database extension needed at this scale).

Requires a `MAPBOX_TOKEN` in `.env` — free tier at
https://account.mapbox.com/access-tokens/. Without one set, `/api/geocode`
and the restaurant location page return a clear "not configured" error
rather than failing silently.

A restaurant with no address set simply doesn't appear in address-filtered
search results, but still shows in the default unfiltered browse list — so
this didn't retroactively hide any existing restaurant.

**Known gap**: `/api/geocode` has no auth and no rate limiting. It's a
read-only lookup so it's not a security risk, but each call costs against
the Mapbox quota — worth rate-limiting before real traffic.

## Menu photo uploads

Restaurant owners upload real photos (not just paste a URL) from
`/restaurant/menu`, via Cloudinary. Requires three env vars —
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` —
free tier at https://cloudinary.com/users/register/free (find them on your
dashboard after signing up). Without them set, uploads fail with a clear
"not configured" message rather than crashing.

Uploads are capped at 5MB, restricted to JPEG/PNG/WebP/GIF, and resized
server-side to a max 800×800 on the way in — so a restaurant owner never
has to think about image sizing. The manual "paste a URL" field is still
there as a fallback.

## Menu categories

Restaurants organize their own menu into sections (e.g. "Main Meals",
"Sides", "Drinks") from `/restaurant/menu` — add, rename, reorder, delete.
Each item gets assigned to a category via a dropdown; unassigned items show
as "Uncategorized" rather than becoming invalid. Deleting a category
un-assigns its items instead of deleting or blocking them
(`onDelete: SetNull` in the schema).

Customers see these as filter tabs on the restaurant page. Categories are
entirely restaurant-defined — there's no fixed global list — so this
doesn't impose a taxonomy that might not fit a given cuisine.

## Order history

- **Customers** — `/orders` lists every order they've placed, most recent
  first, with a status badge and a link into the live status page for each.
- **Restaurant owners** — `/restaurant/orders` shows the full order history
  (not just the actionable ones on the dashboard), filterable by status.
  The dashboard stays focused on what needs action right now; this is the
  "everything, past and present" view.

## Payments (Stripe) — how it actually works now

This used to be a stub. It's real now. Three separate pieces:

### 1. Checkout — collecting a card

The customer enters their card fresh at every order (no saved-cards UI, by
design). Under the hood, that still goes through a Stripe **Customer**
object per user (`User.stripeCustomerId`, created lazily on first
checkout) and a **SetupIntent** — this validates and temporarily holds the
card as a PaymentMethod *without charging anything*, because the actual
charge doesn't happen until the restaurant confirms, which could be hours
later. `src/app/restaurants/[id]/checkout-payment.tsx` mounts Stripe's
Payment Element and confirms the SetupIntent; the resulting
`payment_method` id is stored on the Order (`Order.stripePaymentMethodId`).

### 2. Confirmation — the actual charge

When a restaurant hits "Accept" (`confirmOrder()` in `src/lib/capacity.ts`),
that's the moment a real off-session PaymentIntent is created and charged
to the **platform's** Stripe account — not the restaurant's; see below.
If the charge fails (card declined, etc.), the order is automatically
declined and the slot's capacity is released, same as a restaurant-initiated
decline — just tagged with `failureReason` instead of a restaurant's choice.

**3D Secure handling**: an off-session charge can't just show a normal
"requires_action" state and wait — Stripe fails it outright with an
`authentication_required` error, since the customer isn't there in that
moment. When that happens, the order moves to `PAYMENT_ACTION_REQUIRED`
(capacity stays reserved, nothing declined) and the customer sees a
"Verify payment" button on their order page (`payment-action-verify.tsx`)
— no card re-entry, it just completes the existing PaymentIntent's
authentication challenge via Stripe.js. `src/lib/payment-actions.ts` holds
this whole flow, including a timeout sweep (`expirePaymentActions()`,
wired into `npm run worker`) that auto-expires it if the customer never
comes back — nothing was charged, so it's a clean expiry, not a decline
needing a refund. **Test card**: `4000 0025 0000 3155` always triggers
this path.

### 3. Payouts — restaurants get paid separately, later

This uses Stripe Connect (Express accounts) with **separate charges and
transfers**, not destination charges — deliberately, so a restaurant that
never delivers can just be refunded from the original charge, with no
money ever having reached them to claw back.

- A restaurant connects via `/restaurant/payouts` → Stripe's hosted
  onboarding (`src/lib/connect.ts`). This is **optional to go Live** — a
  restaurant can take orders without it, but literally cannot be paid
  until it's done (the dashboard nudges them if it's missing).
- **Commission is 12% of the food subtotal only** — the restaurant keeps
  100% of the delivery fee, since they deliver it themselves.
  `computePayoutSplit()` in `src/lib/payments.ts` does this math and it's
  stored on the order at confirmation time (`platformFeeCents`,
  `restaurantPayoutCents`), not recomputed later.
- The actual money movement is a real Stripe **Transfer**, created by
  `runPayoutSweep()` — wired into `npm run worker` alongside the other
  sweeps — for every order that's `DELIVERED`, past its
  `payoutEligibleAt` deadline, and has no `disputedAt`. A restaurant
  that hasn't finished onboarding is skipped, not failed — those orders
  stay queued and get paid on a later sweep once they do.

### 4. Cancellations — free before charged, refunded after

`src/lib/cancellation.ts`. A customer can cancel from their order page any
time up to `OUT_FOR_DELIVERY`:
- **`PENDING_CONFIRMATION` or `PAYMENT_ACTION_REQUIRED`** → free, nothing
  was ever charged.
- **`CONFIRMED`** → a real Stripe refund fires (`refundOrder()`) before
  the order is marked cancelled — if Stripe rejects the refund, the order
  stays exactly as it was rather than showing cancelled with no refund
  actually issued.
- **`OUT_FOR_DELIVERY` / `DELIVERED`** → blocked; "report a problem" is
  the right tool once food has actually left the restaurant.

Cancelling always releases the delivery slot's capacity back, regardless
of which state it was cancelled from. This is a simpler policy than the
original spec's 48h/24h/store-credit tiers — full refund or nothing,
no partial/store-credit path — worth revisiting if that nuance matters
later.

### Setup

```
STRIPE_SECRET_KEY=""                   # https://dashboard.stripe.com/test/apikeys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=""  # same page
STRIPE_WEBHOOK_SECRET=""               # see below
NEXT_PUBLIC_APP_URL="http://localhost:3000"  # used to build Connect onboarding redirect URLs
```

**Webhook, for local dev**: Stripe can't reach `localhost` directly. Install
the [Stripe CLI](https://docs.stripe.com/stripe-cli), then:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```
It prints a `whsec_...` value — that's your `STRIPE_WEBHOOK_SECRET`. Leave
this running in a third terminal alongside `npm run dev` and `npm run
worker` while testing. Right now the webhook only reacts to
`account.updated` (Connect onboarding completion) — the payout status page
also has a manual "refresh" path that doesn't depend on the webhook firing,
so this isn't strictly required to test the core flow, just for onboarding
status to update automatically without a manual refresh.

**Test cards**: `4242 4242 4242 4242`, any future expiry, any CVC — succeeds.
`4000 0000 0000 0002` — always declines, useful for testing the
charge-failure → auto-decline path. `4000 0025 0000 3155` — always
requires 3D Secure, useful for testing the `PAYMENT_ACTION_REQUIRED` flow.
`4000 0000 0000 0077` — succeeds with funds immediately in your *available*
balance rather than *pending* — **use this one if you want to see
`runPayoutSweep()` actually complete a Transfer**, since a normal test
charge's funds sit in pending balance (same as real settlement delay) and
Transfers can only pull from available balance. Full list at
https://docs.stripe.com/testing.

**Connect test onboarding**: Stripe's test-mode onboarding form has a
"skip" / autofill option for most fields — you don't need real bank
details to complete it in test mode.

## Saved delivery addresses

Customers manage saved addresses at `/addresses` — add, remove, and pick a
default. At checkout (`address-picker.tsx`), the default is pre-selected
automatically; picking "Use a different address" reveals a free-text field
with a "save this for next time" checkbox (saves on blur, not on submit —
harmless if they end up not placing the order). The first address a
customer ever saves automatically becomes their default; deleting a
default promotes the next most recent one (`src/lib/addresses.ts`).

Addresses are geocoded opportunistically on save (best-effort — an
address that fails to geocode still saves fine, just without
coordinates) so they're ready if a future feature needs distance, without
introducing a second address format alongside the free-text one already
used for `Order.deliveryAddress` and `Restaurant.address`.

**Known gap**: nothing currently checks that a saved (or freshly typed)
delivery address is actually within the restaurant's delivery radius —
radius filtering only happens at the browse/search stage right now, not
enforced at order placement.

## Address autocomplete

`src/app/components/address-autocomplete.tsx` is a shared component used
everywhere an address gets typed: homepage search, restaurant location
setup, checkout's "use a different address" field, and the saved-addresses
page. Debounced (300ms, 3+ characters) calls to `GET /api/geocode/suggest`,
which proxies to Mapbox's autocomplete endpoint if `MAPBOX_TOKEN` is set,
or Nominatim otherwise (see the existing geocoding fallback notes above —
Nominatim's 1 req/sec limit makes it noticeably laggy for live typing;
this feature specifically wants Mapbox configured). Picking a suggestion
reuses its coordinates directly rather than re-geocoding the selected text
a second time.

A restaurant can also cancel an order it already accepted (ran out of an
ingredient, unexpected closure, etc.) from the "Confirmed — ready to
dispatch" section of their dashboard — requires a reason, always refunds
in full, and is blocked once the order is `OUT_FOR_DELIVERY` (same cutoff
as the customer side). The customer's order page shows this distinctly
("The restaurant had to cancel this order") along with the reason given,
rather than the generic cancellation copy used for their own
cancellations. `restaurantCancelOrder()` in `src/lib/cancellation.ts`.

## Admin panel

Three pieces, deliberately scoped — promotions/discount codes, broadcast
notifications, and subscriptions from the original spec are **not**
included here; they need their own infrastructure (email sending, a
coupon schema tied into checkout) and would have bloated this past a
single pass. Still open, see "Next steps."

### 1. Restaurant approval — now a real gate

Previously self-serve: finish your menu + delivery setup and you're live.
Now a restaurant needs **both** that setup **and** admin approval
(`Restaurant.approvalStatus`, defaults to `PENDING` on every signup) —
see the updated "Live" logic in `/restaurant/dashboard`. Enforced in three
places, not just hidden in the UI: the homepage query, the individual
restaurant page (`notFound()` for anything not `APPROVED`), and
`createOrder()` itself in `src/lib/capacity.ts` — so a stale link or a
direct API call can't route around a pending/rejected restaurant.

Admins manage this at `/admin/restaurants` — approve, or reject with a
reason that's shown back to the restaurant owner on their dashboard.

**Migration note**: existing/seeded restaurants (Sakura Sushi, Luigi's
Kitchen) are seeded as pre-approved so demo/testing flows keep working;
only new signups start `PENDING`.

### 2. Dispute resolution

A customer's "report a problem" (see the delivery lifecycle section
above) used to just freeze the payout forever with nobody to act on it.
Now `/admin/disputes` lists every open dispute, and an admin picks one of
two resolutions (`src/lib/admin.ts`):
- **Release payout** — sides with the restaurant, sets
  `payoutEligibleAt` back to now so the next payout sweep pays them.
- **Refund** — sides with the customer, issues a real Stripe refund
  (`payoutEligibleAt` stays null, so the restaurant is never paid for
  that order).

Both mark `disputeResolvedAt`/`disputeResolution` so it drops off the open
list either way.

### 3. Overview dashboard

`/admin` — orders today/this week/this month, total platform revenue
(sum of `platformFeeCents` on delivered orders), top restaurants by order
volume, and shortcuts to anything needing attention (pending approvals,
open disputes).

### Becoming an admin

There's no self-serve admin signup — `/api/auth/signup`'s role is
restricted to `CUSTOMER`/`RESTAURANT_OWNER` at the zod-schema level, so
this can't be abused via a crafted request. The seed script creates
`admin@premeal.test` (password `password123`); promoting a real user to
`ADMIN` in production is a manual database operation, deliberately.

## Star ratings & reviews

One review per order, only allowed once `status = DELIVERED` — reviews are
tied to something that actually happened, not a free-standing "leave a
review for any restaurant" form. `src/lib/reviews.ts`.

**The rating shown everywhere (`Restaurant.averageRating`/`reviewCount`)
is cached, not computed live** — recalculated from scratch inside the same
transaction as every new review. A restaurant list page rendering 20+
cards would otherwise mean 20+ live aggregate queries just to draw stars;
this way it's a single field read. `averageRating` stays `null` (not `0`)
until the first review exists, so "no reviews yet" and "reviewed, badly"
render differently rather than looking the same.

Shown in three places:
- The customer's order page — a star-picker + optional comment appears
  once an order is delivered, replaced by the submitted review afterward
  (no edit/delete yet — one shot, a reasonable v1 constraint).
- The restaurant's own page — average + up to 10 most recent reviews with
  comments.
- **The restaurant owner's dashboard and `/restaurant/reviews`** — this is
  the "am I performing well" view the rating system exists for. The
  average and count sit right next to the "Live" badge on the main
  dashboard, not buried in a sub-page.

The homepage also gained a real **"Highest rated" sort**, alongside the
existing price/distance sorts — no fake "Best match"-by-popularity or
placeholder ratings were added; a restaurant with zero reviews just shows
no stars rather than a fabricated number.

## Promotions, subscriptions, and broadcast emails

Three separate subsystems, each with a scoping call worth knowing about.

### Discount codes

Admin-managed at `/admin/promotions` — code, percentage or fixed-amount
discount, optional minimum order, optional total-uses cap, optional
per-customer-uses cap (defaults to 1), optional restaurant restriction.

**Redemption uses the exact same concurrency-safe pattern as the delivery
capacity engine** — a single atomic `UPDATE ... WHERE redemptionCount <
maxRedemptions` (`src/lib/promotions.ts`), not a "read count, check in JS,
then write," which would let two concurrent checkouts both slip past a
redemption cap. The checkout flow has a two-step feel: a live preview
(`POST /api/checkout/validate-promo`, read-only, just for UX) shows the
discount before the customer commits, then the real, authoritative
application happens inside `createOrder()`'s transaction — the preview is
never trusted as-is.

One structural note: applying a code needs the order to already exist
(`PromoRedemption.orderId` is a required, unique foreign key), but the
order's total needs the discount amount. So `createOrder()` creates the
order first with a provisional total, then patches it after the promo
code is applied — both inside the same transaction, so it's still atomic
from the outside.

### Subscriptions (Pre-Meal+, £9.99/mo — free delivery + 5% off)

**Deliberately built on Stripe's own hosted pages, not custom UI**:
Stripe Checkout for subscribing, Stripe Billing Portal for
managing/cancelling. A custom Elements-based subscription flow would mean
reimplementing proration, payment-method updates, and cancellation
edge cases Stripe already solved. `src/lib/subscriptions.ts`.

Setup: create a recurring Price in your Stripe dashboard (test mode) and
put its ID in `STRIPE_SUBSCRIPTION_PRICE_ID`. The webhook
(`checkout.session.completed`, `customer.subscription.updated/deleted`)
keeps our `Subscription` table in sync — it's a read model mirroring
Stripe, not the source of truth.

**Subscription benefits and a promo code don't stack** — if a promo code
is applied to an order, the subscription's free-delivery/5% is skipped for
that order, and vice versa. This is a deliberate simplification, not a
technical limit — "let the customer pick whichever is better" would need
comparing both before charging, which isn't built.

### Broadcast emails

New infrastructure: **Brevo** (`src/lib/email.ts`), needed since nothing
in this app could send an email before now. Originally scoped to admin
broadcast only (`/admin/broadcast` — sends a one-off message to all
customers, all restaurant owners, or everyone); transactional emails
(order confirmed, "you have a new order," etc.) were built on top of the
same `sendEmail()` shortly after — see "Transactional emails" below.

No queue — broadcast sends sequentially inside one request, capped at 500
recipients. Fine at this app's current scale, not how you'd do this for a
real user base; that needs a background job.

### Setup

```
STRIPE_SUBSCRIPTION_PRICE_ID=""   # a recurring Price ID from your Stripe dashboard
BREVO_API_KEY=""                   # https://brevo.com
BREVO_FROM_EMAIL=""                # must be a domain you've verified with Brevo
```

### Restaurant signup fee (one-time, not recurring)

A flat £50, charged **once**, before a restaurant can go Live — separate
from and in addition to the ongoing 12% commission per order.
Deliberately **not** a subscription: a restaurant that makes zero sales in
a given month is never billed anything beyond that one-time fee.
`src/lib/restaurant-fees.ts`, same Stripe Checkout pattern as the
subscription above but in one-time `payment` mode rather than
`subscription` mode — and unlike the subscription, it doesn't need a
pre-created Stripe Price, since a single fixed-amount charge can use
inline `price_data`.

**Payment only opens up after admin approval** — a restaurant can prep
their menu and delivery days in parallel while waiting on approval, but
the "pay signup fee" step is deliberately locked out (enforced in
`createSignupFeeCheckoutSession()`, not just hidden in the UI) until
`approvalStatus = APPROVED`. This also sidesteps the "what if we have to
refund a rejected restaurant" problem entirely — a rejected restaurant
never pays in the first place.

Enforced at the same three points as restaurant approval (homepage query,
individual restaurant page, and `createOrder()` itself) — a restaurant
that hasn't paid is invisible to customers and can't receive orders even
via a direct/stale link, the same defense-in-depth reasoning as approval.

## Security fixes (found while auditing endpoints for mobile use)

Two real, pre-existing bugs, found by checking which API routes actually
had proper guards before letting the mobile app depend on them. Both
fixed immediately, not batched with the mobile work below since they
affect the web app right now too:

- **`GET /api/orders/[id]` had no authentication check at all.** Any
  order — including the customer's name, email, and delivery address
  (via the `customer` include) — was readable by anyone who knew or
  could guess its ID, logged in or not. Now requires the requester to be
  either the customer who placed the order or an admin; confirmed no
  other legitimate caller (the restaurant dashboard only ever calls the
  action sub-routes like `/confirm`, `/restaurant-cancel`, never this
  plain `GET`) was relying on the old open behavior.
- **`GET /api/restaurants/[id]` had no approval/signup-fee gate.** The
  web restaurant page enforces this (`notFound()` if not approved or
  signup fee unpaid — see `src/app/restaurants/[id]/page.tsx`), but the
  API route serving the same data had no equivalent check, meaning a
  restaurant that isn't actually live yet had its full menu fetchable by
  anyone who knew its ID. Now returns 404 under the same conditions the
  web page does.

## Mobile app foundation (backend groundwork, no Expo code yet)

Two pieces of real backend work, done before any mobile screen exists,
since both would have been wrong foundations to build screens on top of:

- **Bearer-token auth alongside the existing cookie**, not instead of it.
  `src/lib/auth.ts`'s `getCurrentUser()` now checks the cookie first (web,
  unchanged), then falls back to an `Authorization: Bearer <token>` header
  (mobile) — same signed-token format, same `sessionVersion` revocation
  logic, same password-reset "log out everywhere" behavior. Login, signup,
  and reset-password now all include `token` in their JSON response body;
  the web client ignores it (it already has the cookie), a mobile client
  stores it (in `expo-secure-store`, not `AsyncStorage` — same reasoning
  as `httpOnly` for the cookie: don't put an auth token somewhere ordinary
  app code could read it in plaintext) and sends it back as that header
  on every request.
- **Fixed a real, pre-existing bug found while checking what mobile would
  actually call**: `/api/restaurants` had its own simpler, out-of-date
  copy of "which restaurants are orderable" — missing the approval-status,
  signup-fee-paid, and open-delivery-slot checks the web homepage enforces.
  It would have shown a mobile customer restaurants they couldn't actually
  order from. Extracted the real logic into
  `src/lib/restaurant-listing.ts` — one function, used by both the
  homepage and the API route now, so this can't drift apart again the way
  it just did.

## Address autocomplete tightened to street-level results

Found via real testing: the autocomplete would happily suggest county or
city-level matches ("Derbyshire", "Derby") alongside real street
addresses. Selecting one of those "worked" in the sense that it didn't
error, but it geocoded to some arbitrary point in the middle of a huge
area — which made the delivery radius check (built a few sessions ago)
nearly meaningless for that address, since the "distance" being compared
wasn't really the distance to where anyone lives.

Fixed at the source rather than left for the radius check to catch:
- **Mapbox**: added `types=address` to the autocomplete request — Mapbox
  supports restricting results to specific precision levels, and county/
  city/region-level matches are now simply never suggested.
- **Nominatim** (the no-API-key fallback): has no equivalent built-in
  filter, so results are now post-filtered — only kept if they resolved
  to an actual street (`address.road` present in the response).

Also found and fixed while investigating this: the seeded demo customer's
addresses were both in Peterborough, while both seeded demo restaurants
are in Derby — a mismatch that predates the radius check and only became
a real problem once enforcement went live. Fixed in `prisma/seed.ts`:
the demo addresses are now on the same streets as the demo restaurants
(different building numbers), guaranteeing they're within range without
needing to hand-verify an unfamiliar postcode. **Re-run `npm run seed`**
to pick this up — it won't retroactively fix addresses already in an
existing database (see the address dedup script above for the general
pattern of a one-off fix script if that's ever needed here too).

**Follow-up fix, found the same day**: two issues surfaced from testing
the tightened autocomplete for real. First, restricting to `types=address`
turned out to also exclude genuine postcode-only searches ("PE2 5SP") —
Mapbox classifies postcodes as a separate type from numbered street
addresses, so the fix needed to allow both (`types=address,postcode`),
not just the one that happened to fix the original county-level problem.
Second, and more strikingly: with no country restriction, a UK postcode
fragment ("pe2 5sp") coincidentally matched a real street name in Spain
("Carrer Pe2, Lleida") and Mapbox confidently offered it as a suggestion.
Both Mapbox and Nominatim now restrict results to the UK
(`country=gb` / `countrycodes=gb`) — a deliberate, hardcoded assumption
worth revisiting if this app ever expands beyond the UK, not something to
leave silently implicit.

## Item customization modal


Menu items with modifier groups (e.g. Lasagna's Size choice) now open a
real modal instead of expanding inline inside the card — a bottom sheet
on mobile, a centered card on larger screens. Prompted by comparing
against a reference screenshot: the inline approach was fine for one
modifier group, but would start to strain with two or three stacked in a
small card.

Deliberately **not** adopted from that reference: the "Have you seen…"
cross-sell carousel. That's a real feature decision (what counts as "you
might also like"?), not a UI question — left out rather than folded in
silently. If wanted later, it's buildable honestly the same way the
dashboard's "Top dishes" leaderboard was: real most-ordered items from
that restaurant, not arbitrary suggestions.

What changed functionally: the quantity stepper now lives inside the
modal itself, and the confirm button shows the real line total ("Add
£47.96") instead of a plain "Done" that didn't say what you were about to
add — both quantity and modifier selections commit together in one
action. Items with no modifiers are unaffected — they keep the direct
+/− stepper on the card, no modal, since forcing one open for a simple
add would be worse, not better.

## Bugs found via real usage (not guessed at)

Two real issues surfaced from actually using the deployed radius-check
feature — both traced to real root causes, not just patched at the
symptom:

- **Checkout could get stuck on "Verifying card…" forever.** Card
  verification (Stripe) and order creation are two separate steps — the
  pay button assumed that once card verification succeeded, the order
  would always succeed too and the page would navigate away, so it never
  reset its own disabled state. That's false the moment order creation
  fails for any reason *after* a valid card (out-of-range address, a slot
  that just filled up, etc.) — exactly what happened when the new
  delivery radius check correctly rejected an order. Fixed in
  `checkout-payment.tsx`/`order-form.tsx`: `handleSubmit` now reports back
  whether the order actually succeeded, and the button only stays
  disabled if it did (since the page is about to navigate away anyway) —
  otherwise it re-enables so the customer can fix the address and retry.
- **Saving an address could create duplicates.** The "don't save this
  address twice" guard lived entirely in React state on the client,
  which doesn't survive a page reload or — the actual trigger here —
  retrying checkout multiple times with the same address after a
  rejected order, each retry re-triggering a save. Fixed at the real
  layer, `createAddress()` in `src/lib/addresses.ts`: it now checks for
  an existing address with the same text (case-insensitive) for that user
  before creating a new one, reusing it instead. `scripts/dedupe-addresses.ts`
  is a one-off cleanup for duplicates already created before this fix —
  safe to run more than once, run with `npx tsx scripts/dedupe-addresses.ts`.

## Deploying to a real test server

This app was built and tested entirely locally up to this point. Two
paths are documented below — **Render is the better fit for this app
specifically** and is the recommended path; Vercel is kept as an
alternative since the groundwork for it (the cron sweep route) is
already built and doesn't hurt to have either way.

### Why Render fits this app better than Vercel

Vercel is serverless-only — there's no way to run a persistent process on
it at all, which is why the Vercel path below needed a whole workaround
(`src/app/api/cron/sweep/route.ts` + a GitHub Actions workflow calling it
every 5 minutes, since Vercel's own free-tier cron only runs once a day).

**Render supports genuine persistent Background Worker services as a
first-class, free-tier-included feature** (confirmed directly from
Render's own pricing page, not a third-party summary). That means
`npm run worker` — the exact script already used for local dev — deploys
to Render **completely unchanged**, running continuously exactly like it
does on your machine. No API route restructuring, no external scheduler,
no workaround. This is a real architectural win, not just a preference.

### Render deployment steps

1. **Push to GitHub** — same as step 1 in the Vercel section below.
2. **Database**: render.com dashboard → New → PostgreSQL. Free tier to
   start. Copy the **Internal Database URL** if your web service and
   worker will also be on Render (faster, no external network hop) — use
   the **External Database URL** only if something outside Render needs
   to reach it.
3. **Web service**: New → Web Service → connect the GitHub repo. Render
   auto-detects Next.js. Build command: `npm run build`. Start command:
   `npm start`. Add every env var from `.env.example` (real API keys,
   the `DATABASE_URL` from step 2) under the service's Environment tab.
   You do **not** need `CRON_SECRET` for this path — that was only for
   the Vercel workaround.
4. **Background worker**: New → Background Worker → same GitHub repo.
   Build command: `npm run build` (needs the same compiled output).
   Start command: `npm run worker`. Same env vars as the web service,
   especially `DATABASE_URL` — this process needs its own database
   connection, separate from the web service's.
5. **Apply migrations**: from your local machine, pointed at the
   database's *external* connection string:
   ```bash
   npx prisma migrate deploy
   npm run seed   # optional
   ```
6. **Stripe webhook**: same as step 5 in the Vercel section — point it at
   `https://your-service.onrender.com/api/webhooks/stripe`.
7. **Smoke test**: visit the deployed URL, place a test order, and check
   the Background Worker's logs in the Render dashboard to confirm it's
   actually sweeping (you should see the same `[worker] ...` log lines
   it prints locally, on the same ~30 second cadence).

One thing to verify yourself before committing to this for anything
beyond testing: free-tier specifics (whether a free Postgres database
expires after some number of days, whether the free web service spins
down after inactivity) vary across what's publicly reported and can
change — check Render's own current pricing/docs pages directly rather
than trusting a summary, this one included.

### Vercel deployment steps (alternative)

### 1. Push to GitHub

```bash
cd premeal-app
git init
git add .
git commit -m "Initial commit"
```
Create a new repository on GitHub (via github.com — don't make it public
if you're not ready for that), then:
```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### 2. Database — Neon (or Vercel Postgres)

Either works; Neon's free tier is generous and pairs well with Vercel.
Create a project at neon.tech, and copy **the pooled connection string**
specifically (usually labeled "Pooled connection" or has `-pooler` in the
hostname, sometimes with `?pgbouncer=true`) — not the direct one. This
matters more than it sounds: every serverless function invocation can
open a new database connection, and a direct (non-pooled) connection
string will exhaust Postgres's connection limit under any real load.

### 3. Deploy to Vercel

1. vercel.com → New Project → import the GitHub repo you just pushed.
   It'll auto-detect Next.js — no build config needed.
2. Before the first deploy, add every environment variable from
   `.env.example` in the project's Settings → Environment Variables,
   using your real API keys (Stripe, Mapbox/Cloudinary, Brevo, Upstash
   if using it) and the Neon pooled connection string for `DATABASE_URL`.
   Also generate a real `CRON_SECRET` (`openssl rand -hex 32`) and set
   `NEXT_PUBLIC_APP_URL` to what your Vercel URL will be
   (`https://your-project.vercel.app`).
3. Deploy. It'll build, but the database is still empty at this point.

### 4. Apply migrations and seed the production database

From your local machine, pointed at the production `DATABASE_URL`
(temporarily set it in your local `.env`, or prefix the command):
```bash
npx prisma migrate deploy   # NOT `migrate dev` — deploy applies existing
                             # migrations without prompting or creating new ones
npm run seed                # optional — only if you want the demo data there too
```

### 5. Point Stripe at the real webhook

In the Stripe dashboard (test mode is fine for a test server) → Developers
→ Webhooks → Add endpoint → `https://your-project.vercel.app/api/webhooks/stripe`.
Copy the signing secret it gives you into Vercel's `STRIPE_WEBHOOK_SECRET`
env var, then redeploy (env var changes need a redeploy to take effect).
This replaces `stripe listen`, which was only ever for local dev.

### 6. Wire up the real sweep schedule

In your GitHub repo → Settings → Secrets and variables → Actions:
- Add variable `APP_URL` = `https://your-project.vercel.app`
- Add secret `CRON_SECRET` = the exact same value you set in Vercel

The workflow in `.github/workflows/sweep.yml` will start running every 5
minutes automatically once it's on the default branch. You can trigger it
manually from the Actions tab (workflow_dispatch) to test it immediately
rather than waiting.

### 7. Smoke test

Visit the deployed URL, sign up, place a real (test-mode) order, confirm
it as a restaurant, and check the GitHub Actions tab to confirm the sweep
workflow is actually running and returning `"ok": true`.



Admin-managed at `/admin/feature-flags` — a database-backed on/off switch
for optional features, no code change or redeploy needed to flip one.
`src/lib/feature-flags.ts`. A flag with no row in the database yet
**defaults to enabled**, so adding a new flag later never silently turns
something off before anyone's configured it.

**Subscriptions ship disabled by default** (seeded that way) — the
reasoning: a subscription is a retention/monetization lever that only
pays off once there's real repeat-order data to price it against
correctly. Launching it on day one means guessing at "£9.99/month, 5%
off, free delivery" instead of knowing your actual average order value
and reorder rate. The code is fully built and tested; it's just switched
off until there's data to price it with confidence — flip it on any time
from the admin page.

Enforcement is defense-in-depth like everywhere else in this app: the
"Pre-Meal+" nav link is hidden when the flag is off, **and** the checkout
endpoint (`POST /api/subscribe/checkout-session`) rejects the request
server-side regardless of what the UI shows. One nuance worth knowing: an
*existing* subscriber can still see the nav link and reach the Stripe
Billing Portal to manage/cancel even while the flag is off — disabling the
flag stops new signups, it doesn't strand people already subscribed.

## Transactional emails

Every order-lifecycle and account-lifecycle event that used to be silent
now sends an email — `src/lib/notifications.ts`, twelve functions, one per
event. Reuses the same Brevo setup broadcast already needed
(`BREVO_API_KEY`, `BREVO_FROM_EMAIL`) — no new env vars.

**What's covered:**

| Event | Customer email | Restaurant email |
|---|---|---|
| Order placed | ✅ | ✅ (new order, 30-min clock) |
| Confirmed (charged) | ✅ | — |
| Declined / payment failed | ✅ | — |
| Auto-expired (restaurant missed it) | ✅ | ✅ |
| 3D Secure verification needed | ✅ | — |
| Out for delivery | ✅ | — |
| Delivered | ✅ | — |
| Cancelled (either side) | ✅ | ✅ if customer-initiated |
| Restaurant approved / rejected | — | ✅ |
| Dispute resolved | ✅ | ✅ |
| Payout sent | — | ✅ |

**Design rules, applied consistently across all twelve:**

- **Every notify function is fire-and-forget** (`void notifyX(id)`), called
  *after* the triggering database transaction commits — never inside one,
  since a network call has no business holding a Postgres transaction
  open. This meant restructuring a few functions (`createOrder`,
  `confirmOrder`, `expireStaleOrders`, etc.) to capture their result first
  and notify after, rather than `return`ing straight out of
  `prisma.$transaction(...)`.
- **A failed email never fails the underlying operation.** Each function
  wraps its entire body in try/catch and only logs on failure — it's
  structurally impossible for a broken email to roll back an order
  confirmation or a payout.
- **One recipient's failure doesn't block another's.** `notifyOrderPlaced`
  sends to both the customer and the restaurant owner; if one send fails,
  the other still goes out (`safeSend()` isolates each call).
- **Brevo not configured is a quiet no-op, not an error log** — expected
  in local dev, not worth a log line every single time.

**Retry queue**: a transient Brevo outage no longer means an email is just
gone — see "Email retry queue" further down for the durable, worker-swept
retry that was built on top of this.

## Auth hardening — email verification & password reset

Both reuse the same hashed-token pattern (`src/lib/tokens.ts`: 32 random
bytes, SHA-256'd for storage — fast hash is correct here since these are
already high-entropy single-use tokens, not passwords) and the same
Brevo setup broadcast/notifications already needed. No new env vars.

**Email verification** (`src/lib/account-verification.ts`) is
**non-blocking by design** — an unverified user can fully use the app.
They just see a dismissible amber banner (persists across client-side
navigation for the session, resets on a full reload) with a resend
button. Nothing currently gates checkout, going Live, or anything else on
verification status; that's a deliberate scope call, not an oversight —
flagged here in case the business wants to harden it into a real
requirement later.

**Password reset** (`src/lib/password-reset.ts`) is the one with real
security weight, and handled accordingly:
- The "forgot password" endpoint gives an **identical response** whether
  or not the email matches an account — the only way to prevent it being
  used to enumerate registered emails.
- Reset tokens expire in 30 minutes (vs. 24 hours for email verification)
  — this one grants account access, so it's short-lived on purpose.
- Resetting **invalidates every other active session at once** via a new
  `User.sessionVersion` counter, bumped on reset. Sessions in this app are
  stateless signed cookies with no server-side store to individually
  revoke, so bumping the version (and checking it in `getCurrentUser()`
  on every request) is what "log out everywhere" means here — this
  required embedding `sessionVersion` in the cookie payload itself
  (`src/lib/auth.ts`), so every existing call site that sets a session
  cookie needed updating to pass it.
- After a successful reset, the user is logged straight back in with a
  fresh, correctly-versioned cookie rather than being sent to the login
  page — one less step.

**Known minor quirk**: refreshing the `/verify-email?token=...` page
after a successful verification re-submits the already-cleared token and
shows "invalid," even though the account is in fact verified. Fixing this
cleanly would mean tracking used tokens separately rather than clearing
them on use — not worth a schema field for something this low-stakes.

## Rate limiting

`src/lib/rate-limit.ts` — a simple in-memory fixed-window counter per IP,
applied to every auth endpoint and both geocoding endpoints:

| Endpoint | Limit |
|---|---|
| Login | 10 / 15 min |
| Signup | 5 / hour |
| Forgot password | 5 / hour |
| Reset password | 10 / hour |
| Resend verification | 5 / hour |
| `/api/geocode` | 30 / min |
| `/api/geocode/suggest` | 60 / min (more lenient — fires on every debounced keystroke while typing, not once per submission) |

A rate-limited request gets a `429` with a `Retry-After` header; existing
frontend error handling already displays whatever message the API
returns, so no UI changes were needed for this to surface correctly.

**Known limitation, stated plainly**: this is an in-memory `Map`, local to
one server process. It resets on every restart and — more importantly —
**doesn't share state across multiple server instances**. That's a
correct, working defense for a single dev server or a small
single-instance deployment; it stops being real protection the moment
this app runs on more than one instance behind a load balancer, since
each instance would track its own counters independently. A real
multi-instance production deployment needs a shared store (Redis is the
standard choice) instead — flagged here rather than glossed over,
consistent with how other "good enough for now" infrastructure choices
in this app are documented (see the broadcast email queue, for instance).

## Restaurant profile photos & real icons

Two polish items from the homepage visual pass:

- **`lucide-react`** is now a dependency, used on the homepage (hero,
  cuisine chips, card placeholders) in place of emoji. Scoped to the
  homepage for now — the rest of the app (admin pages, restaurant
  dashboard, etc.) still uses emoji, worth extending the same treatment
  there later.
- **Restaurant owners can now upload their own profile/cover photo**
  (`/restaurant/location` → "Restaurant photo"), shown as the card header
  everywhere customers browse — homepage grid, eventually the restaurant
  page. This reuses the same Cloudinary setup already built for menu item
  photos (`src/lib/cloudinary.ts`), just a different crop (800×450 fill,
  since it's always shown as a wide banner, not a square thumbnail) and a
  dedicated upload route that also persists straight to
  `Restaurant.imageUrl` rather than just returning a URL for the caller to
  attach elsewhere. **Deliberately not a fake stock-photo URL** — a
  restaurant with no uploaded photo shows a quiet icon placeholder
  instead, not a random Unsplash image of unrelated food.

## Premium homepage redesign

See `UI_REDESIGN_REPORT.md` for the full writeup — a large visual pass
(hero, sticky nav, value props, real platform stats, restaurant grid,
app-preview section) plus, importantly, a table of everywhere the brief
asked for something this app can't honestly show yet (fabricated
stats/social proof, stock photography, App Store badges without a real
app, delivery-time estimates not tracked anywhere) and what was built
instead. Same "real data or omit it" rule this app has followed
everywhere else, applied to a marketing page instead of a feature.

## Footer

Global, added to the root layout (`src/app/components/footer.tsx`) — every
page now has one. Deliberately minimal compared to the Just Eat reference:

- **No social media icons** — Pre-Meal doesn't have real Facebook/Instagram/X
  accounts, so linking to them would either 404 or point at nothing. Fake
  presence is worse than no presence.
- **No "Download the app" section** — there's no native app. Just Eat's App
  Store/Google Play badges are trademarked assets tied to a real listing;
  using them without an actual app isn't a stretch of the truth, it's
  misuse of someone else's mark. In its place: a 3-item strip of real
  value props (scheduled not rushed, reviews tied to actual delivered
  orders, restaurants keep their full delivery fee) — same visual weight
  as the reference's app-download banner, but every claim is something
  this app actually does.
- **No "80,000+ places" / loyalty-stamps claims** — Pre-Meal doesn't have
  a loyalty program or that kind of scale; those would be fabricated
  numbers.
- **Terms of Service and Privacy Policy links go to real placeholder
  pages** (`/terms`, `/privacy`), not dead links — but each one opens
  with an amber banner stating plainly that it's not real legal copy and
  needs a lawyer before this app takes real orders. This makes the legal
  gap (already flagged earlier as a pre-launch item) visible on the site
  itself rather than just in this README.

## Delivery radius enforcement at checkout

Previously only checked at search/browse time — a customer could still
place an order to an address outside a restaurant's delivery radius by
typing it directly into checkout. `createOrder()` in `src/lib/capacity.ts`
now re-verifies: if the restaurant has a location and radius set, the
delivery address is geocoded and the distance checked before the order is
allowed. Deliberately outside the DB transaction — geocoding is a slow
external call, same reasoning as why the Stripe charge in `confirmOrder()`
happens outside its transaction too. A restaurant with no location set
has nothing to enforce against, so no check applies (matches how search
already treats that case). An address that fails to geocode is rejected
rather than let through — the whole point is guaranteeing deliverability,
so an address we can't verify shouldn't be trusted by default.

## Email retry queue

`EmailQueueItem` (new table) + `processEmailQueue()` in `src/lib/email.ts`.
`sendEmail()` still tries immediately first — the common case (Brevo is
up) never touches the database. Only on failure does it queue a retry,
picked up by the same worker sweep that already runs every other
background job in this app (`scripts/expire-orders-worker.ts`) — no new
queue infrastructure (Redis, SQS, etc.) introduced for this, since a
simple DB-backed retry table matches how every other scheduled job here
already works. Gives up after 5 attempts and marks the row `FAILED` for
manual follow-up (`EmailQueueItem.lastError`) rather than retrying forever.

## Rate limiting — Redis-backed, with a graceful fallback

`src/lib/rate-limit.ts` now uses Upstash Redis when configured
(`UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`), which is what
actually fixes the multi-instance problem flagged earlier — a shared
Redis-backed counter means every server instance sees the same rate
limit state. Falls back to the original in-memory `Map` when Redis isn't
configured, so local dev keeps working without any setup. Same
"primary service + graceful fallback" shape as the Mapbox/Nominatim
geocoding split. Chose Upstash specifically (REST-based, no persistent
TCP connection) since it's the standard pairing for a Vercel-style
serverless deployment, which is where this app is most likely headed —
a traditional Redis client (ioredis, etc.) would fight with serverless
function lifecycles. If Redis is configured but briefly unreachable, rate
limiting fails open to the in-memory check for that request rather than
blocking logins/signups platform-wide until Redis recovers.

## Legal pages — real draft content, still not real legal advice

`/terms` and `/privacy` went from a one-line "this is a placeholder" note
to an actual first-draft document — specific to what this app really does
(charge-on-confirm, the real cancellation policy, the real third parties
it sends data to: Stripe, Brevo, Cloudinary, Mapbox/Nominatim) rather
than generic boilerplate. The amber "not reviewed by a lawyer" banner is
still there, and if anything more important now — the more complete this
looks, the easier it'd be to mistake for finished, reviewed legal copy if
the disclaimer weren't prominent. Every genuinely legal judgment call
(liability limitations, governing law, data retention periods, how to
exercise data-subject rights) is left as an explicit bracketed
placeholder rather than guessed at — those need a real lawyer's input,
not a plausible-sounding draft.

## Next steps (in priority order)

1. Weekly meal-planning UI (multiple slots/restaurants in one checkout) —
   the one remaining item from the original "real functional gaps" list.
2. Legal pages are now a real first draft (see above) but still need
   actual lawyer review, real answers for every bracketed placeholder,
   and a business decision on data retention — before this app takes
   orders from real customers, not before its own launch checklist is
   otherwise done.
3. Optionally harden email verification from a soft nudge into a real
   requirement (e.g. gating checkout or restaurant approval) — deliberately
   left soft for now, see "Auth hardening" above.
4. See `UI_REDESIGN_REPORT.md`'s "Recommended future enhancements" for
   several smaller, genuinely optional items surfaced during the redesign
   pass (favorites, group ordering, an in-app notification center, a
   distinct restaurant logo field, `next/image` adoption beyond the
   homepage) — none blocking, all deliberately scoped out because they'd
   otherwise be UI with no real functionality behind it.
5. Production infrastructure — real hosting, managed Postgres, moving
   `npm run worker` to a real scheduled job (Vercel Cron or similar),
   error monitoring. None of this is code to write in this repo so much
   as decisions to make when actually deploying somewhere real.

