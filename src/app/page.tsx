import Link from "next/link";
import Image from "next/image";
import { formatMoney } from "@/lib/format";
import { kmToMiles } from "@/lib/geo";
import { getListableRestaurants } from "@/lib/restaurant-listing";
import { getPopularDishNames, getPlatformStats } from "@/lib/homepage-stats";
import { DELIVERY_FEE_CENTS } from "@/lib/capacity";
import { AddressSearch } from "./components/address-search";
import { StarDisplay } from "./components/stars";
import {
  MapPin,
  UtensilsCrossed,
  CheckCircle2,
  CalendarClock,
  Fish,
  Pizza,
  Soup,
  Salad,
  Beef,
  ShieldCheck,
  Wallet,
  Smartphone,
  Star,
  type LucideIcon,
} from "lucide-react";

export const dynamic = "force-dynamic"; // always show live capacity, never cache

const CUISINE_ICONS: Record<string, LucideIcon> = {
  Japanese: Fish,
  Italian: Pizza,
  Indian: Soup,
  Healthy: Salad,
  American: Beef,
  "West African": Soup,
  Ethiopian: Soup,
};

function CuisineIcon({ cuisine, size = 22 }: { cuisine: string; size?: number }) {
  const Icon = CUISINE_ICONS[cuisine] ?? UtensilsCrossed;
  return <Icon size={size} strokeWidth={1.75} />;
}

type SearchParams = {
  lat?: string;
  lng?: string;
  address?: string;
  cuisine?: string;
  sort?: string;
  minRating?: string;
};

function buildQuery(params: SearchParams, overrides: Partial<SearchParams>): string {
  const merged = { ...params, ...overrides };
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) qs.set(key, value);
  }
  const s = qs.toString();
  return s ? `/?${s}` : "/";
}

