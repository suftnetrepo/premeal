import { NextResponse } from "next/server";
import { requireOwnedRestaurant, isFailure } from "@/lib/restaurant-auth";
import { removeDriverFromRestaurant, DriverError } from "@/lib/drivers";
import { unexpectedErrorResponse } from "@/lib/api-errors";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;

  const { id } = await params;

  try {
    await removeDriverFromRestaurant(result.restaurant, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof DriverError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return unexpectedErrorResponse(err, "Could not remove driver");
  }
}
