import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createSubscriptionCheckoutSession, StripeSubscriptionNotConfiguredError } from "@/lib/subscriptions";
import { isFeatureEnabled, FEATURE_FLAGS } from "@/lib/feature-flags";
import { unexpectedErrorResponse } from "@/lib/api-errors";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "You need to be logged in to subscribe" }, { status: 401 });
  }

  if (!(await isFeatureEnabled(FEATURE_FLAGS.SUBSCRIPTIONS))) {
    return NextResponse.json({ error: "Subscriptions aren't available right now." }, { status: 503 });
  }

  try {
    const url = await createSubscriptionCheckoutSession(user);
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof StripeSubscriptionNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    return unexpectedErrorResponse(err, "Could not start checkout");
  }
}
