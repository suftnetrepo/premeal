import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOwnedRestaurant, isFailure } from "@/lib/restaurant-auth";

const updateSlotSchema = z.object({
  capacity: z.number().int().min(0),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slotId: string }> }
) {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;
  const { slotId } = await params;

  const slot = await prisma.deliverySlot.findUnique({ where: { id: slotId } });
  if (!slot || slot.restaurantId !== result.restaurant.id) {
    return NextResponse.json({ error: "Slot not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateSlotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Can't set capacity below what's already booked — that would silently
  // "overbook" a slot that customers already have confirmed/pending orders
  // against.
  if (parsed.data.capacity < slot.bookedCount) {
    return NextResponse.json(
      { error: `Capacity can't be lower than the ${slot.bookedCount} orders already booked on this slot.` },
      { status: 409 }
    );
  }

  const updated = await prisma.deliverySlot.update({
    where: { id: slotId },
    data: { capacity: parsed.data.capacity },
  });

  return NextResponse.json({ slot: updated });
}
