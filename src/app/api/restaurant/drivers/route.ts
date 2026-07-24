import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwnedRestaurant, isFailure } from "@/lib/restaurant-auth";
import { inviteDriver, DriverError } from "@/lib/drivers";
import { prisma } from "@/lib/db";
import { unexpectedErrorResponse } from "@/lib/api-errors";

const inviteSchema = z.object({ email: z.string().email() });

export async function GET() {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;

  const drivers = await prisma.restaurantDriver.findMany({
    where: { restaurantId: result.restaurant.id, status: { not: "REMOVED" } },
    include: { driver: { select: { id: true, name: true, email: true } } },
    orderBy: { invitedAt: "desc" },
  });

  return NextResponse.json({ drivers });
}

export async function POST(request: Request) {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;

  const body = await request.json();
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  try {
    await inviteDriver(result.restaurant, parsed.data.email);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    if (err instanceof DriverError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return unexpectedErrorResponse(err, "Could not invite driver");
  }
}
