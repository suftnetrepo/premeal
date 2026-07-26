import { cookies } from "next/headers";
import { getListableRestaurants } from "@/lib/restaurant-listing";
import { getPopularDishNames, getPlatformStats } from "@/lib/homepage-stats";
import { MENU_TEMPLATES } from "@/lib/menu-templates";
import { HomepageLanding } from "./components/homepage-landing";
import { HomepageResults, type SearchParams } from "./components/homepage-results";

export const dynamic = "force-dynamic"; // always show live capacity, never cache

const LOCATION_COOKIE = "premeal_last_location";

function readRememberedLocation(rawCookie: string | undefined): { lat: number; lng: number; address: string } | null {
  if (!rawCookie) return null;
  try {
    const parsed = JSON.parse(rawCookie);
    if (
      typeof parsed.lat === "number" &&
      typeof parsed.lng === "number" &&
      typeof parsed.address === "string" &&
      !Number.isNaN(parsed.lat) &&
      !Number.isNaN(parsed.lng)
    ) {
      return parsed;
    }
  } catch {
    // Malformed/tampered cookie value — treat exactly like "no cookie at
    // all" rather than letting a bad value break the page.
  }
  return null;
}

export default async function HomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const { lat, lng, address, cuisine, sort, minRating, clear } = params;
  const urlLat = lat ? parseFloat(lat) : null;
  const urlLng = lng ? parseFloat(lng) : null;
  const hasUrlLocation = urlLat !== null && urlLng !== null && !Number.isNaN(urlLat) && !Number.isNaN(urlLng);

  // clear=1 means "the customer explicitly clicked Change" — that has to
  // win over the remembered cookie even though this request's URL has no
  // lat/lng either, or Change would just show the same remembered address
  // right back again. An explicit new search in the URL always wins over
  // the cookie too, for the same reason: whatever the customer just did
  // is more current than whatever was remembered from before.
  let effectiveLat = urlLat;
  let effectiveLng = urlLng;
  let effectiveAddress = address;

  if (!hasUrlLocation && clear !== "1") {
    const cookieStore = await cookies();
    const remembered = readRememberedLocation(cookieStore.get(LOCATION_COOKIE)?.value);
    if (remembered) {
      effectiveLat = remembered.lat;
      effectiveLng = remembered.lng;
      effectiveAddress = remembered.address;
    }
  }

  const isLocationSearch =
    effectiveLat !== null && effectiveLng !== null && !Number.isNaN(effectiveLat) && !Number.isNaN(effectiveLng);

  const [withDistance, platformStats] = await Promise.all([
    getListableRestaurants(isLocationSearch ? { lat: effectiveLat!, lng: effectiveLng! } : undefined),
    getPlatformStats(),
  ]);

  const hasAnyStats =
    platformStats.deliveredCount !== null ||
    platformStats.confirmRatePercent !== null ||
    platformStats.averageRating !== null;

  if (!isLocationSearch) {
    return (
      <main className="w-full">
        <HomepageLanding platformStats={platformStats} hasAnyStats={hasAnyStats} />
      </main>
    );
  }

  // The full range of cuisines this platform supports (from the
  // onboarding menu templates), not just ones a restaurant has actually
  // registered with — deliberately shown even with zero matching
  // restaurants right now, so a prospective customer sees what's
  // supported, not just what's currently live. Unioned with whatever
  // cuisine strings real restaurants actually have, in case one doesn't
  // exactly match a template (a custom cuisine typed at signup) — a real
  // restaurant's cuisine should never be hidden just because it isn't
  // one of the 7 template values.
  const availableCuisines: string[] = Array.from(
    new Set<string>([...MENU_TEMPLATES.map((t) => t.cuisine), ...withDistance.map((r) => r.cuisine as string)])
  ).sort();

  let filtered = cuisine ? withDistance.filter((r) => r.cuisine === cuisine) : withDistance;
  if (minRating === "4") {
    filtered = filtered.filter((r) => r.averageRating !== null && r.averageRating >= 4);
  }

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "price") return a.minOrderCents - b.minOrderCents;
    if (sort === "near") return (a.distanceKm ?? 0) - (b.distanceKm ?? 0);
    if (sort === "rating") return (b.averageRating ?? 0) - (a.averageRating ?? 0);
    return 0;
  });

  const popularDishesByRestaurant = new Map<string, string[]>();
  await Promise.all(
    sorted.map(async (r) => {
      popularDishesByRestaurant.set(r.id, await getPopularDishNames(r.id));
    })
  );

  // Everything downstream (the "Change" link, cuisine chips, sort links)
  // builds its own href from this params object — it has to carry the
  // effective lat/lng/address explicitly, whether they came from this
  // request's URL or from the remembered cookie, or clicking a filter
  // chip while browsing on a remembered location would silently lose
  // that location (since it was never actually in this request's URL to
  // begin with).
  const effectiveParams: SearchParams = {
    ...params,
    lat: effectiveLat !== null ? String(effectiveLat) : undefined,
    lng: effectiveLng !== null ? String(effectiveLng) : undefined,
    address: effectiveAddress,
  };

  return (
    <main className="w-full">
      <HomepageResults
        params={effectiveParams}
        address={effectiveAddress}
        cuisine={cuisine}
        sort={sort}
        minRating={minRating}
        availableCuisines={availableCuisines}
        sorted={sorted}
        popularDishesByRestaurant={popularDishesByRestaurant}
      />
    </main>
  );
}
