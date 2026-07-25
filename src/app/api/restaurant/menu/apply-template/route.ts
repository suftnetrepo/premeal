import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOwnedRestaurant, isFailure } from "@/lib/restaurant-auth";
import { getTemplate } from "@/lib/menu-templates";

const applySchema = z.object({ templateKey: z.string() });

export async function POST(request: Request) {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;

  const body = await request.json();
  const parsed = applySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "templateKey is required" }, { status: 400 });
  }

  const template = getTemplate(parsed.data.templateKey);
  if (!template) {
    return NextResponse.json({ error: "Unknown template" }, { status: 404 });
  }

  // isAvailable: false is deliberate, not optional — MenuItem.isAvailable
  // defaults to true at the schema level, so without setting this
  // explicitly, every template item would go straight onto the live
  // customer-facing menu the moment it's created: a suggested price, no
  // photo, completely unreviewed. This is what makes "just a starting
  // point" actually true — the owner has to consciously review and
  // toggle each item on before a real customer can ever see it.
  const items = await prisma.menuItem.createMany({
    data: template.items.map((item) => ({ ...item, restaurantId: result.restaurant.id, isAvailable: false })),
  });

  return NextResponse.json({ createdCount: items.count }, { status: 201 });
}
