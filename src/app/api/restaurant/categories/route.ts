import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOwnedRestaurant, isFailure } from "@/lib/restaurant-auth";

const createSchema = z.object({ name: z.string().min(1) });

export async function GET() {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;

  const categories = await prisma.menuCategory.findMany({
    where: { restaurantId: result.restaurant.id },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ categories });
}

export async function POST(request: Request) {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A category name is required" }, { status: 400 });
  }

  const existingCount = await prisma.menuCategory.count({
    where: { restaurantId: result.restaurant.id },
  });

  try {
    const category = await prisma.menuCategory.create({
      data: {
        restaurantId: result.restaurant.id,
        name: parsed.data.name,
        sortOrder: existingCount,
      },
    });
    return NextResponse.json({ category }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "You already have a category with that name" }, { status: 409 });
  }
}
