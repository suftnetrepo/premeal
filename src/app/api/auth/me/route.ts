import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null });
  }

  const restaurant =
    user.role === "RESTAURANT_OWNER"
      ? await prisma.restaurant.findFirst({ where: { ownerId: user.id } })
      : null;

  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    restaurantId: restaurant?.id ?? null,
  });
}
