import { prisma } from "@/lib/db";

// Orders that actually happened — excludes anything still pending, expired,
// or declined. "Popular" should mean "people ordered this and it went
// through," not "this is on the menu."
const REAL_ORDER_STATUSES = ["CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"] as const;

/**
 * Top-ordered item names for a restaurant, most-ordered first. Returns an
 * empty array for a restaurant with no real order history yet — the caller
 * should omit the "Popular dishes" row entirely in that case rather than
 * relabeling arbitrary menu items as "popular," which would be exactly the
 * kind of fabricated claim this app has avoided everywhere else.
 */
export async function getPopularDishNames(restaurantId: string, limit = 3): Promise<string[]> {
  const grouped = await prisma.orderItem.groupBy({
    by: ["nameSnapshot"],
    where: { order: { restaurantId, status: { in: [...REAL_ORDER_STATUSES] } } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });
  return grouped.map((g) => g.nameSnapshot);
}

export type PlatformStats = {
  deliveredCount: number | null;
  confirmRatePercent: number | null;
  averageRating: number | null;
};

/**
 * Real platform-wide numbers for the homepage stats strip. Each field is
 * null if there's not yet enough real data to make the claim — the
 * component rendering these should skip a stat entirely rather than show
 * "0" or a fabricated placeholder. This app has no marketing traction yet;
 * showing that honestly (by omitting the section) is the correct behavior,
 * not a bug to work around with invented numbers.
 */
export async function getPlatformStats(): Promise<PlatformStats> {
  const [deliveredCount, decidedCount, confirmedOrLaterCount, ratingAgg] = await Promise.all([
    prisma.order.count({ where: { status: "DELIVERED" } }),
    // Orders that got a final answer either way — the denominator for a
    // real confirmation rate.
    prisma.order.count({ where: { status: { in: ["CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED", "DECLINED", "EXPIRED"] } } }),
    prisma.order.count({ where: { status: { in: ["CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"] } } }),
    prisma.review.aggregate({ _avg: { rating: true }, _count: { _all: true } }),
  ]);

  return {
    deliveredCount: deliveredCount > 0 ? deliveredCount : null,
    confirmRatePercent: decidedCount > 0 ? Math.round((confirmedOrLaterCount / decidedCount) * 100) : null,
    averageRating: ratingAgg._count._all > 0 ? ratingAgg._avg.rating : null,
  };
}
