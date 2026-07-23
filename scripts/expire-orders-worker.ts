/**
 * Dev stand-in for a production cron/queue.
 * Run alongside `npm run dev` with `npm run worker` in a second terminal.
 * Every 30 seconds it:
 *  - sweeps orders whose 30-minute confirmation window has passed with no
 *    restaurant response, auto-declining them and releasing their capacity;
 *  - sweeps orders stuck "out for delivery" for too long (restaurant never
 *    marked them delivered) and auto-completes them, so a customer isn't
 *    left unable to report a problem or see closure indefinitely;
 *  - sweeps orders stuck needing 3D Secure verification for too long
 *    (customer never came back to approve the charge) and auto-expires
 *    them, releasing capacity — nothing was ever charged, so no refund
 *    is needed;
 *  - retries any emails that failed to send on their first attempt (see
 *    src/lib/email.ts) — the common case (Resend is up) never adds
 *    anything to this queue at all;
 *  - pays out restaurants for delivered orders past their dispute window
 *    via real Stripe Transfers (skipped gracefully if Stripe isn't
 *    configured yet — see the try/catch below).
 *
 * In production, replace this with:
 *  - Vercel Cron calling scheduled endpoints, or
 *  - a small worker process/queue consumer running these same functions.
 */
import { expireStaleOrders } from "../src/lib/capacity";
import { autoCompleteDeliveries } from "../src/lib/delivery";
import { expirePaymentActions } from "../src/lib/payment-actions";
import { runPayoutSweep } from "../src/lib/payments";
import { processEmailQueue } from "../src/lib/email";
import { StripeNotConfiguredError } from "../src/lib/stripe";

const INTERVAL_MS = 30_000;

async function tick() {
  try {
    const expiredCount = await expireStaleOrders();
    if (expiredCount > 0) {
      console.log(`[worker] auto-declined ${expiredCount} expired order(s)`);
    }
    const completedCount = await autoCompleteDeliveries();
    if (completedCount > 0) {
      console.log(`[worker] auto-completed ${completedCount} stuck "out for delivery" order(s)`);
    }
    const paymentActionExpiredCount = await expirePaymentActions();
    if (paymentActionExpiredCount > 0) {
      console.log(`[worker] auto-expired ${paymentActionExpiredCount} order(s) awaiting payment verification`);
    }
  } catch (err) {
    console.error("[worker] sweep failed:", err);
  }

  try {
    const { sent, failed, gaveUp } = await processEmailQueue();
    if (sent > 0) console.log(`[worker] retried and sent ${sent} queued email(s)`);
    if (failed > 0) console.log(`[worker] ${failed} queued email(s) still failing, will retry again`);
    if (gaveUp > 0) console.log(`[worker] gave up on ${gaveUp} email(s) after max attempts — see EmailQueueItem.lastError`);
  } catch (err) {
    console.error("[worker] email queue processing failed:", err);
  }

  try {
    const { paidOut, skippedNotOnboarded } = await runPayoutSweep();
    if (paidOut > 0) {
      console.log(`[worker] paid out ${paidOut} restaurant transfer(s)`);
    }
    if (skippedNotOnboarded > 0) {
      console.log(`[worker] ${skippedNotOnboarded} order(s) waiting on restaurant payout setup`);
    }
  } catch (err) {
    if (err instanceof StripeNotConfiguredError) {
      // Quiet skip — expected until STRIPE_SECRET_KEY is set.
    } else {
      console.error("[worker] payout sweep failed:", err);
    }
  }
}

console.log(`[worker] running every ${INTERVAL_MS / 1000}s — Ctrl+C to stop`);
tick();
setInterval(tick, INTERVAL_MS);
