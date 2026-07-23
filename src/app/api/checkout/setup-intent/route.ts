import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createCheckoutSetupIntent } from "@/lib/payments";
import { StripeNotConfiguredError } from "@/lib/stripe";
import { unexpectedErrorResponse } from "@/lib/api-errors";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "You need to be logged in to check out" }, { status: 401 });
  }

  try {
    const { clientSecret } = await createCheckoutSetupIntent(user);
    return NextResponse.json({ clientSecret });
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    return unexpectedErrorResponse(err, "Could not start checkout");
  }
}
