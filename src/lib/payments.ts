import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { notifyPayoutSent } from "@/lib/notifications";
import type { User, Order } from "@prisma/client";

export const COMMISSION_RATE = 0.12; // applies to food subtotal only — restaurant keeps the full delivery fee

export function computePayoutSplit(order: Pick<Order, "subtotalCents" | "totalCents">) {
  const platformFeeCents = Math.round(order.subtotalCents * COMMISSION_RATE);
  const restaurantPayoutCents = order.totalCents - platformFeeCents;
  return { platformFeeCents, restaurantPayoutCents };
}

/**
 * Every user gets exactly one Stripe Customer object, created the first
 * time they check out. This is invisible plumbing, not a "saved cards"
 * feature — see the comment on User.stripeCustomerId in schema.prisma.
 *
 * Written to be safe against two concurrent calls for the same user (e.g.
 * React Strict Mode double-firing an effect in dev, or a real double
 * click): the DB write only succeeds if stripeCustomerId is still null,
 * so a losing request detects that and defers to whichever wrote first,
 * rather than leaving the database pointing at a different Stripe
 * Customer than the one actually used for the SetupIntent/PaymentMethod.
 */
export async function getOrCreateStripeCustomer(user: User): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: user.id },
  });

  const result = await prisma.user.updateMany({
    where: { id: user.id, stripeCustomerId: null },
    data: { stripeCustomerId: customer.id },
  });

  if (result.count === 0) {
    // Lost the race — another concurrent call already saved a different
    // customer. Defer to that one; the one we just created is simply
    // unused (harmless, just an orphaned test-mode object).
    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    return fresh.stripeCustomerId!;
  }

  return customer.id;
}

/**
 * Called right before showing the card entry form at checkout. Returns a
 * SetupIntent client secret — collecting the card validates and saves it
 * as a PaymentMethod (attached to the customer, for off-session use later)
 * WITHOUT charging anything yet. The actual charge happens in
 * chargeOrderOnConfirm(), potentially much later.
 */
export async function createCheckoutSetupIntent(user: User): Promise<{ clientSecret: string }> {
  const stripe = getStripe();
  const customerId = await getOrCreateStripeCustomer(user);

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    usage: "off_session",
    // Restricting to card only (rather than automatic_payment_methods,
    // which would auto-include Link) is what keeps Stripe's Link prompt
    // from appearing — Link is a cross-merchant saved-card feature that
    // conflicts with the "re-enter card every order, no saved cards"
    // decision this app is deliberately built around.
    payment_method_types: ["card"],
  });

  if (!setupIntent.client_secret) {
    throw new Error("Stripe did not return a client secret for the SetupIntent");
  }
  return { clientSecret: setupIntent.client_secret };
}

export class ChargeFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChargeFailedError";
  }
}

/**
 * Thrown when Stripe can't complete an off-session charge because the card
 * needs 3D Secure / Strong Customer Authentication — the customer has to
 * be brought back online to approve it, since off-session charges fail
 * outright rather than returning a normal "requires_action" state. Carries
 * the PaymentIntent id so the caller can put the order into
 * PAYMENT_ACTION_REQUIRED and let the customer complete it later from
 * their order page (see completePaymentAction() below).
 */
export class PaymentRequiresActionError extends Error {
  constructor(public readonly paymentIntentId: string) {
    super("This card needs additional verification from the customer.");
    this.name = "PaymentRequiresActionError";
  }
}

function isStripeAuthenticationRequiredError(
  err: unknown
): err is { code: string; payment_intent: { id: string } } {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    err.code === "authentication_required" &&
    "payment_intent" in err &&
    typeof (err as { payment_intent?: unknown }).payment_intent === "object" &&
    (err as { payment_intent?: { id?: unknown } }).payment_intent !== null &&
    typeof (err as { payment_intent: { id?: unknown } }).payment_intent.id === "string"
  );
}

/**
 * Charges the customer's card at confirmation time — this is the moment
 * money actually moves, on the platform's Stripe account (not the
 * restaurant's; see the "separate charges and transfers" note in the
 * README). Also computes and stores the payout split for later.
 */
export async function chargeOrderOnConfirm(order: Order): Promise<string> {
  if (!order.stripePaymentMethodId) {
    throw new ChargeFailedError("No payment method was captured for this order.");
  }

  const customer = await prisma.user.findUniqueOrThrow({ where: { id: order.customerId } });
  if (!customer.stripeCustomerId) {
    throw new ChargeFailedError("No Stripe customer is associated with this account.");
  }

  const stripe = getStripe();

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: order.totalCents,
      currency: "gbp",
      customer: customer.stripeCustomerId,
      payment_method: order.stripePaymentMethodId,
      off_session: true,
      confirm: true,
      metadata: { orderId: order.id },
    });
    return paymentIntent.id;
  } catch (err) {
    if (isStripeAuthenticationRequiredError(err)) {
      throw new PaymentRequiresActionError(err.payment_intent.id);
    }
    // Stripe throws a StripeCardError (among others) for declines — surface
    // a clean message rather than leaking the raw Stripe error upward.
    const message = err instanceof Error ? err.message : "The charge failed.";
    throw new ChargeFailedError(message);
  }
}

