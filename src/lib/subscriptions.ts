import { getStripe, appUrl } from "@/lib/stripe";
import { getOrCreateStripeCustomer } from "@/lib/payments";
import { prisma } from "@/lib/db";
import type { User, Subscription } from "@prisma/client";
import type Stripe from "stripe";

export class StripeSubscriptionNotConfiguredError extends Error {
  constructor() {
    super(
      "Subscriptions aren't configured. Create a recurring Price in your Stripe dashboard and set STRIPE_SUBSCRIPTION_PRICE_ID in .env."
    );
    this.name = "StripeSubscriptionNotConfiguredError";
  }
}

function priceId(): string {
  const id = process.env.STRIPE_SUBSCRIPTION_PRICE_ID;
  if (!id) throw new StripeSubscriptionNotConfiguredError();
  return id;
}

export async function getActiveSubscription(userId: string): Promise<Subscription | null> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  return sub && sub.status === "ACTIVE" ? sub : null;
}

/**
 * Redirects the customer to Stripe's hosted subscription checkout — not a
 * custom form. Stripe Checkout already handles card entry, 3D Secure, and
 * the subscription-specific edge cases (proration, trial periods if added
 * later) better than a bespoke Elements integration would for a single
 * fixed-price plan like this.
 */
export async function createSubscriptionCheckoutSession(user: User): Promise<string> {
  const stripe = getStripe();
  const customerId = await getOrCreateStripeCustomer(user);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId(), quantity: 1 }],
    customer: customerId,
    client_reference_id: user.id,
    success_url: `${appUrl()}/subscribe?success=1`,
    cancel_url: `${appUrl()}/subscribe`,
    metadata: { userId: user.id },
  });

  if (!session.url) throw new Error("Stripe did not return a Checkout URL.");
  return session.url;
}

/** Stripe's hosted "manage your subscription" page — cancellation, payment method updates, invoice history. */
export async function createBillingPortalSession(user: User): Promise<string> {
  const stripe = getStripe();
  const subscription = await prisma.subscription.findUnique({ where: { userId: user.id } });
  if (!subscription) throw new Error("No subscription found for this account.");

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${appUrl()}/subscribe`,
  });

  return session.url;
}

/**
 * Keeps our Subscription row in sync with Stripe — called from the
 * webhook on checkout.session.completed (mode=subscription) and every
 * customer.subscription.* event. Upsert rather than create/update-only
 * since either event could arrive first depending on timing.
 */
export async function syncSubscriptionFromStripe(stripeSubscription: Stripe.Subscription, userId?: string) {
  const customerId =
    typeof stripeSubscription.customer === "string" ? stripeSubscription.customer : stripeSubscription.customer.id;

  const resolvedUserId = userId ?? (await resolveUserIdFromCustomer(customerId));
  if (!resolvedUserId) {
    console.error(`[subscriptions] Could not resolve a user for Stripe customer ${customerId} — skipping sync.`);
    return;
  }

  // Backfill User.stripeCustomerId if this user subscribed before ever
  // checking out an order (so they had no Stripe customer on our side
  // yet) — without this, a later customer.subscription.updated/deleted
  // event (which carries no client_reference_id) would have no way to
  // resolve back to this user.
  await prisma.user.updateMany({
    where: { id: resolvedUserId, stripeCustomerId: null },
    data: { stripeCustomerId: customerId },
  });

  const status = mapStripeStatus(stripeSubscription.status);
  const currentPeriodEndUnix = (stripeSubscription as unknown as { current_period_end?: number })
    .current_period_end;

  await prisma.subscription.upsert({
    where: { userId: resolvedUserId },
    create: {
      userId: resolvedUserId,
      stripeSubscriptionId: stripeSubscription.id,
      stripeCustomerId: customerId,
      status,
      currentPeriodEnd: currentPeriodEndUnix ? new Date(currentPeriodEndUnix * 1000) : null,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    },
    update: {
      status,
      currentPeriodEnd: currentPeriodEndUnix ? new Date(currentPeriodEndUnix * 1000) : null,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    },
  });
}

async function resolveUserIdFromCustomer(stripeCustomerId: string): Promise<string | null> {
  const user = await prisma.user.findFirst({ where: { stripeCustomerId } });
  return user?.id ?? null;
}

function mapStripeStatus(status: Stripe.Subscription.Status): "ACTIVE" | "PAST_DUE" | "CANCELED" | "INCOMPLETE" {
  switch (status) {
    case "active":
    case "trialing":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
    case "incomplete_expired":
      return "CANCELED";
    default:
      return "INCOMPLETE";
  }
}
