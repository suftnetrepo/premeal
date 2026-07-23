import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOwnedRestaurant, isFailure } from "@/lib/restaurant-auth";

const schema = z.object({ orderedIds: z.array(z.string()).min(1) });

export async function POST(request: Request) {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "orderedIds is required" }, { status: 400 });
  }

  const owned = await prisma.menuCategory.findMany({
    where: { restaurantId: result.restaurant.id },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((c) => c.id));
  if (!parsed.data.orderedIds.every((id) => ownedIds.has(id))) {
    return NextResponse.json({ error: "One or more categories don't belong to you" }, { status: 403 });
  }

  await prisma.$transaction(
    parsed.data.orderedIds.map((id, index) =>
      prisma.menuCategory.update({ where: { id }, data: { sortOrder: index } })
    )
  );

  return NextResponse.json({ ok: true });
}
