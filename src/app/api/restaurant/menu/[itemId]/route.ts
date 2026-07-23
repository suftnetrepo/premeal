import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOwnedRestaurant, isFailure } from "@/lib/restaurant-auth";

const updateItemSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  priceCents: z.number().int().positive().optional(),
  isAvailable: z.boolean().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  categoryId: z.string().nullable().optional(),
});

async function loadOwnedItem(restaurantId: string, itemId: string) {
  const item = await prisma.menuItem.findUnique({ where: { id: itemId } });
  if (!item || item.restaurantId !== restaurantId) return null;
  return item;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;
  const { itemId } = await params;

  const existing = await loadOwnedItem(result.restaurant.id, itemId);
  if (!existing) {
    return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.categoryId) {
    const category = await prisma.menuCategory.findUnique({ where: { id: parsed.data.categoryId } });
    if (!category || category.restaurantId !== result.restaurant.id) {
      return NextResponse.json({ error: "That category doesn't belong to you" }, { status: 403 });
    }
  }

  const item = await prisma.menuItem.update({
    where: { id: itemId },
    data: {
      ...parsed.data,
      ...(parsed.data.imageUrl !== undefined ? { imageUrl: parsed.data.imageUrl || null } : {}),
    },
  });
  return NextResponse.json({ item });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;
  const { itemId } = await params;

  const existing = await loadOwnedItem(result.restaurant.id, itemId);
  if (!existing) {
    return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
  }

  // Menu items already referenced by past orders can't be hard-deleted
  // (OrderItem keeps a snapshot, but the foreign key still points here) —
  // mark unavailable instead, which is what customers should see anyway.
  const usedInOrders = await prisma.orderItem.findFirst({ where: { menuItemId: itemId } });
  if (usedInOrders) {
    const item = await prisma.menuItem.update({
      where: { id: itemId },
      data: { isAvailable: false },
    });
    return NextResponse.json({ item, note: "Item has past orders — marked unavailable instead of deleted." });
  }

  await prisma.menuItem.delete({ where: { id: itemId } });
  return NextResponse.json({ ok: true });
}
