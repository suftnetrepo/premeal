import { getStripe, appUrl } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import type { Restaurant } from "@prisma/client";

/** Creates a Stripe Express account for a restaurant if it doesn't have one yet. */
async function getOrCreateConnectAccount(restaurant: Restaurant): Promise<string> {
  if (restaurant.stripeAccountId) return restaurant.stripeAccountId;

  const stripe = getStripe();
  const account = await stripe.accounts.create({
    type: "express",
    country: "GB",
    business_type: "individual",
    capabilities: {
      // Only transfers — this account never processes a card charge
      // directly (that happens on the platform's account, see
      // src/lib/payments.ts), it only ever *receives* a Transfer.
      // Requesting card_payments here was unnecessary and could stall
      // onboarding on a capability we don't use.
      transfers: { requested: true },
    },
    metadata: { restaurantId: restaurant.id },
  });

  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { stripeAccountId: account.id },
  });

  return account.id;
}

/**
 * Returns a one-time-use URL to Stripe's hosted onboarding flow. The
 * restaurant is redirected back to /restaurant/payouts either way —
 * refresh_url is used if the link expired before they finished, return_url
 * is where they land after actually completing (or abandoning) it.
 */
export async function createOnboardingLink(restaurant: Restaurant): Promise<string> {
  const stripe = getStripe();
  const accountId = await getOrCreateConnectAccount(restaurant);

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl()}/restaurant/payouts`,
    return_url: `${appUrl()}/restaurant/payouts`,
    type: "account_onboarding",
  });

  return accountLink.url;
}

/** Re-checks a restaurant's Connect account and updates our cached "is it ready" flag. */
export async function refreshOnboardingStatus(restaurant: Restaurant): Promise<boolean> {
  if (!restaurant.stripeAccountId) return false;

  const stripe = getStripe();
  const account = await stripe.accounts.retrieve(restaurant.stripeAccountId);
  // payouts_enabled, not charges_enabled — this account only ever
  // *receives* a Transfer, it never processes a card charge directly, so
  // its ability to accept card payments isn't what we're waiting on.
  const complete = Boolean(account.details_submitted && account.payouts_enabled);

  if (complete !== restaurant.stripeOnboardingComplete) {
    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { stripeOnboardingComplete: complete },
    });
  }

  return complete;
}