export default async function HomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const { lat, lng, address, cuisine, sort, minRating } = params;
  const searchLat = lat ? parseFloat(lat) : null;
  const searchLng = lng ? parseFloat(lng) : null;
  const isLocationSearch =
    searchLat !== null && searchLng !== null && !Number.isNaN(searchLat) && !Number.isNaN(searchLng);

  const [withDistance, platformStats] = await Promise.all([
    getListableRestaurants(isLocationSearch ? { lat: searchLat!, lng: searchLng! } : undefined),
    getPlatformStats(),
  ]);

  const availableCuisines: string[] = Array.from(
    new Set<string>(withDistance.map((r) => r.cuisine as string))
  ).sort();

  let filtered = cuisine ? withDistance.filter((r) => r.cuisine === cuisine) : withDistance;
  if (minRating === "4") {
    filtered = filtered.filter((r) => r.averageRating !== null && r.averageRating >= 4);
  }

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "price") return a.minOrderCents - b.minOrderCents;
    if (sort === "near" && isLocationSearch) return (a.distanceKm ?? 0) - (b.distanceKm ?? 0);
    if (sort === "rating") return (b.averageRating ?? 0) - (a.averageRating ?? 0);
    return 0;
  });

  // Popular dishes come from real order history — a restaurant with no
  // completed orders yet just won't show this row, rather than the app
  // relabeling arbitrary menu items as "popular."
  const popularDishesByRestaurant = new Map<string, string[]>();
  await Promise.all(
    sorted.map(async (r) => {
      popularDishesByRestaurant.set(r.id, await getPopularDishNames(r.id));
    })
  );

  const hasAnyStats =
    platformStats.deliveredCount !== null ||
    platformStats.confirmRatePercent !== null ||
    platformStats.averageRating !== null;

  return (
    <main className="w-full">
      {/* -----------------------------------------------------------------
          Hero. No stock/generated food photography — this environment has
          no image licensing or generation tool available. Per the user's
          explicit instruction, using Lorem Picsum (a placeholder-image
          service built specifically for "temp until the real asset is
          ready" use, not a random hotlinked photo) as a clearly-marked
          stand-in — swap PLACEHOLDER_HERO_IMAGE_URL below for a real
          licensed photo before launch. The "blurred depth" and "floating
          card" ideas from the brief are layered on top of it.
      ----------------------------------------------------------------- */}
      {!isLocationSearch && (
        <section className="bg-gradient-to-b from-orange-50/60 to-white border-b border-stone-100">
          <div className="mx-auto max-w-7xl grid md:grid-cols-2 gap-10 md:gap-8 px-4 py-10 md:py-14">
            <div className="flex flex-col justify-center">
              <p className="text-xs font-semibold tracking-widest text-orange-600 mb-4">
                SCHEDULE AHEAD · EAT ON TIME
              </p>
              <h1 className="text-[34px] sm:text-[42px] lg:text-[64px] font-black tracking-tight text-stone-900 leading-[1.05] mb-5">
                Fresh food.
                <br />
                Delivered exactly
                <br />
                <span className="text-orange-600">when you want it.</span>
              </h1>
              <p className="text-lg text-stone-600 mb-8 max-w-md">
                Pick a restaurant, choose your delivery day and time, and we&apos;ll confirm within
                30 minutes.
              </p>
              <div className="bg-white rounded-2xl border border-stone-200 p-3 shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
                <AddressSearch currentAddress={address} />
              </div>
            </div>

            <div className="relative flex items-center justify-center min-h-[360px] rounded-3xl overflow-hidden">
              {/* TEMP — replace with a real licensed food/restaurant photo
                  before launch. Lorem Picsum, seeded for a stable image
                  across reloads rather than a random one every render. */}
              <Image
                src="https://picsum.photos/seed/premeal-hero/1200/1000"
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
                priority
              />
              {/* Fades the image's left edge into the section's cream
                  background instead of a hard rectangular seam against the
                  text column. Constrained to a narrow strip (not the full
                  width) so it doesn't wash out the whole photo. */}
              <div className="absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-orange-50 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-black/0 to-black/0" />

              <div className="relative bg-white/90 backdrop-blur rounded-2xl shadow-xl p-6 w-72 -rotate-3 border border-white">
                <p className="text-[10px] font-semibold tracking-widest text-stone-400 mb-2">
                  YOUR DELIVERY SLOT
                </p>
                <p className="text-xl font-bold text-stone-900 leading-tight">Fri 18:00–19:00</p>
                <p className="text-sm text-stone-500 mt-0.5">Sakura Sushi</p>
                <div className="border-t border-dashed border-stone-200 my-4" />
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-green-600" strokeWidth={2} />
                  <p className="text-sm font-medium text-green-700">Confirmed in 12 min</p>
                </div>
              </div>
            </div>
          </div>

          {/* Value props — real claims only. "On time, always" softened to
              what this app actually guarantees (a fast confirmation
              decision), not a delivery-time promise nothing here tracks.
              Icon-left layout, matching the footer's value-prop row. */}
          <div id="how-it-works" className="mx-auto max-w-7xl px-4 pb-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: CalendarClock, title: "Schedule, not rush", body: "Book your delivery slot days ahead." },
              { icon: ShieldCheck, title: "Real reviews only", body: "Reviews come from orders actually delivered." },
              { icon: CheckCircle2, title: "Confirmed fast", body: "Restaurants respond within 30 minutes." },
              { icon: Wallet, title: "Fair & transparent", body: "You pay exactly what the restaurant charges." },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-white rounded-2xl border border-stone-200 p-5 flex items-start gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                  <item.icon size={18} strokeWidth={1.75} />
                </div>
                <div>
                  <p className="font-semibold text-stone-900 text-sm mb-0.5">{item.title}</p>
                  <p className="text-sm text-stone-500">{item.body}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Real numbers only — each stat is computed live and simply
              omitted if the underlying count is zero, rather than showing
              a fabricated "12,000+" this app hasn't earned yet. */}
          {hasAnyStats && (
            <div className="border-t border-stone-100 bg-white">
              <div className="mx-auto max-w-7xl px-4 py-8 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
                {platformStats.deliveredCount !== null && (
                  <div>
                    <p className="text-3xl font-black text-stone-900">{platformStats.deliveredCount}+</p>
                    <p className="text-sm text-stone-500 mt-1">Scheduled deliveries</p>
                  </div>
                )}
                {platformStats.confirmRatePercent !== null && (
                  <div>
                    <p className="text-3xl font-black text-stone-900">{platformStats.confirmRatePercent}%</p>
                    <p className="text-sm text-stone-500 mt-1">Restaurants confirm within 30 minutes</p>
                  </div>
                )}
                {platformStats.averageRating !== null && (
                  <div>
                    <p className="text-3xl font-black text-stone-900 flex items-center justify-center gap-1.5">
                      {platformStats.averageRating.toFixed(1)}
                      <Star size={22} className="text-amber-500 fill-amber-500" />
                    </p>
                    <p className="text-sm text-stone-500 mt-1">Average customer rating</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* -----------------------------------------------------------------
          Browse
      ----------------------------------------------------------------- */}
      <div className="mx-auto max-w-7xl px-4 py-8">
        {isLocationSearch && (
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-sm">
              <MapPin size={16} className="text-orange-600" strokeWidth={2} />
              <span className="text-stone-700 font-medium">{address}</span>
            </div>
            <Link
              href={buildQuery(params, { lat: undefined, lng: undefined, address: undefined })}
              className="text-xs text-orange-600 font-medium"
            >
              Change
            </Link>
          </div>
        )}

        {isLocationSearch && (
          <div className="mb-8 bg-white rounded-2xl border border-stone-200 p-3 shadow-sm">
            <AddressSearch currentAddress={address} />
          </div>
        )}

        <p className="text-xl font-bold text-stone-900 mb-4">Find your favourite</p>

        {/* Category pills, not circles — real cuisines only */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
          <Link
            href={buildQuery(params, { cuisine: undefined })}
            className={`shrink-0 flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium border transition-colors ${
              !cuisine ? "bg-orange-600 text-white border-orange-600" : "bg-white text-stone-600 border-stone-200 hover:border-stone-300"
            }`}
          >
            <UtensilsCrossed size={16} strokeWidth={1.75} /> All
          </Link>
          {availableCuisines.map((c) => (
            <Link
              key={c}
              href={buildQuery(params, { cuisine: cuisine === c ? undefined : c })}
              className={`shrink-0 flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium border transition-colors ${
                cuisine === c ? "bg-orange-600 text-white border-orange-600" : "bg-white text-stone-600 border-stone-200 hover:border-stone-300"
              }`}
            >
              <CuisineIcon cuisine={c} size={16} /> {c}
            </Link>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-8">
          {/* Sidebar — real filters only. The brief's "delivery fee" and
              "delivery time" filters are skipped: delivery fee is a flat
              rate across the whole app (not something to filter by yet),
              and delivery-time estimates aren't tracked anywhere. An "Open
              now" toggle is skipped too — every restaurant shown here
              already has open delivery slots, so it would filter nothing. */}
          <aside className="sm:w-52 shrink-0">
            <div className="bg-white rounded-2xl border border-stone-200 p-4">
              <p className="font-semibold text-stone-900 mb-4">{sorted.length} places</p>

              <div className="flex items-center justify-between mb-4 pb-4 border-b border-stone-100">
                <label htmlFor="rating-toggle" className="text-sm text-stone-700">
                  4+ rated
                </label>
                <Link
                  id="rating-toggle"
                  href={buildQuery(params, { minRating: minRating === "4" ? undefined : "4" })}
                  className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors ${
                    minRating === "4" ? "bg-orange-600 justify-end" : "bg-stone-200 justify-start"
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white block shadow-sm" />
                </Link>
              </div>

              <p className="text-xs font-semibold text-stone-400 tracking-wide mb-2">SORT BY</p>
              <div className="flex flex-col gap-1">
                {[
                  { key: undefined, label: "Best match" },
                  ...(isLocationSearch ? [{ key: "near", label: "Nearest" }] : []),
                  { key: "price", label: "Min order: low to high" },
                  { key: "rating", label: "Highest rated" },
                ].map((opt) => (
                  <Link
                    key={opt.label}
                    href={buildQuery(params, { sort: opt.key })}
                    className={`text-sm text-left px-3 py-2 rounded-xl transition-colors ${
                      (sort ?? undefined) === opt.key ? "bg-orange-50 text-orange-700 font-medium" : "text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    {opt.label}
                  </Link>
                ))}
              </div>
            </div>
          </aside>

          {/* Restaurant grid — 3 columns desktop, matching the brief. Real
              data only: flat delivery fee (not fabricated per-card
              variation), real ratings (or "New" — never a placeholder
              number), and a "Popular dishes" row that only appears when
              there's genuine order history to back it. */}
          <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {sorted.map((r) => {
              const popularDishes = popularDishesByRestaurant.get(r.id) ?? [];
              return (
                <Link
                  key={r.id}
                  href={`/restaurants/${r.id}`}
                  className="group bg-white border border-stone-200 rounded-2xl overflow-hidden hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
                >
                  <div className="relative w-full h-36 bg-orange-50">
                    {r.imageUrl ? (
                      <Image src={r.imageUrl} alt={r.name} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-orange-300">
                        <CuisineIcon cuisine={r.cuisine} size={36} />
                      </div>
                    )}
                    <span className="absolute top-3 left-3 text-xs font-medium bg-white/95 backdrop-blur text-green-700 rounded-full px-2.5 py-1">
                      Open
                    </span>
                  </div>
                  <div className="p-4">
                    <p className="font-semibold text-stone-900 truncate">{r.name}</p>
                    {r.averageRating !== null ? (
                      <div className="flex items-center gap-1 mt-1">
                        <StarDisplay rating={r.averageRating} />
                        <span className="text-xs text-stone-500">
                          {r.averageRating.toFixed(1)} ({r.reviewCount})
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-stone-400 mt-1">New</p>
                    )}
                    <p className="text-sm text-stone-500 mt-1.5">
                      {r.cuisine} · {formatMoney(DELIVERY_FEE_CENTS)} delivery · {formatMoney(r.minOrderCents)} min
                      {r.distanceKm !== null && ` · ${kmToMiles(r.distanceKm).toFixed(1)} mi`}
                    </p>
                    {popularDishes.length > 0 && (
                      <p className="text-xs text-stone-400 mt-2 truncate">
                        Popular: {popularDishes.join(" · ")}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
            {sorted.length === 0 && isLocationSearch && (
              <p className="text-stone-500 text-sm sm:col-span-2 lg:col-span-3">
                No restaurants currently deliver to that address. Try a different one, or{" "}
                <Link href="/" className="text-orange-600">browse everything</Link>.
              </p>
            )}
            {sorted.length === 0 && !isLocationSearch && withDistance.length === 0 && (
              <p className="text-stone-500 text-sm sm:col-span-2 lg:col-span-3">
                No restaurants yet — run <code className="bg-stone-100 px-1 rounded">npm run seed</code>{" "}
                to add demo data.
              </p>
            )}
            {sorted.length === 0 && !isLocationSearch && withDistance.length > 0 && (
              <p className="text-stone-500 text-sm sm:col-span-2 lg:col-span-3">
                No restaurants match that filter. <Link href="/" className="text-orange-600">Clear filters</Link>.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* -----------------------------------------------------------------
          App preview — three real screens (scheduling, checkout,
          confirmation), built from this app's own UI language rather than
          photographed device mockups. No "live tracking" screen: there's
          no GPS/live-tracking feature built. No App Store/Google Play
          badge graphics: those specific logo+wordmark lockups are
          trademarked assets tied to a real app listing, which doesn't
          exist yet — plain text says the same thing honestly.
      ----------------------------------------------------------------- */}
      {!isLocationSearch && (
        <section className="bg-stone-50 border-t border-stone-100">
          <div className="mx-auto max-w-7xl px-4 py-10 grid md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="w-12 h-12 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center mb-4">
                <Smartphone size={22} strokeWidth={1.75} />
              </div>
              <p className="text-2xl font-black text-stone-900 mb-2">The app is on its way</p>
              <p className="text-stone-600 mb-6 max-w-sm">
                Native iOS and Android apps are planned before launch — for now, order from your
                browser exactly the same way.
              </p>
              <div className="flex gap-2">
                <span className="text-xs text-stone-400 border border-stone-200 rounded-lg px-3 py-2 cursor-not-allowed bg-white">
                  iOS — coming soon
                </span>
                <span className="text-xs text-stone-400 border border-stone-200 rounded-lg px-3 py-2 cursor-not-allowed bg-white">
                  Android — coming soon
                </span>
              </div>
            </div>

            <div className="flex gap-4 justify-center overflow-x-auto py-2">
              {[
                { label: "Scheduling", content: "slot" },
                { label: "Checkout", content: "checkout" },
                { label: "Confirmed", content: "confirmed" },
              ].map((screen) => (
                <div key={screen.label} className="shrink-0 w-32 rounded-2xl border-4 border-stone-900 bg-white overflow-hidden shadow-lg">
                  <div className="h-4 bg-stone-900 flex items-center justify-center">
                    <div className="w-8 h-1.5 rounded-full bg-stone-700" />
                  </div>
                  <div className="p-2.5 h-48 flex flex-col">
                    {screen.content === "slot" && (
                      <>
                        <p className="text-[9px] font-semibold text-stone-400 mb-1.5">SELECT A TIME</p>
                        <div className="grid grid-cols-3 gap-1 mb-2">
                          {["16", "17", "18"].map((h) => (
                            <div key={h} className={`text-[8px] text-center rounded py-1 ${h === "18" ? "bg-orange-600 text-white" : "bg-stone-100 text-stone-500"}`}>
                              {h}:00
                            </div>
                          ))}
                        </div>
                        <div className="mt-auto bg-orange-600 rounded text-white text-[8px] text-center py-1.5">Continue</div>
                      </>
                    )}
                    {screen.content === "checkout" && (
                      <>
                        <p className="text-[9px] font-semibold text-stone-400 mb-1.5">YOUR ORDER</p>
                        <div className="flex flex-col gap-1 mb-2">
                          <div className="h-1.5 bg-stone-100 rounded w-full" />
                          <div className="h-1.5 bg-stone-100 rounded w-4/5" />
                          <div className="h-1.5 bg-stone-100 rounded w-3/5" />
                        </div>
                        <div className="mt-auto bg-orange-600 rounded text-white text-[8px] text-center py-1.5">Place order</div>
                      </>
                    )}
                    {screen.content === "confirmed" && (
                      <div className="flex-1 flex flex-col items-center justify-center gap-1.5">
                        <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center">
                          <CheckCircle2 size={14} className="text-green-600" />
                        </div>
                        <p className="text-[8px] font-semibold text-stone-700 text-center">Order confirmed</p>
                      </div>
                    )}
                  </div>
                  <p className="text-[9px] text-center text-stone-400 pb-2">{screen.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
