import { NextResponse } from "next/server";
import { requireOwnedRestaurant, isFailure } from "@/lib/restaurant-auth";
import { createSignupFeeCheckoutSession } from "@/lib/restaurant-fees";
import { unexpectedErrorResponse } from "@/lib/api-errors";

export async function POST() {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;

  try {
    const url = await createSignupFeeCheckoutSession(result.restaurant);
    return NextResponse.json({ url });
  } catch (err) {
    return unexpectedErrorResponse(err, "Could not start checkout");
  }
}
