import { NextResponse } from "next/server";
import { requireOwnedRestaurant, isFailure } from "@/lib/restaurant-auth";
import { createOnboardingLink } from "@/lib/connect";
import { StripeNotConfiguredError } from "@/lib/stripe";
import { unexpectedErrorResponse } from "@/lib/api-errors";

export async function POST() {
  const result = await requireOwnedRestaurant();
  if (isFailure(result)) return result.error;

  try {
    const url = await createOnboardingLink(result.restaurant);
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    return unexpectedErrorResponse(err, "Could not start payout setup");
  }
}
