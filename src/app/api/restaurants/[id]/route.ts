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
