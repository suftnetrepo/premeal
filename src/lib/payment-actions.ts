import { prisma } from "@/lib/db";
import { OrderStatus } from "@prisma/client";
import { releaseSlot } from "@/lib/capacity";
import { computePayoutSplit, checkPaymentActionStatus, getPaymentActionClientSecret } from "@/lib/payments";

export class NotAuthorizedError extends Error {
  constructor(message = "Not authorized for this order") {
    super(message);
    this.name = "NotAuthorizedError";
  }
}

export class OrderStatusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderStatusError";
  }
}

/** For the customer's order page — lets them mount Stripe's 3DS challenge. */
export async function getClientSecretForOrder(orderId: string, customerId: string): Promise<string> {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.customerId !== customerId) throw new NotAuthorizedError();
  if (order.status !== OrderStatus.PAYMENT_ACTION_REQUIRED || !order.stripePaymentIntentId) {
    throw new OrderStatusError("This order isn't waiting on payment verification.");
  }
  return getPaymentActionClientSecret(order.stripePaymentIntentId);
}

/**
 * Called after the customer's browser completes (or attempts) the 3D
 * Secure challenge. Re-verifies directly with Stripe rather than trusting
 * the client, then finalizes the order exactly like a normal confirmation
 * — same payout-split computation, same CONFIRMED status.
 */
export async function completePaymentAction(orderId: string, customerId: string) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.customerId !== customerId) throw new NotAuthorizedError();
  if (order.status !== OrderStatus.PAYMENT_ACTION_REQUIRED || !order.stripePaymentIntentId) {
    throw new OrderStatusError("This order isn't waiting on payment verification.");
  }

  const result = await checkPaymentActionStatus(order.stripePaymentIntentId);

  if (result === "still_requires_action") {
    // Customer closed the challenge without completing it — leave the
    // order as-is so they can retry from the same order page.
    return { status: "still_requires_action" as const };
  }

  if (result === "failed") {
    return prisma.$transaction(async (tx) => {
      const fresh = await tx.order.findUnique({ where: { id: orderId } });
      if (!fresh || fresh.status !== OrderStatus.PAYMENT_ACTION_REQUIRED) {
        return { status: "failed" as const };
      }
      await releaseSlot(tx, fresh.slotId);
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.DECLINED,
          declinedAt: new Date(),
          failureReason: "Card verification failed.",
        },
      });
      return { status: "failed" as const };
    });
  }

  // result === "succeeded"
  return prisma.$transaction(async (tx) => {
    const fresh = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (fresh.status !== OrderStatus.PAYMENT_ACTION_REQUIRED) {
      return { status: "succeeded" as const, order: fresh };
    }

    const { platformFeeCents, restaurantPayoutCents } = computePayoutSplit(fresh);
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CONFIRMED,
        confirmedAt: new Date(),
        platformFeeCents,
        restaurantPayoutCents,
      },
    });
    return { status: "succeeded" as const, order: updated };
  });
}

/**
 * Safety-net sweep: if a customer never comes back to complete 3D Secure,
 * the order can't sit in limbo forever holding a delivery slot. Auto-
 * expires it — nothing was ever actually charged, so there's no refund
 * needed, just releasing the capacity. Intended to run alongside the
 * other sweeps in scripts/expire-orders-worker.ts.
 */
export async function expirePaymentActions(): Promise<number> {
  const stale = await prisma.order.findMany({
    where: {
      status: OrderStatus.PAYMENT_ACTION_REQUIRED,
      paymentActionDeadline: { lt: new Date() },
    },
    select: { id: true },
  });

  for (const { id } of stale) {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id } });
      if (!order || order.status !== OrderStatus.PAYMENT_ACTION_REQUIRED) return;

      await releaseSlot(tx, order.slotId);
      await tx.order.update({
        where: { id },
        data: {
          status: OrderStatus.EXPIRED,
          expiredAt: new Date(),
          failureReason: "Payment verification wasn't completed in time.",
        },
      });
    });
  }

  return stale.length;
}
