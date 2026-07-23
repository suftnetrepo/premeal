import { prisma } from "@/lib/db";
import { distanceKm } from "@/lib/geo";

async function queryRestaurants(hasLocation: boolean) {
  return prisma.restaurant.findMany({
    where: {
      isActive: true,
      approvalStatus: "APPROVED",
      signupFeePaidAt: { not: null },
      menuItems: { some: { isAvailable: true } },
      deliverySlots: {
        some: {
          date: { gte: new Date(new Date().toDateString()) },
          cutoffAt: { gt: new Date() },
        },
      },
      ...(hasLocation
        ? { latitude: { not: null }, longitude: { not: null }, deliveryRadiusKm: { not: null } }
        : {}),
    },
    include: { menuItems: { where: { isAvailable: true }, take: 3 } },
    orderBy: { createdAt: "asc" },
  });
}

export type RestaurantListItem = Awaited<ReturnType<typeof queryRestaurants>>[number] & {
  distanceKm: number | null;
};

/**
 * The single source of truth for "which restaurants can a customer
 * actually order from right now" — approved, signup fee paid, has
 * available menu items, has an open delivery slot. Used by both the web
 * homepage (src/app/page.tsx) and the /api/restaurants endpoint the
 * mobile app calls; previously the API route had its own simpler,
 * out-of-date copy of this logic that would have shown mobile users
 * restaurants they couldn't actually order from (not yet approved, no
 * open slots, etc.) — this is what prevents that drift from happening
 * again next time either caller changes.
 */
export async function getListableRestaurants(location?: {
  lat: number;
  lng: number;
}): Promise<RestaurantListItem[]> {
  const restaurants = await queryRestaurants(Boolean(location));

  return restaurants
    .map((r) => {
      if (!location || r.latitude === null || r.longitude === null) {
        return { ...r, distanceKm: null as number | null };
      }
      return { ...r, distanceKm: distanceKm(location.lat, location.lng, r.latitude, r.longitude) };
    })
    .filter((r) => {
      if (!location) return true;
      return r.distanceKm !== null && r.deliveryRadiusKm !== null && r.distanceKm <= r.deliveryRadiusKm;
    });
}
