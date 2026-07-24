/**
 * Generates a batch of realistic test orders spread across several
 * delivery dates and every order status, so pagination, the status/date
 * filters, prep summary, and CSV export on /restaurant/orders all have
 * something real to be tested against.
 *
 * Deliberately separate from prisma/seed.ts (which sets up the clean
 * baseline demo data) — this is a "pile on more test orders whenever you
 * want" utility, safe to run more than once; each run just adds more
 * orders on top of whatever's already there.
 *
 * Bypasses createOrder() in src/lib/capacity.ts on purpose — that
 * function's whole job is enforcing checkout business rules (slot
 * capacity, Stripe charges, promo codes), which isn't what's being
 * tested here. Order rows are created directly, which is faster and
 * doesn't risk touching Stripe at all.
 *
 * Usage: npx tsx scripts/seed-test-orders.ts [count-per-restaurant]
 */
import { prisma } from "../src/lib/db";
import { DELIVERY_FEE_CENTS } from "../src/lib/capacity";
import type { OrderStatus } from "@prisma/client";

const ORDERS_PER_RESTAURANT = Number(process.argv[2]) || 40;
const TEST_ADDRESS = "5 Iron Gate, Derby, DE1 3GL";

// Same local-timezone midnight convention as dateAtMidnight() in
// src/app/api/restaurant/slots/route.ts — has to match, or these test
// orders' dates won't line up correctly with the date filter.
function dateAtMidnight(daysFromNow: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(0, 0, 0, 0);
  return d;
}

// A realistic spread, not uniform — mostly delivered/confirmed (a real
// restaurant's history is mostly successful orders), with enough of
// everything else that every status filter tab has something to show.
const STATUS_WEIGHTS: [OrderStatus, number][] = [
  ["DELIVERED", 40],
  ["CONFIRMED", 15],
  ["OUT_FOR_DELIVERY", 10],
  ["PENDING_CONFIRMATION", 10],
  ["DECLINED", 10],
  ["EXPIRED", 8],
  ["CANCELLED", 7],
];

function pickWeightedStatus(): OrderStatus {
  const total = STATUS_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [status, weight] of STATUS_WEIGHTS) {
    if (roll < weight) return status;
    roll -= weight;
  }
  return "DELIVERED";
}

function statusTimestamps(status: OrderStatus, createdAt: Date) {
  const later = (minutes: number) => new Date(createdAt.getTime() + minutes * 60_000);
  switch (status) {
    case "CONFIRMED":
      return { confirmedAt: later(10) };
    case "OUT_FOR_DELIVERY":
      return { confirmedAt: later(10), outForDeliveryAt: later(60) };
    case "DELIVERED":
      return { confirmedAt: later(10), outForDeliveryAt: later(60), deliveredAt: later(90) };
    case "DECLINED":
      return { declinedAt: later(15) };
    case "EXPIRED":
      return { expiredAt: later(30) };
    case "CANCELLED":
      return { cancelledAt: later(20) };
    default:
      return {};
  }
}

async function main() {
  const restaurants = await prisma.restaurant.findMany({
    where: { approvalStatus: "APPROVED", signupFeePaidAt: { not: null } },
    include: {
      menuItems: {
        where: { isAvailable: true },
        include: { modifierGroups: { include: { options: { where: { isAvailable: true } } } } },
      },
    },
  });
  const customers = await prisma.user.findMany({ where: { role: "CUSTOMER" } });

  if (restaurants.length === 0 || customers.length === 0) {
    console.error("No approved restaurants or customers found — run `npm run seed` first.");
    process.exit(1);
  }

  let totalCreated = 0;

  for (const restaurant of restaurants) {
    if (restaurant.menuItems.length === 0) {
      console.log(`Skipping ${restaurant.name} — no available menu items.`);
      continue;
    }

    // A spread of delivery dates: some in the past (so they can be
    // DELIVERED/DECLINED/etc.), a few upcoming (so PENDING_CONFIRMATION/
    // CONFIRMED still make sense as "not resolved yet").
    const dateOffsets = [-14, -10, -7, -5, -3, -2, -1, 0, 1, 3, 5];
    const slots = await Promise.all(
      dateOffsets.map(async (offset) => {
        const date = dateAtMidnight(offset);
        const cutoffAt = new Date(date);
        cutoffAt.setHours(17, 0, 0, 0);
        return prisma.deliverySlot.upsert({
          where: { restaurantId_date_windowStart: { restaurantId: restaurant.id, date, windowStart: "18:30" } },
          update: {},
          create: {
            restaurantId: restaurant.id,
            date,
            windowStart: "18:30",
            windowEnd: "19:30",
            capacity: 1000, // high enough that these test orders never hit a real capacity limit
            cutoffAt,
          },
        });
      })
    );

    for (let i = 0; i < ORDERS_PER_RESTAURANT; i++) {
      const customer = customers[Math.floor(Math.random() * customers.length)];
      const slot = slots[Math.floor(Math.random() * slots.length)];
      const status = pickWeightedStatus();

      // 1-3 distinct menu items, quantity 1-4 each, with a real modifier
      // selection when the item has one — this is what makes the prep
      // summary's "Large: 3 · Regular: 2" breakdown actually testable.
      const itemCount = 1 + Math.floor(Math.random() * 3);
      const chosenItems = [...restaurant.menuItems].sort(() => Math.random() - 0.5).slice(0, itemCount);

      let subtotalCents = 0;
      const orderItemsData = chosenItems.map((item) => {
        const quantity = 1 + Math.floor(Math.random() * 4);
        const modifierData: { groupName: string; optionName: string; priceDeltaCents: number }[] = [];
        let priceCents = item.priceCents;

        for (const group of item.modifierGroups) {
          if (group.options.length === 0) continue;
          const shouldPick = group.minSelect > 0 || Math.random() < 0.6; // required groups always picked, optional ones sometimes
          if (!shouldPick) continue;
          const option = group.options[Math.floor(Math.random() * group.options.length)];
          modifierData.push({ groupName: group.name, optionName: option.name, priceDeltaCents: option.priceDeltaCents });
          priceCents += option.priceDeltaCents;
        }

        subtotalCents += priceCents * quantity;
        return {
          nameSnapshot: item.name,
          priceCents: item.priceCents, // base price, matching how real orders store it (modifiers separate)
          quantity,
          modifiers: { create: modifierData },
        };
      });

      const deliveryFeeCents = DELIVERY_FEE_CENTS;
      const totalCents = subtotalCents + deliveryFeeCents;
      const createdAt = new Date(slot.date.getTime() - Math.floor(Math.random() * 4) * 24 * 60 * 60 * 1000);

      await prisma.order.create({
        data: {
          customerId: customer.id,
          restaurantId: restaurant.id,
          slotId: slot.id,
          status,
          subtotalCents,
          deliveryFeeCents,
          discountCents: 0,
          totalCents,
          deliveryAddress: TEST_ADDRESS,
          confirmationDeadline: new Date(createdAt.getTime() + 30 * 60_000),
          createdAt,
          ...statusTimestamps(status, createdAt),
          items: { create: orderItemsData },
        },
      });
      totalCreated++;
    }

    console.log(`Created ${ORDERS_PER_RESTAURANT} test orders for ${restaurant.name}.`);
  }

  console.log(`\nDone — ${totalCreated} test orders created across ${restaurants.length} restaurant(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
