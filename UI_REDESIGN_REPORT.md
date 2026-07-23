# UI Redesign Report

## Summary

Full visual redesign of the homepage (hero, value props, stats, browse
grid, app preview) plus a global sticky nav and footer, following the
premium direction requested (Apple / Uber Eats / Airbnb / Linear / Stripe
influences: whitespace, large type, subtle shadows, rounded corners, soft
gradients). All existing business logic, routing, auth, and API calls are
unchanged — this was a presentational pass only, as instructed.

**Read this section before anything else below**: several items in the
original brief and reference mockup were not implemented as literally
specified, because doing so would have meant either fabricating data this
app doesn't have or reproducing trademarked assets without a real product
behind them. Each is called out individually further down, with what was
built instead and why. This wasn't a scope reduction for convenience —
every adaptation below follows the same "no fake data" discipline this
codebase has held everywhere else (the star-rating system, the promo
codes, the platform stats system, etc. all follow the identical rule: a
claim only renders if it's real).

## Components updated

- `src/app/page.tsx` — full rewrite: hero, value props, stats strip,
  category pills, sidebar filters, restaurant grid, app preview section.
- `src/app/components/nav.tsx` — visual polish, marketing links added for
  the logged-out state (How it works / For restaurants / About), all
  existing role-based dashboard links preserved exactly.
- `src/app/components/footer.tsx` — updated links (About, How it works),
  removed the now-redundant text-only "app coming soon" block since the
  homepage has a richer version of it.
- `next.config.ts` — added a `remotePatterns` entry for Cloudinary so
  `next/image` can serve restaurant photos.

## New reusable components

- `src/app/components/nav-shell.tsx` — client component isolating the
  sticky-positioning + scroll-triggered-shadow behavior. Split out from
  `nav.tsx` specifically so the data-fetching (current user, subscription
  status) can stay server-side; only the scroll listener needed to be a
  client component.
- `src/lib/homepage-stats.ts` — two functions, both designed around "only
  show it if it's real":
  - `getPopularDishNames(restaurantId)` — most-ordered items from actual
    completed order history (excludes anything pending/declined/expired).
    Returns an empty array for a restaurant with no order history yet; the
    homepage grid omits the "Popular dishes" row entirely in that case
    rather than showing arbitrary menu items mislabeled as popular.
  - `getPlatformStats()` — real delivered-order count, a real confirmation
    rate (confirmed-or-later ÷ orders that got any final answer), and a
    real average rating across all reviews. Each field is `null` if the
    underlying count is zero, and the homepage's stats section doesn't
    render at all if every field is null.
- `src/app/about/page.tsx` — minimal About page (no fabricated founding
  story, team photos, or funding claims), needed since the nav now links
  to one.
- `src/app/terms/page.tsx`, `src/app/privacy/page.tsx` — pre-existing from
  an earlier pass (added when the footer was first built), unchanged here,
  linked from the redesigned footer/nav.

## Deliberate deviations from the brief, and why

| Brief asked for | What was built instead | Why |
|---|---|---|
| Large food photography (pizza, sushi, bowl) in hero and cards | Temp placeholder via Lorem Picsum for the hero (`src/app/page.tsx`, seeded URL, clearly commented `TEMP`); icon-based placeholders remain on restaurant cards | No image generation or stock-photo licensing tool is available in this environment, so a real photo couldn't be sourced. Per explicit instruction, a genuine placeholder-image *service* (not a random hotlinked photo found via search) fills the hero temporarily — swap the one `src` value in `page.tsx` for a real licensed photo before launch, and remove the `picsum.photos` entry from `next.config.ts` at the same time. |
| "Trusted by 12,000+ scheduled diners" + customer avatar photos | Removed entirely | This app doesn't have 12,000 diners yet. Fabricated social proof (numbers or stock photos of strangers) isn't something this build does anywhere else, so it wasn't started here. |
| Stats: 12,000+ deliveries / 98% confirm rate / 4.9 rating | Same visual pattern, wired to `getPlatformStats()` — real numbers, or the section doesn't render | The *pattern* was worth keeping; the specific numbers weren't real. This is a strictly better outcome: the section will show true, growing numbers instead of a static fake one. |
| Per-card delivery fee variation ("£2.50", "£1.99") | One consistent real number (`DELIVERY_FEE_CENTS`, currently £3 flat) | This app charges a flat delivery fee platform-wide (see main README) — there's no per-restaurant variation to show. |
| Delivery-time estimate on cards ("30–45 min") | Omitted | Not tracked anywhere in the schema or order flow. |
| Favourite/heart icon on cards | Omitted | No favorites feature exists. A heart icon with no backing functionality is a dead control. |
| App Store / Google Play badge graphics | Plain text "iOS — coming soon" / "Android — coming soon" | Those specific logo+wordmark lockups are Apple/Google's trademarks tied to a real app listing. Reproducing them (even styled as disabled) is a trademark question, not a truthfulness one — it doesn't matter whether the buttons work. |
| Fourth phone mockup: "Live tracking" | Three screens only (Scheduling, Checkout, Confirmed) | No GPS/live-tracking feature exists. Depicting one would show a capability the product doesn't have. |
| Nav: "Reviews" as a standalone page | Not added | No dedicated reviews-showcase page exists yet; the "Real reviews only" value-prop card covers the concept honestly without promising a page that isn't there. |

## Responsive improvements

- Hero headline now uses the requested fluid scale
  (`text-[34px] sm:text-[42px] lg:text-[64px]`).
- Restaurant grid: 1 column mobile → 2 tablet → 3 desktop
  (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`).
- Value-prop cards: 1 → 2 → 4 columns across the same breakpoints.
- Sidebar filters stack above the grid below the `sm` breakpoint (existing
  pattern, kept).
- Category pill row and app-preview phone row both scroll horizontally on
  narrow viewports rather than wrapping awkwardly.

## Accessibility

- All interactive filter/sort controls remain real `<Link>` elements (no
  JS-only click handlers), so they work with keyboard navigation and
  don't require JS to be meaningfully present in the DOM.
- The 4+-rated toggle has an associated `<label htmlFor>` pointing at the
  control.
- Maintained existing semantic heading structure (`h1` in hero, no skipped
  levels).
- Color choices reuse the existing orange-on-white/stone palette already
  verified for contrast elsewhere in the app; no new low-contrast text
  colors were introduced.

## Performance

- `next/image` now used for restaurant card photos (lazy-loaded by
  default, responsive `sizes` attribute set), replacing a plain `<img>`
  tag. Required the `next.config.ts` change to allow Cloudinary's domain.
- Popular-dish lookups run in parallel (`Promise.all`) across the
  restaurant list rather than sequentially.
- No new client-side JavaScript bundle beyond `nav-shell.tsx`'s scroll
  listener (a few lines) — everything else on the homepage remains a
  Server Component. No Framer Motion added; all hover/transition
  animation is plain CSS (`transition-*`, `hover:*` Tailwind utilities),
  since Framer Motion wasn't already a dependency and CSS covers every
  animation actually requested (fade/lift on hover, card scale, nav
  shadow).

## Restaurant page redesign (follow-up pass)

Extended the same visual system to the individual restaurant page and its
order form — full-width hero banner (real uploaded photo or icon
placeholder), a working menu search, restyled category tabs, a two-column
layout with a **sticky "Your order" basket sidebar** replacing the old
single-column flow where checkout was buried at the bottom of a long page.

All business logic is untouched — same state, same validation, same API
calls (`POST /api/orders`, `POST /api/checkout/validate-promo`), same
modifier-selection rules. This was a structural/visual pass only.

**Adaptations from the reference (Just Eat restaurant page)**, same
no-fake-data rule as everywhere else:

| Reference had | Built instead | Why |
|---|---|---|
| Separate restaurant "logo" badge overlapping the hero photo | Just the one hero photo | This app has a single `imageUrl` field per restaurant, not a distinct logo asset — a real feature to consider building later, not something to fake now. |
| "Delivery Unavailable / Collection Unavailable" toggle | Nothing — delivery is the only option | This app has no pickup/collection feature. |
| Fee breakdown: delivery + service fee + small-order fee | Delivery fee + this restaurant's real minimum order only | No service fee or small-order fee exists in this app's pricing model — see `DELIVERY_FEE_CENTS` in `src/lib/capacity.ts`. |
| "Group order" button | Not added | No shared-cart/split-order feature exists. |
| Favourite (heart) icon | Not added | Consistent with the homepage decision — no favorites feature exists, so no dead control for it. |
| Info (i) icon opening more restaurant details | Address/description shown inline instead | Avoided building a whole modal system for information that fits in the existing header. |

## Restaurant owner shell redesign (icon sidebar + dashboard stats)

Restaurant owners now get an entirely different page shell from customers/
admins — an icon-only sidebar (vertical rail on desktop, becomes a fixed
bottom bar under the `sm` breakpoint, since an icon rail doesn't work well
on narrow screens) replacing the horizontal top nav, plus a slim top bar
showing the restaurant's name and live status. This is a role-based
branch in the root layout (`src/app/layout.tsx`), not a route-based one —
a restaurant owner gets this shell on every page they can reach; customers
and admins are unaffected and keep the standard Nav/Footer.

- `src/app/components/restaurant-shell.tsx` — server component, fetches
  the owner's restaurant for the top bar's name/live-status badge.
- `src/app/components/restaurant-sidebar-nav.tsx` — client component (needs
  `usePathname()` for active-route highlighting). Every icon has both a
  `title`/`aria-label` and a hover tooltip — icon-only navigation needs a
  real way to say what each icon means, not just pass a lint check.
- The dead restaurant-owner branch was removed from the shared `nav.tsx`
  entirely, since it can no longer render.

**Dashboard content additions**, adapting the reference mockup's profile
header + "Top Dish" idea with real data:
- A 3-stat row: real menu item count, real total order count, real
  average rating (or "No reviews yet" — never a placeholder number).
- **Top dishes leaderboard** (`src/lib/restaurant-dashboard-stats.ts`) —
  ranked by actual completed-order volume, with real times-ordered and
  revenue figures (via a raw SQL query for an accurate `SUM(price ×
  quantity)`, which Prisma's `groupBy` can't express directly). Revenue
  deliberately excludes paid modifier add-ons and says so in the UI — a
  real, slightly conservative number rather than a precise-looking but
  unverified one. Not the reference's "views/downloads" metrics, which
  don't mean anything for a restaurant.

**Extended to admins too**: `src/app/components/admin-shell.tsx` +
`admin-sidebar-nav.tsx` mirror the restaurant owner shell exactly — same
responsive rail↔bottom-bar pattern, same hover-tooltip approach, built
scrollable (`overflow-x-auto`) on mobile from the start this time rather
than hitting the same off-screen-icon bug the restaurant sidebar had
initially (see "Mobile fixes" below). `src/app/layout.tsx` now branches
three ways by role (`RESTAURANT_OWNER` → `RestaurantShell`, `ADMIN` →
`AdminShell`, everyone else → the standard `Nav`/`Footer`).

## Mobile fixes (found via real device screenshots, not guessed at)

- **Sidebar nav overflow**: 8 icons (7 nav items + logout) don't fit in a
  360–390px-wide bottom bar. The original version used `justify-around`
  with no scroll, silently clipping the last few icons off-screen —
  Dashboard and Payouts were simply unreachable on a phone. Fixed by
  making the bottom bar `overflow-x-auto` with `shrink-0` on every item,
  so every icon is reachable by swiping. Applied to both the restaurant
  and admin sidebars.
- **Menu item row collision**: `src/app/restaurant/menu/page.tsx`'s item
  row forced image + name + category dropdown + 4 buttons into one
  unbreakable horizontal line. On a narrow screen this overflowed and
  visually collided (the category `<select>` rendering over the item
  name). Fixed by stacking on mobile (image+details on top, category
  dropdown + action buttons wrapping into their own row below) and only
  merging back into a single row at the `sm` breakpoint.

## Final polish pass — all remaining restaurant/admin sub-pages

Extended the same design system to everywhere it hadn't reached yet:
`/restaurant/menu`, `/deliveries`, `/location`, `/payouts`, `/orders`,
`/reviews`, and `/admin/restaurants`, `/disputes`, `/promotions`,
`/broadcast`, `/feature-flags` (plus their sub-components: category
manager, add-ons editor, profile image upload, dashboard client, signup
fee button).

- **Color palette**: every remaining `gray-*` Tailwind class swapped for
  the `stone-*` palette used everywhere else, including the "active
  tab/filter" dark-pill pattern (`bg-gray-900` → `bg-stone-900`) and
  disabled-button states.
- **Wider containers**: `max-w-2xl` → `max-w-4xl` across all eleven pages,
  matching how much room the sidebar shells actually provide.
- **Rounded corners**: `rounded-lg` → `rounded-xl` throughout for
  consistency with the rest of the redesign.
- **Header icons**: every page title now has a matching icon in a soft
  orange circle, using the exact same icon as that page's sidebar entry
  (e.g. Menu's header icon is the same `UtensilsCrossed` used in the
  sidebar) — same bolder `text-3xl font-black tracking-tight` treatment
  as every other page title in this redesign.

This was a mechanical, purely visual pass — no business logic, API calls,
or component behavior were touched. Done via a scripted find/replace
across the eleven files (verified with a full lint + typecheck pass
afterward, and spot-checked a few files by hand for correct JSX
structure) rather than rewriting each page individually, since the
change itself was the same pattern applied eleven times.

## Recommended future enhancements

- Extend `next/image` adoption beyond the homepage (menu item photos,
  restaurant profile page) for consistency.
- If/when a real native app ships, swap the plain-text "coming soon"
  pills for actual App Store/Google Play badge components linking to real
  listings.
- If the business wants delivery-time estimates or per-restaurant delivery
  fees as real features (not just visual polish), that's a genuine product
  change — worth scoping as its own feature with real data behind it, not
  backfilled into this redesign.
- A dedicated reviews-showcase page, if there's a reason to build one
  beyond what already shows on each restaurant's own page.
- The stats strip will look sparse until there's real order/review volume
  — that's expected and correct, not a bug to fix by padding the numbers.
- A distinct restaurant "logo" field, separate from the cover photo, if
  that distinction matters to how restaurants want to present themselves.
- A favorites feature and/or group ordering, if either is worth building
  as real functionality — both were left out of the restaurant page
  redesign specifically because they'd otherwise be UI with nothing behind
  it.
- An in-app notification center (new order, dispute opened, payout sent)
  — real events already exist and trigger emails (see the transactional
  emails section above), but there's no in-app equivalent. The reference
  mockup's notification bell was left out for this reason; worth building
  for real if wanted, not as a decorative icon.