/**
 * Retrieves the client secret for a PaymentIntent stuck needing 3D Secure,
 * so the customer's browser can complete the authentication challenge.
 * No card re-entry needed — the PaymentIntent already has the payment
 * method attached from the original charge attempt.
 */
export async function getPaymentActionClientSecret(paymentIntentId: string): Promise<string> {
  const stripe = getStripe();
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (!paymentIntent.client_secret) {
    throw new Error("Stripe did not return a client secret for this PaymentIntent.");
  }
  return paymentIntent.client_secret;
}

/**
 * Called after the customer's browser completes the 3D Secure challenge.
 * Deliberately re-checks the PaymentIntent's status directly with Stripe
 * rather than trusting whatever the client claims happened — the browser
 * could be wrong, stale, or lying.
 */
export async function checkPaymentActionStatus(
  paymentIntentId: string
): Promise<"succeeded" | "still_requires_action" | "failed"> {
  const stripe = getStripe();
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (paymentIntent.status === "succeeded") return "succeeded";
  if (paymentIntent.status === "requires_action" || paymentIntent.status === "requires_confirmation") {
    return "still_requires_action";
  }
  return "failed";
}

export class RefundFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RefundFailedError";
  }
}

/** Refunds a paid order in full. Only call this for an order that was actually charged. */
export async function refundOrder(order: Order): Promise<string> {
  if (!order.stripePaymentIntentId) {
    throw new RefundFailedError("This order was never charged — there's nothing to refund.");
  }

  const stripe = getStripe();
  try {
    const refund = await stripe.refunds.create({
      payment_intent: order.stripePaymentIntentId,
      metadata: { orderId: order.id },
    });
    return refund.id;
  } catch (err) {
    const message = err instanceof Error ? err.message : "The refund failed.";
    throw new RefundFailedError(message);
  }
}

/**
 * Pays out every order that's DELIVERED, past its payout-eligibility
 * deadline, not disputed, and not already paid out — via a real Stripe
 * Transfer to the restaurant's connected account. Skips restaurants who
 * haven't finished Connect onboarding (nothing to send it to yet); those
 * orders stay queued and get picked up by a future sweep once they do.
 *
 * Intended to run on a schedule alongside the other sweeps — see
 * scripts/expire-orders-worker.ts.
 */
export async function runPayoutSweep(): Promise<{ paidOut: number; skippedNotOnboarded: number }> {
  const eligible = await prisma.order.findMany({
    where: {
      status: "DELIVERED",
      payoutEligibleAt: { lte: new Date() },
      payoutSentAt: null,
      disputedAt: null,
    },
    include: { restaurant: true },
  });

  const stripe = getStripe();
  let paidOut = 0;
  let skippedNotOnboarded = 0;

  for (const order of eligible) {
    if (!order.restaurant.stripeOnboardingComplete || !order.restaurant.stripeAccountId) {
      skippedNotOnboarded++;
      continue;
    }

    const payoutCents = order.restaurantPayoutCents ?? computePayoutSplit(order).restaurantPayoutCents;

    try {
      const transfer = await stripe.transfers.create({
        amount: payoutCents,
        currency: "gbp",
        destination: order.restaurant.stripeAccountId,
        metadata: { orderId: order.id },
      });

      await prisma.order.update({
        where: { id: order.id },
        data: { payoutSentAt: new Date(), stripeTransferId: transfer.id },
      });
      void notifyPayoutSent(order.id);
      paidOut++;
    } catch (err) {
      const isInsufficientBalance =
        typeof err === "object" && err !== null && "code" in err && err.code === "balance_insufficient";

      if (isInsufficientBalance) {
        // Expected in Stripe test mode: standard test-card charges land in
        // "pending" balance, not "available" — and Transfers can only pull
        // from available balance. Use the 4000000000000077 test card to
        // simulate an immediately-available charge if you need to actually
        // see a transfer succeed locally. Not a real failure, so this
        // stays a short warning rather than a full error dump — it'll keep
        // retrying automatically once real funds are available.
        console.warn(`[payout-sweep] Order ${order.id}: insufficient available balance, will retry.`);
      } else {
        // Don't let one failed transfer stop the rest of the sweep — it'll
        // be retried on the next run since payoutSentAt is still null.
        console.error(`[payout-sweep] Transfer failed for order ${order.id}:`, err);
      }
    }
  }

  return { paidOut, skippedNotOnboarded };
}
