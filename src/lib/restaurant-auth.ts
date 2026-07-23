import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Restaurant, User } from "@prisma/client";

type Success = { user: User; restaurant: Restaurant };
type Failure = { error: NextResponse };

/**
 * Every /api/restaurant/* route needs the same check: is someone logged in,
 * are they a restaurant owner, and do they actually have a restaurant yet.
 * Centralizing it here means that check can't drift between routes.
 */
export async function requireOwnedRestaurant(): Promise<Success | Failure> {
  const user = await getCurrentUser();
  if (!user || user.role !== "RESTAURANT_OWNER") {
    return { error: NextResponse.json({ error: "Not authorized" }, { status: 401 }) };
  }

  const restaurant = await prisma.restaurant.findFirst({ where: { ownerId: user.id } });
  if (!restaurant) {
    return { error: NextResponse.json({ error: "No restaurant found for this account" }, { status: 404 }) };
  }

  return { user, restaurant };
}

export function isFailure(result: Success | Failure): result is Failure {
  return "error" in result;
}
