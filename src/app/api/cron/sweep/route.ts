import { NextResponse } from "next/server";
import { expireStaleOrders } from "@/lib/capacity";
import { autoCompleteDeliveries } from "@/lib/delivery";
import { expirePaymentActions } from "@/lib/payment-actions";
import { runPayoutSweep } from "@/lib/payments";
import { processEmailQueue } from "@/lib/email";
import { StripeNotConfiguredError } from "@/lib/stripe";

/**
 * The serverless-compatible replacement for scripts/expire-orders-worker.ts
 * — that script is a persistent local process, which doesn't exist as a
 * concept on Vercel (or most serverless hosts). This does the same work,
 * triggered externally instead of on its own internal timer.
 *
 * Protected by CRON_SECRET, checked as either `Authorization: Bearer
 * <secret>` (Vercel's own convention, used when vercel.json's crons entry
 * calls this) or a `?secret=` query param (for schedulers that can't
 * easily set custom headers) — without this, anyone who found the URL
 * could trigger a payout sweep or repeatedly hammer Stripe/Brevo.
 *
 * IMPORTANT: Vercel's free Hobby tier only allows cron jobs to run once a
 * day, which is nowhere near frequent enough for this app's 30-minute
 * confirmation windows. The vercel.json entry is a daily fallback; the
 * real trigger for a test/production deployment should be a more
 * frequent external scheduler (a GitHub Actions workflow is included in
 * this repo, see .github/workflows/sweep.yml) hitting this same route
 * every few minutes.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);
  const providedViaHeader = authHeader === `Bearer ${secret}`;
  const providedViaQuery = searchParams.get("secret") === secret;

  if (!providedViaHeader && !providedViaQuery) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  try {
    results.expiredOrders = await expireStaleOrders();
  } catch (err) {
    results.expiredOrders = { error: String(err) };
  }

  try {
    results.autoCompletedDeliveries = await autoCompleteDeliveries();
  } catch (err) {
    results.autoCompletedDeliveries = { error: String(err) };
  }

  try {
    results.expiredPaymentActions = await expirePaymentActions();
  } catch (err) {
    results.expiredPaymentActions = { error: String(err) };
  }

  try {
    results.emailQueue = await processEmailQueue();
  } catch (err) {
    results.emailQueue = { error: String(err) };
  }

  try {
    results.payoutSweep = await runPayoutSweep();
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) {
      results.payoutSweep = { skipped: "Stripe not configured" };
    } else {
      results.payoutSweep = { error: String(err) };
    }
  }

  return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), results });
}
