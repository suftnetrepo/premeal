import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOwnedRestaurant, isFailure } from "@/lib/restaurant-auth";

const createItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  priceCents: z.number().int().positive(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  categoryId: z.string().nullable().optional(),
});

export async function GET() {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;

  const items = await prisma.menuItem.findMany({
    where: { restaurantId: result.restaurant.id },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;

  const body = await request.json();
  const parsed = createItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.categoryId) {
    const category = await prisma.menuCategory.findUnique({ where: { id: parsed.data.categoryId } });
    if (!category || category.restaurantId !== result.restaurant.id) {
      return NextResponse.json({ error: "That category doesn't belong to you" }, { status: 403 });
    }
  }

  const item = await prisma.menuItem.create({
    data: {
      ...parsed.data,
      imageUrl: parsed.data.imageUrl || undefined,
      restaurantId: result.restaurant.id,
    },
  });
  return NextResponse.json({ item }, { status: 201 });
}
