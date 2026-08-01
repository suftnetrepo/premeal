import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOwnedRestaurant, isFailure } from "@/lib/restaurant-auth";
import { unexpectedErrorResponse } from "@/lib/api-errors";

const schema = z.object({ isActive: z.boolean() });

export async function POST(request: Request) {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "isActive must be true or false" }, { status: 400 });
  }

  try {
    const restaurant = await prisma.restaurant.update({
      where: { id: result.restaurant.id },
      data: { isActive: parsed.data.isActive },
    });
    return NextResponse.json({ isActive: restaurant.isActive });
  } catch (err) {
    return unexpectedErrorResponse(err, "Could not update your order status");
  }
}
