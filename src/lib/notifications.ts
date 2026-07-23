import { prisma } from "@/lib/db";
import { sendEmail, EmailNotConfiguredError } from "@/lib/email";
import { formatMoney, formatDate } from "@/lib/format";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function wrap(bodyHtml: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #111;">
      <p style="color: #D85A30; font-weight: 600; margin-bottom: 16px;">Pre-Meal</p>
      ${bodyHtml}
    </div>
  `;
}

/**
 * One email, isolated from its siblings — if notifyOrderPlaced sends to
 * both a customer and a restaurant owner, one failing shouldn't stop the
 * other from going out. Quietly no-ops if Brevo isn't configured (Brevo
 * being unconfigured is an expected dev-mode state, not a bug worth a log
 * line every time).
 */
async function safeSend(to: string, subject: string, html: string, context: string) {
  try {
    await sendEmail(to, subject, wrap(html));
  } catch (err) {
    if (err instanceof EmailNotConfiguredError) return;
    console.error(`[notifications] "${context}" to ${to} failed:`, err);
  }
}

const orderEmailInclude = {
  customer: true,
  restaurant: { include: { owner: true } },
  items: true,
  slot: true,
} as const;

type OrderForEmail = NonNullable<Awaited<ReturnType<typeof loadOrderForEmail>>>;

async function loadOrderForEmail(orderId: string) {
  return prisma.order.findUnique({ where: { id: orderId }, include: orderEmailInclude });
}

function itemsSummary(order: OrderForEmail): string {
  return order.items.map((i) => `${i.nameSnapshot} ×${i.quantity}`).join(", ");
}

function orderLink(orderId: string): string {
  return `${APP_URL}/orders/${orderId}`;
}

// ---------------------------------------------------------------------------
// Each function below wraps its entire body in try/catch — it should be
// impossible for calling code to ever need its own try/catch around one of
// these; `void notifyX(id)` is always safe to fire-and-forget.
// ---------------------------------------------------------------------------

/** Order placed — one email to the customer, one to the restaurant owner (who now has 30 minutes to respond). */
export async function notifyOrderPlaced(orderId: string): Promise<void> {
  try {
    const order = await loadOrderForEmail(orderId);
    if (!order) return;

    await safeSend(
      order.customer.email,
      `Order placed at ${order.restaurant.name}`,
      `<p>Hi ${order.customer.name},</p>
       <p>We've sent your order to <strong>${order.restaurant.name}</strong> for
       ${formatDate(order.slot.date)}, ${order.slot.windowStart}–${order.slot.windowEnd}.</p>
       <p>${itemsSummary(order)} — ${formatMoney(order.totalCents)}</p>
       <p>They'll respond within 30 minutes. You won't be charged until they confirm.</p>
       <p><a href="${orderLink(order.id)}">Track your order</a></p>`,
      "order placed (customer)"
    );

    await safeSend(
      order.restaurant.owner.email,
      "New order — respond within 30 minutes",
      `<p>New order from ${order.customer.name} for
       ${formatDate(order.slot.date)}, ${order.slot.windowStart}–${order.slot.windowEnd}.</p>
       <p>${itemsSummary(order)} — ${formatMoney(order.totalCents)}</p>
       <p>Unanswered orders auto-decline and refund after 30 minutes.</p>
       <p><a href="${APP_URL}/restaurant/dashboard">Respond now</a></p>`,
      "new order (restaurant)"
    );
  } catch (err) {
    console.error(`[notifications] notifyOrderPlaced failed for order ${orderId}:`, err);
  }
}

/** Restaurant accepted and the card was charged. */
export async function notifyOrderConfirmed(orderId: string): Promise<void> {
  try {
    const order = await loadOrderForEmail(orderId);
    if (!order) return;

    await safeSend(
      order.customer.email,
      `Confirmed — ${order.restaurant.name}`,
      `<p>Hi ${order.customer.name},</p>
       <p><strong>${order.restaurant.name}</strong> confirmed your order for
       ${formatDate(order.slot.date)}, ${order.slot.windowStart}–${order.slot.windowEnd}.</p>
       <p>Your card was charged ${formatMoney(order.totalCents)}.</p>
       <p><a href="${orderLink(order.id)}">View your order</a></p>`,
      "order confirmed"
    );
  } catch (err) {
    console.error(`[notifications] notifyOrderConfirmed failed for order ${orderId}:`, err);
  }
}

/** Restaurant declined, or the charge failed — either way, no charge went through. */
export async function notifyOrderDeclined(orderId: string): Promise<void> {
  try {
    const order = await loadOrderForEmail(orderId);
    if (!order) return;

    await safeSend(
      order.customer.email,
      `Couldn't take your order — ${order.restaurant.name}`,
      `<p>Hi ${order.customer.name},</p>
       <p><strong>${order.restaurant.name}</strong> couldn't take your order for
       ${formatDate(order.slot.date)}.${order.failureReason ? ` (${order.failureReason})` : ""}</p>
       <p>You have not been charged.</p>
       <p><a href="${APP_URL}">Browse other restaurants</a></p>`,
      "order declined"
    );
  } catch (err) {
    console.error(`[notifications] notifyOrderDeclined failed for order ${orderId}:`, err);
  }
}

