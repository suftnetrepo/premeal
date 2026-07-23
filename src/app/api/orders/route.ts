import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { OrderStatus } from "@prisma/client";
import { createOrder, SlotFullError, SlotClosedError, InvalidModifierSelectionError, RestaurantNotApprovedError, DeliveryOutOfRangeError } from "@/lib/capacity";
import { PromoCodeError } from "@/lib/promotions";
import { getCurrentUser } from "@/lib/auth";
import { unexpectedErrorResponse } from "@/lib/api-errors";

const createOrderSchema = z.object({
  restaurantId: z.string(),
  slotId: z.string(),
  deliveryAddress: z.string().min(1),
  notes: z.string().optional(),
  stripePaymentMethodId: z.string().min(1),
  promoCode: z.string().optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string(),
        quantity: z.number().int().positive(),
        notes: z.string().optional(),
        selectedOptionIds: z.array(z.string()).optional(),
      })
    )
    .min(1),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "You need to be logged in to place an order" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;

  try {
    const order = await createOrder({
      customerId: user.id,
      restaurantId: input.restaurantId,
      slotId: input.slotId,
      deliveryAddress: input.deliveryAddress,
      notes: input.notes,
      stripePaymentMethodId: input.stripePaymentMethodId,
      promoCode: input.promoCode,
      items: input.items,
    });
    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    if (err instanceof SlotFullError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof SlotClosedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof InvalidModifierSelectionError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof RestaurantNotApprovedError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof DeliveryOutOfRangeError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof PromoCodeError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return unexpectedErrorResponse(err, "Could not place order");
  }
}

// Used by the restaurant dashboard (list orders for the caller's own
// restaurant) — restaurantId is required and must belong to the logged-in
// restaurant owner. Without that check, anyone could read any restaurant's
// order queue just by guessing/copying an ID.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "RESTAURANT_OWNER") {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const restaurantId = searchParams.get("restaurantId");
  if (!restaurantId) {
    return NextResponse.json({ error: "restaurantId is required" }, { status: 400 });
  }

  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant || restaurant.ownerId !== user.id) {
    return NextResponse.json({ error: "Not authorized for this restaurant" }, { status: 403 });
  }

  const statusParam = searchParams.get("status");
  const status =
    statusParam && statusParam in OrderStatus ? (statusParam as OrderStatus) : undefined;

  const orders = await prisma.order.findMany({
    where: { restaurantId, ...(status ? { status } : {}) },
    include: { items: { include: { modifiers: true } }, customer: true, slot: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ orders });
}
