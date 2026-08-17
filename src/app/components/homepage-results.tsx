import Link from "next/link";
import Image from "next/image";
import { MapPin, UtensilsCrossed, Fish, Pizza, Soup, Salad, Beef, type LucideIcon } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { kmToMiles } from "@/lib/geo";
import { AddressSearch } from "./address-search";
import { StarDisplay } from "./stars";
import { HygieneBadge } from "./hygiene-badge";
import type { RestaurantListItem } from "@/lib/restaurant-listing";

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

export type SearchParams = {
  lat?: string;
  lng?: string;
  address?: string;
  cuisine?: string;
  sort?: string;
  minRating?: string;
  // Set only by the "Change" link below — distinguishes "the customer
  // explicitly asked to search somewhere else" from "there's just no lat/
  // lng in this particular URL," which on its own would otherwise fall
  // back to the remembered cookie location and show the same address
  // right back again, defeating the point of clicking Change at all.
  clear?: string;
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

export function HomepageResults({
  params,
  address,
  cuisine,
  sort,
  minRating,
  availableCuisines,
  sorted,
  popularDishesByRestaurant,
}: {
  params: SearchParams;
  address?: string;
  cuisine?: string;
  sort?: string;
  minRating?: string;
  availableCuisines: string[];
  sorted: RestaurantListItem[];
  popularDishesByRestaurant: Map<string, string[]>;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-sm">
          <MapPin size={16} className="text-orange-600" strokeWidth={2} />
          <span className="text-stone-700 font-medium">{address}</span>
        </div>
        <Link
          href={buildQuery(params, { lat: undefined, lng: undefined, address: undefined, clear: "1" })}
          className="text-xs text-orange-600 font-medium"
        >
          Change
        </Link>
      </div>

      <div className="mb-8 bg-white rounded-2xl border border-stone-200 p-3 shadow-sm">
        <AddressSearch currentAddress={address} />
      </div>

      <p className="text-xl font-bold text-stone-900 mb-4">Find your favourite</p>

      {/* Category pills, not circles — real cuisines only */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-6">
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
                { key: "near", label: "Nearest" },
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

        {/* Restaurant grid — 3 columns desktop. Real data only: flat
            delivery fee (not fabricated per-card variation), real ratings
            (or "New" — never a placeholder number), and a "Popular
            dishes" row that only appears when there's genuine order
            history to back it. */}
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
                    {r.cuisine} · {formatMoney(r.deliveryFeeCents)} delivery · {formatMoney(r.minOrderCents)} min
                    {r.distanceKm !== null && r.distanceKm !== undefined && ` · ${kmToMiles(r.distanceKm).toFixed(1)} mi`}
                  </p>
                  {/* Same shared component and same VERIFIED-only rule as
                      the detail page — a card never shows a claimed-but-
                      unverified level either. */}
                  <div className="mt-1.5 empty:mt-0">
                    <HygieneBadge status={r.hygieneCertificateStatus} level={r.hygieneCertificateLevel} size="sm" />
                  </div>
                  {popularDishes.length > 0 && (
                    <p className="text-xs text-stone-400 mt-2 truncate">
                      Popular: {popularDishes.join(" · ")}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
          {sorted.length === 0 && cuisine && (
            <p className="text-stone-500 text-sm sm:col-span-2 lg:col-span-3">
              No {cuisine} restaurants deliver to that address yet — try{" "}
              <Link href={buildQuery(params, { cuisine: undefined })} className="text-orange-600">
                browsing all cuisines
              </Link>{" "}
              instead.
            </p>
          )}
          {sorted.length === 0 && !cuisine && (
            <p className="text-stone-500 text-sm sm:col-span-2 lg:col-span-3">
              No restaurants currently deliver to that address. Try a different one, or{" "}
              <Link href="/" className="text-orange-600">search again</Link>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
