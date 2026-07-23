import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOwnedRestaurant, isFailure } from "@/lib/restaurant-auth";

const groupSchema = z.object({
  name: z.string().min(1),
  minSelect: z.number().int().min(0),
  maxSelect: z.number().int().min(1),
  options: z
    .array(
      z.object({
        name: z.string().min(1),
        priceDeltaCents: z.number().int(),
      })
    )
    .min(1),
});

async function loadOwnedItem(restaurantId: string, itemId: string) {
  const item = await prisma.menuItem.findUnique({ where: { id: itemId } });
  if (!item || item.restaurantId !== restaurantId) return null;
  return item;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;
  const { itemId } = await params;

  const item = await loadOwnedItem(result.restaurant.id, itemId);
  if (!item) return NextResponse.json({ error: "Menu item not found" }, { status: 404 });

  const groups = await prisma.modifierGroup.findMany({
    where: { menuItemId: itemId },
    orderBy: { sortOrder: "asc" },
    include: { options: true },
  });
  return NextResponse.json({ groups });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;
  const { itemId } = await params;

  const item = await loadOwnedItem(result.restaurant.id, itemId);
  if (!item) return NextResponse.json({ error: "Menu item not found" }, { status: 404 });

  const body = await request.json();
  const parsed = groupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (parsed.data.minSelect > parsed.data.maxSelect) {
    return NextResponse.json({ error: "minSelect can't be greater than maxSelect" }, { status: 400 });
  }

  const group = await prisma.modifierGroup.create({
    data: {
      menuItemId: itemId,
      name: parsed.data.name,
      minSelect: parsed.data.minSelect,
      maxSelect: parsed.data.maxSelect,
      options: { create: parsed.data.options },
    },
    include: { options: true },
  });

  return NextResponse.json({ group }, { status: 201 });
}
