import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getBookableSlots } from "@/lib/delivery-slots";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: {
      menuItems: {
        where: { isAvailable: true },
        include: {
          modifierGroups: {
            orderBy: { sortOrder: "asc" },
            include: { options: { where: { isAvailable: true } } },
          },
        },
      },
      deliverySlots: {
        where: { date: { gte: new Date(new Date().toDateString()) } },
        orderBy: [{ date: "asc" }, { windowStart: "asc" }],
        take: 30,
      },
    },
  });

  // Same gate the web restaurant page enforces (see
  // src/app/restaurants/[id]/page.tsx's notFound() call) — this API route
  // had no equivalent at all, meaning a not-yet-approved or signup-fee-
  // unpaid restaurant's full menu was fetchable by anyone who knew its ID.
  if (!restaurant || restaurant.approvalStatus !== "APPROVED" || !restaurant.signupFeePaidAt) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  // Same reasoning as the web restaurant page's equivalent check
  // (src/app/restaurants/[id]/page.tsx) — temporary and owner-controlled,
  // so a distinct response rather than a plain 404, and deliberately not
  // just the full menu with an isActive flag buried in it. The mobile
  // client shouldn't have to notice that flag itself inside a large
  // payload; a dedicated, unambiguous status is easier to build against
  // correctly. The real enforcement either way is still inside
  // createOrder() itself — this is what makes the same fact visible
  // before checkout instead of only failing there.
  if (!restaurant.isActive) {
    return NextResponse.json({ error: "not_accepting_orders", restaurantName: restaurant.name }, { status: 409 });
  }

  // Expose remaining spots + a simple traffic-light status, don't make the
  // client re-derive capacity math. Also drops any slot that violates
  // this restaurant's own minimumLeadTimeDays — same shared helper as the
  // web restaurant page, so the mobile app (the consumer of this route)
  // gets the exact same filtering without needing its own copy of this
  // logic. See src/lib/delivery-slots.ts.
  const slots = getBookableSlots(restaurant.deliverySlots, restaurant.minimumLeadTimeDays);

  return NextResponse.json({ restaurant: { ...restaurant, deliverySlots: slots } });
}