/** Restaurant never responded within 30 minutes — auto-declined by the worker sweep. */
export async function notifyOrderExpired(orderId: string): Promise<void> {
  try {
    const order = await loadOrderForEmail(orderId);
    if (!order) return;

    await safeSend(
      order.customer.email,
      `No response in time — ${order.restaurant.name}`,
      `<p>Hi ${order.customer.name},</p>
       <p><strong>${order.restaurant.name}</strong> didn't respond to your order in time, so it was
       automatically declined. You have not been charged.</p>
       <p><a href="${APP_URL}">Browse other restaurants</a></p>`,
      "order expired (customer)"
    );

    await safeSend(
      order.restaurant.owner.email,
      "You missed an order",
      `<p>An order from ${order.customer.name} auto-declined because it wasn't answered within 30 minutes.
       The customer wasn't charged.</p>
       <p>Keep an eye on <a href="${APP_URL}/restaurant/dashboard">your dashboard</a> so this doesn't
       happen again.</p>`,
      "order expired (restaurant)"
    );
  } catch (err) {
    console.error(`[notifications] notifyOrderExpired failed for order ${orderId}:`, err);
  }
}

/** Off-session charge needs 3D Secure — customer needs to come back and approve it. */
export async function notifyPaymentActionRequired(orderId: string): Promise<void> {
  try {
    const order = await loadOrderForEmail(orderId);
    if (!order) return;

    await safeSend(
      order.customer.email,
      "Action needed to complete your order",
      `<p>Hi ${order.customer.name},</p>
       <p><strong>${order.restaurant.name}</strong> accepted your order, but your bank needs you to verify
       the payment before it's final.</p>
       <p><a href="${orderLink(order.id)}">Verify now</a></p>`,
      "payment action required"
    );
  } catch (err) {
    console.error(`[notifications] notifyPaymentActionRequired failed for order ${orderId}:`, err);
  }
}

export async function notifyOutForDelivery(orderId: string): Promise<void> {
  try {
    const order = await loadOrderForEmail(orderId);
    if (!order) return;

    await safeSend(
      order.customer.email,
      `On its way — ${order.restaurant.name}`,
      `<p>Hi ${order.customer.name},</p>
       <p>Your order from <strong>${order.restaurant.name}</strong> is out for delivery.</p>
       <p><a href="${orderLink(order.id)}">Track your order</a></p>`,
      "out for delivery"
    );
  } catch (err) {
    console.error(`[notifications] notifyOutForDelivery failed for order ${orderId}:`, err);
  }
}

export async function notifyDelivered(orderId: string): Promise<void> {
  try {
    const order = await loadOrderForEmail(orderId);
    if (!order) return;

    await safeSend(
      order.customer.email,
      `Delivered — enjoy! ${order.restaurant.name}`,
      `<p>Hi ${order.customer.name},</p>
       <p>Your order from <strong>${order.restaurant.name}</strong> has been delivered. Enjoy!</p>
       <p><a href="${orderLink(order.id)}">Leave a review</a></p>`,
      "delivered"
    );
  } catch (err) {
    console.error(`[notifications] notifyDelivered failed for order ${orderId}:`, err);
  }
}

/** Covers both customer-initiated and restaurant-initiated cancellation. */
export async function notifyOrderCancelled(orderId: string): Promise<void> {
  try {
    const order = await loadOrderForEmail(orderId);
    if (!order) return;

    const wasRefunded = Boolean(order.refundedAt);
    const refundLine = wasRefunded
      ? "<p>You've been refunded in full.</p>"
      : "<p>You hadn't been charged yet, so there's nothing to refund.</p>";

    if (order.cancelledByRestaurant) {
      await safeSend(
        order.customer.email,
        `Order cancelled — ${order.restaurant.name}`,
        `<p>Hi ${order.customer.name},</p>
         <p><strong>${order.restaurant.name}</strong> had to cancel your order.${
           order.restaurantCancelReason ? ` Reason given: ${order.restaurantCancelReason}` : ""
         }</p>
         ${refundLine}`,
        "order cancelled by restaurant (customer)"
      );
    } else {
      await safeSend(
        order.customer.email,
        `Order cancelled — ${order.restaurant.name}`,
        `<p>Hi ${order.customer.name},</p>
         <p>Your order at <strong>${order.restaurant.name}</strong> has been cancelled.</p>
         ${refundLine}`,
        "order cancelled by customer (customer)"
      );
      await safeSend(
        order.restaurant.owner.email,
        "A customer cancelled their order",
        `<p>${order.customer.name} cancelled their order for
         ${formatDate(order.slot.date)}, ${order.slot.windowStart}–${order.slot.windowEnd}.</p>`,
        "order cancelled by customer (restaurant)"
      );
    }
  } catch (err) {
    console.error(`[notifications] notifyOrderCancelled failed for order ${orderId}:`, err);
  }
}

