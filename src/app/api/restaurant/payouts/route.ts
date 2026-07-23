import { NextResponse } from "next/server";
import { requireOwnedRestaurant, isFailure } from "@/lib/restaurant-auth";
import { refreshOnboardingStatus } from "@/lib/connect";
import { StripeNotConfiguredError } from "@/lib/stripe";
import { unexpectedErrorResponse } from "@/lib/api-errors";

export async function GET() {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;

  if (!result.restaurant.stripeAccountId) {
    return NextResponse.json({ connected: false, onboardingComplete: false });
  }

  try {
    const complete = await refreshOnboardingStatus(result.restaurant);
    return NextResponse.json({ connected: true, onboardingComplete: complete });
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    return unexpectedErrorResponse(err, "Could not check payout status");
  }
}
