import { prisma } from "@/lib/db";

export type TopDish = { name: string; timesOrdered: number; revenueCents: number };

/**
 * Best-selling items for a restaurant's own dashboard — the "Your Top
 * Dish" idea, but with metrics that actually mean something to a
 * restaurant owner (times ordered, revenue) rather than content-platform
 * metrics like "views" that don't apply here.
 *
 * revenueCents is the item's base price × quantity, summed across real
 * completed orders — it deliberately does NOT include paid modifier
 * add-ons (e.g. "Extra salmon"), since that would need a per-row
 * correlated subquery for a small accuracy gain. Real number, slightly
 * conservative, clearly documented — not a fabricated one.
 */
export async function getTopDishes(restaurantId: string, limit = 5): Promise<TopDish[]> {
  const rows = await prisma.$queryRaw<{ name: string; timesOrdered: number; revenueCents: number }[]>`
    SELECT oi."nameSnapshot" AS name,
           SUM(oi.quantity)::int AS "timesOrdered",
           SUM(oi."priceCents" * oi.quantity)::int AS "revenueCents"
    FROM "OrderItem" oi
    JOIN "Order" o ON o.id = oi."orderId"
    WHERE o."restaurantId" = ${restaurantId}
      AND o.status IN ('CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED')
    GROUP BY oi."nameSnapshot"
    ORDER BY "timesOrdered" DESC
    LIMIT ${limit}
  `;
  return rows;
}
