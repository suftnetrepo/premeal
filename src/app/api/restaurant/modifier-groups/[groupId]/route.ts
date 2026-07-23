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

async function loadOwnedGroup(restaurantId: string, groupId: string) {
  const group = await prisma.modifierGroup.findUnique({
    where: { id: groupId },
    include: { menuItem: true },
  });
  if (!group || group.menuItem.restaurantId !== restaurantId) return null;
  return group;
}

// Replaces the group's name/limits and its entire option list in one call.
// Simpler than separate per-option endpoints, and matches how the menu item
// edit form already works (whole-form save). Existing OrderItemModifier
// snapshots on past orders are untouched — they don't reference this row.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;
  const { groupId } = await params;

  const existing = await loadOwnedGroup(result.restaurant.id, groupId);
  if (!existing) return NextResponse.json({ error: "Modifier group not found" }, { status: 404 });

  const body = await request.json();
  const parsed = groupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (parsed.data.minSelect > parsed.data.maxSelect) {
    return NextResponse.json({ error: "minSelect can't be greater than maxSelect" }, { status: 400 });
  }

  const group = await prisma.$transaction(async (tx) => {
    await tx.modifierOption.deleteMany({ where: { groupId } });
    return tx.modifierGroup.update({
      where: { id: groupId },
      data: {
        name: parsed.data.name,
        minSelect: parsed.data.minSelect,
        maxSelect: parsed.data.maxSelect,
        options: { create: parsed.data.options },
      },
      include: { options: true },
    });
  });

  return NextResponse.json({ group });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;
  const { groupId } = await params;

  const existing = await loadOwnedGroup(result.restaurant.id, groupId);
  if (!existing) return NextResponse.json({ error: "Modifier group not found" }, { status: 404 });

  await prisma.modifierGroup.delete({ where: { id: groupId } });
  return NextResponse.json({ ok: true });
}
