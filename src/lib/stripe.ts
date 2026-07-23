import Stripe from "stripe";

export class StripeNotConfiguredError extends Error {
  constructor() {
    super("STRIPE_SECRET_KEY is not set. Add test-mode keys to .env — see the README.");
    this.name = "StripeNotConfiguredError";
  }
}

let cached: Stripe | null = null;

/** Lazy singleton so importing this file doesn't throw when Stripe isn't configured yet. */
export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeNotConfiguredError();
  // No explicit apiVersion — let the installed SDK use the version it was
  // built and tested against, rather than pinning to a string here that
  // could drift out of sync with the SDK version over time.
  cached = new Stripe(key);
  return cached;
}

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
