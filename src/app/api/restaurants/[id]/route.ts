import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

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
  // client re-derive capacity math.
  const slots = restaurant.deliverySlots.map((slot) => {
    const remaining = slot.capacity - slot.bookedCount;
    const isPastCutoff = slot.cutoffAt < new Date();
    return {
      ...slot,
      remaining,
      status: isPastCutoff || remaining <= 0 ? "full" : remaining <= 5 ? "limited" : "available",
    };
  });

  return NextResponse.json({ restaurant: { ...restaurant, deliverySlots: slots } });
}
