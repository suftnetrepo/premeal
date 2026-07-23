import { getStripe, appUrl } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import type { Restaurant } from "@prisma/client";

// Flat and, deliberately, not admin-configurable per restaurant yet — one
// number, easy to reason about. Bump this if the business decides to
// change it; existing restaurants keep whatever they were actually
// charged (see Restaurant.signupFeeCents, a snapshot, not a live read of
// this constant).
export const SIGNUP_FEE_CENTS = 5000; // £50

/**
 * Stripe Checkout in one-time "payment" mode, not "subscription" — same
 * hosted-page approach as src/lib/subscriptions.ts, for the same reason:
 * no custom card-collection UI to build or maintain. Unlike the
 * subscription flow, this doesn't need a pre-created Stripe Price — a
 * one-off inline price_data is simpler for a single fixed-amount charge
 * with no recurring billing behind it.
 */
export async function createSignupFeeCheckoutSession(restaurant: Restaurant): Promise<string> {
  if (restaurant.approvalStatus !== "APPROVED") {
    throw new Error("The signup fee can only be paid after admin approval.");
  }
  if (restaurant.signupFeePaidAt) {
    throw new Error("This restaurant has already paid the signup fee.");
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "gbp",
          unit_amount: SIGNUP_FEE_CENTS,
          product_data: {
            name: "Pre-Meal restaurant signup fee",
            description: "One-time, not recurring. Ongoing costs are commission per order only.",
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${appUrl()}/restaurant/dashboard?signupFeePaid=1`,
    cancel_url: `${appUrl()}/restaurant/dashboard`,
    metadata: { restaurantId: restaurant.id, purpose: "restaurant_signup_fee" },
  });

  if (!session.url) throw new Error("Stripe did not return a Checkout URL.");
  return session.url;
}

/** Called from the webhook once the Checkout session for a signup fee completes. */
export async function markSignupFeePaid(restaurantId: string, amountCents: number, paymentIntentId: string) {
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      signupFeeCents: amountCents,
      signupFeePaidAt: new Date(),
      stripeSignupFeePaymentIntentId: paymentIntentId,
    },
  });
}
