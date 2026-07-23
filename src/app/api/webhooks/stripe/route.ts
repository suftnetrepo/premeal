import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { syncSubscriptionFromStripe } from "@/lib/subscriptions";
import { markSignupFeePaid } from "@/lib/restaurant-fees";
import type Stripe from "stripe";

// Webhook signature verification needs the exact raw request bytes — if
// Next.js parsed this as JSON first, the signature check would fail, since
// even whitespace differences change the computed HMAC.
export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe webhook] STRIPE_WEBHOOK_SECRET is not set — rejecting webhook.");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      // Same reasoning as src/lib/connect.ts: payouts_enabled is what
      // matters here, not charges_enabled — this account only receives
      // Transfers, it never processes a card charge itself.
      const complete = Boolean(account.details_submitted && account.payouts_enabled);
      await prisma.restaurant.updateMany({
        where: { stripeAccountId: account.id },
        data: { stripeOnboardingComplete: complete },
      });
      break;
    }

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.mode === "subscription" && typeof session.subscription === "string") {
        const stripe = getStripe();
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        await syncSubscriptionFromStripe(subscription, session.client_reference_id ?? undefined);
      }

      if (
        session.mode === "payment" &&
        session.metadata?.purpose === "restaurant_signup_fee" &&
        session.metadata.restaurantId &&
        typeof session.payment_intent === "string"
      ) {
        await markSignupFeePaid(
          session.metadata.restaurantId,
          session.amount_total ?? 0,
          session.payment_intent
        );
      }

      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await syncSubscriptionFromStripe(subscription);
      break;
    }

    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;
      // The synchronous try/catch in confirmOrder() already handles the
      // common case (card declined immediately). This is a backstop for
      // async failures Stripe reports later — logged for now rather than
      // acted on automatically, since the order may have already moved on.
      console.warn(`[stripe webhook] Payment failed for intent ${intent.id}:`, intent.last_payment_error?.message);
      break;
    }

    default:
      // Intentionally ignore event types we don't act on yet.
      break;
  }

  return NextResponse.json({ received: true });
}
