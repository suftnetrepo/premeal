import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOwnedRestaurant, isFailure } from "@/lib/restaurant-auth";

const updateSchema = z.object({ name: z.string().min(1) });

async function loadOwnedCategory(restaurantId: string, categoryId: string) {
  const category = await prisma.menuCategory.findUnique({ where: { id: categoryId } });
  if (!category || category.restaurantId !== restaurantId) return null;
  return category;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;
  const { categoryId } = await params;

  const existing = await loadOwnedCategory(result.restaurant.id, categoryId);
  if (!existing) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A category name is required" }, { status: 400 });
  }

  try {
    const category = await prisma.menuCategory.update({
      where: { id: categoryId },
      data: { name: parsed.data.name },
    });
    return NextResponse.json({ category });
  } catch {
    return NextResponse.json({ error: "You already have a category with that name" }, { status: 409 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;
  const { categoryId } = await params;

  const existing = await loadOwnedCategory(result.restaurant.id, categoryId);
  if (!existing) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  // Items in this category aren't deleted or blocked — the schema's
  // onDelete: SetNull just clears their categoryId, so they fall back to
  // "Uncategorized" rather than disappearing.
  await prisma.menuCategory.delete({ where: { id: categoryId } });
  return NextResponse.json({ ok: true });
}
