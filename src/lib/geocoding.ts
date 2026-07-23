export type GeocodeResult = { latitude: number; longitude: number; formattedAddress: string };

export class GeocodingNotConfiguredError extends Error {
  constructor() {
    super(
      "Geocoding failed and no fallback is available. Add MAPBOX_TOKEN to your .env — get a free token at https://account.mapbox.com/access-tokens/"
    );
    this.name = "GeocodingNotConfiguredError";
  }
}

/**
 * Geocode a free-text address to coordinates.
 *
 * Uses Mapbox if MAPBOX_TOKEN is set. Otherwise falls back to Nominatim
 * (OpenStreetMap's public geocoder), which needs no signup or card — good
 * for unblocking local development.
 *
 * IMPORTANT — Nominatim's usage policy (https://operations.osmfoundation.org/policies/nominatim/)
 * explicitly asks that this fallback NOT be what a real product runs on:
 * it's rate-limited to 1 request/second on shared infrastructure donated
 * by volunteers, and isn't meant to be built into a shipped app as a
 * generic geocoding backend. Treat this as a dev-only stand-in. Before
 * real users hit this, switch to a paid provider (Mapbox + a card, Google,
 * or similar) by setting MAPBOX_TOKEN.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  if (process.env.MAPBOX_TOKEN) {
    return geocodeViaMapbox(address, process.env.MAPBOX_TOKEN);
  }
  console.warn(
    "[geocoding] MAPBOX_TOKEN not set — falling back to Nominatim (OpenStreetMap). " +
      "This is fine for local development but not for production traffic — see the comment in src/lib/geocoding.ts."
  );
  return geocodeViaNominatim(address);
}

async function geocodeViaMapbox(address: string, token: string): Promise<GeocodeResult | null> {
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json`
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("limit", "1");
  // This app is UK-only (every restaurant, every example address
  // throughout this build). Without this, an ambiguous or partial query
  // can resolve to a same-named place anywhere in the world — revisit
  // this hardcoded restriction if the business ever expands beyond the UK.
  url.searchParams.set("country", "gb");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Mapbox geocoding request failed (${res.status})`);
  }

  const data = await res.json();
  const feature = data.features?.[0];
  if (!feature) return null;

  const [longitude, latitude] = feature.center as [number, number];
  return { latitude, longitude, formattedAddress: feature.place_name as string };
}

// Simple in-process throttle so we never exceed Nominatim's 1 req/sec limit
// even under concurrent requests within this server process. Doesn't help
// across multiple server instances — fine for local dev, not a production
// guarantee, which is exactly why this whole path is dev-only.
let lastNominatimCallAt = 0;
async function throttleForNominatim() {
  const elapsed = Date.now() - lastNominatimCallAt;
  const minGapMs = 1100;
  if (elapsed < minGapMs) {
    await new Promise((resolve) => setTimeout(resolve, minGapMs - elapsed));
  }
  lastNominatimCallAt = Date.now();
}

async function geocodeViaNominatim(address: string): Promise<GeocodeResult | null> {
  await throttleForNominatim();

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", address);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "gb"); // UK-only, same reasoning as the Mapbox path

  const res = await fetch(url.toString(), {
    headers: {
      // Nominatim's usage policy requires a real identifying User-Agent —
      // update the contact detail if you keep using this in development.
      "User-Agent": "PreMeal-App-LocalDev/1.0 (dev-only, no production traffic)",
    },
  });
  if (!res.ok) {
    throw new Error(`Nominatim geocoding request failed (${res.status})`);
  }

  const data = await res.json();
  const result = data?.[0];
  if (!result) return null;

  return {
    latitude: parseFloat(result.lat),
    longitude: parseFloat(result.lon),
    formattedAddress: result.display_name as string,
  };
}

/**
 * Multiple lightweight suggestions for autocomplete-as-you-type, as
 * opposed to geocodeAddress()'s single best match for a submitted address.
 *
 * Mapbox gives a genuinely good autocomplete experience (partial-word
 * matching, fast). Nominatim technically works here too, but its 1
 * req/sec limit (see throttleForNominatim above) means every keystroke
 * queues up — usable for testing, noticeably laggy for real typing. Set
 * MAPBOX_TOKEN for this to feel good.
 */
export async function suggestAddresses(query: string): Promise<GeocodeResult[]> {
  if (query.trim().length < 3) return [];

  if (process.env.MAPBOX_TOKEN) {
    return suggestViaMapbox(query, process.env.MAPBOX_TOKEN);
  }
  return suggestViaNominatim(query);
}

async function suggestViaMapbox(query: string, token: string): Promise<GeocodeResult[]> {
  const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("autocomplete", "true");
  url.searchParams.set("limit", "5");
  // UK-only, same reasoning as geocodeViaMapbox above — without this, a
  // UK postcode fragment like "pe2 5sp" can coincidentally match a street
  // named similarly somewhere else in the world (this genuinely happened:
  // it matched a street in Spain).
  url.searchParams.set("country", "gb");
  // Both types, not just "address" — a bare postcode ("PE2 5SP") is a
  // real, precise, deliverable location on its own, but Mapbox classifies
  // it separately from numbered street addresses. Restricting to
  // "address" alone was accidentally excluding valid postcode-only
  // searches, not just the county/city-level results it was meant to
  // exclude.
  url.searchParams.set("types", "address,postcode");

  const res = await fetch(url.toString());
  if (!res.ok) return [];

  const data = await res.json();
  const features = (data.features ?? []) as { center: [number, number]; place_name: string }[];
  return features.map((f) => ({
    latitude: f.center[1],
    longitude: f.center[0],
    formattedAddress: f.place_name,
  }));
}

async function suggestViaNominatim(query: string): Promise<GeocodeResult[]> {
  await throttleForNominatim();

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "8"); // fetch extra since street-level filtering below discards some
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "gb"); // UK-only, same reasoning as the Mapbox path

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "PreMeal-App-LocalDev/1.0 (dev-only, no production traffic)" },
  });
  if (!res.ok) return [];

  const data = await res.json();
  const results = (data ?? []) as {
    lat: string;
    lon: string;
    display_name: string;
    address?: { road?: string };
  }[];

  // Nominatim has no equivalent to Mapbox's `types=address` filter, so
  // this does it after the fact: only keep results that resolved to an
  // actual street (`address.road` present) — otherwise a query like
  // "Derbyshire" returns the whole county as a selectable "address," which
  // geocodes to some arbitrary point nowhere near where the customer
  // actually lives.
  return results
    .filter((r) => Boolean(r.address?.road))
    .slice(0, 5)
    .map((r) => ({
      latitude: parseFloat(r.lat),
      longitude: parseFloat(r.lon),
      formattedAddress: r.display_name,
    }));
}
