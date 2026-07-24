import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwnedRestaurant, isFailure } from "@/lib/restaurant-auth";
import { assignDriverToOrder, DriverError } from "@/lib/drivers";
import { unexpectedErrorResponse } from "@/lib/api-errors";

const schema = z.object({ driverId: z.string().nullable() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;

  const { id } = await params;
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    await assignDriverToOrder(result.restaurant, id, parsed.data.driverId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof DriverError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return unexpectedErrorResponse(err, "Could not assign driver");
  }
}