export async function notifyRestaurantApproved(restaurantId: string): Promise<void> {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: { owner: true },
    });
    if (!restaurant) return;

    await safeSend(
      restaurant.owner.email,
      "You're approved!",
      `<p>Hi ${restaurant.owner.name},</p>
       <p><strong>${restaurant.name}</strong> has been approved. Once your menu, delivery days, and
       signup fee are all set, you'll be live for customers to find.</p>
       <p><a href="${APP_URL}/restaurant/dashboard">Go to your dashboard</a></p>`,
      "restaurant approved"
    );
  } catch (err) {
    console.error(`[notifications] notifyRestaurantApproved failed for restaurant ${restaurantId}:`, err);
  }
}

export async function notifyRestaurantRejected(restaurantId: string): Promise<void> {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: { owner: true },
    });
    if (!restaurant) return;

    await safeSend(
      restaurant.owner.email,
      "Your application wasn't approved",
      `<p>Hi ${restaurant.owner.name},</p>
       <p><strong>${restaurant.name}</strong> wasn't approved.${
         restaurant.approvalNote ? ` Reason given: ${restaurant.approvalNote}` : ""
       }</p>`,
      "restaurant rejected"
    );
  } catch (err) {
    console.error(`[notifications] notifyRestaurantRejected failed for restaurant ${restaurantId}:`, err);
  }
}

/** Admin resolved a "report a problem" dispute — let both sides know the outcome. */
export async function notifyDisputeResolved(orderId: string): Promise<void> {
  try {
    const order = await loadOrderForEmail(orderId);
    if (!order) return;

    const wasRefunded = Boolean(order.refundedAt);

    await safeSend(
      order.customer.email,
      "Update on the problem you reported",
      wasRefunded
        ? `<p>Hi ${order.customer.name},</p><p>We've reviewed the problem you reported and issued a full refund.</p>`
        : `<p>Hi ${order.customer.name},</p><p>We've reviewed the problem you reported. After looking into it, we've closed this out without a refund.</p>`,
      "dispute resolved (customer)"
    );

    await safeSend(
      order.restaurant.owner.email,
      "A dispute on one of your orders was resolved",
      wasRefunded
        ? `<p>The customer for order ${order.id} was refunded after reporting a problem. This order's payout won't be paid out.</p>`
        : `<p>The dispute on order ${order.id} was resolved in your favor — its payout will proceed normally.</p>`,
      "dispute resolved (restaurant)"
    );
  } catch (err) {
    console.error(`[notifications] notifyDisputeResolved failed for order ${orderId}:`, err);
  }
}

/** A real Stripe Transfer just went out to this restaurant for this order. */
export async function notifyPayoutSent(orderId: string): Promise<void> {
  try {
    const order = await loadOrderForEmail(orderId);
    if (!order || order.restaurantPayoutCents === null) return;

    await safeSend(
      order.restaurant.owner.email,
      `You've been paid ${formatMoney(order.restaurantPayoutCents)}`,
      `<p>Hi ${order.restaurant.owner.name},</p>
       <p>You've been paid <strong>${formatMoney(order.restaurantPayoutCents)}</strong> for the order
       delivered to ${order.customer.name} on ${formatDate(order.slot.date)}.</p>`,
      "payout sent"
    );
  } catch (err) {
    console.error(`[notifications] notifyPayoutSent failed for order ${orderId}:`, err);
  }
}

/**
 * Account-lifecycle emails — takes the user object and raw token directly
 * rather than an ID to re-fetch by, since the raw token only exists at
 * generation time (it's never stored, only its hash is) and the caller
 * (src/lib/account-verification.ts, src/lib/password-reset.ts) always
 * already has the fresh user record.
 */
export async function notifyEmailVerification(user: { email: string; name: string }, token: string): Promise<void> {
  try {
    await safeSend(
      user.email,
      "Verify your email",
      `<p>Hi ${user.name},</p>
       <p>Confirm this is your email address to finish setting up your account.</p>
       <p><a href="${APP_URL}/verify-email?token=${token}">Verify email</a></p>
       <p style="color:#888; font-size: 12px;">This link expires in 24 hours.</p>`,
      "email verification"
    );
  } catch (err) {
    console.error(`[notifications] notifyEmailVerification failed for ${user.email}:`, err);
  }
}

export async function notifyPasswordReset(user: { email: string; name: string }, token: string): Promise<void> {
  try {
    await safeSend(
      user.email,
      "Reset your password",
      `<p>Hi ${user.name},</p>
       <p>Someone requested a password reset for this account. If that wasn't you, you can ignore this email.</p>
       <p><a href="${APP_URL}/reset-password?token=${token}">Reset password</a></p>
       <p style="color:#888; font-size: 12px;">This link expires in 30 minutes.</p>`,
      "password reset"
    );
  } catch (err) {
    console.error(`[notifications] notifyPasswordReset failed for ${user.email}:`, err);
  }
}
