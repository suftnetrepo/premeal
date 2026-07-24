import { prisma } from "@/lib/db";
import { OrderStatus } from "@prisma/client";
import { notifyOutForDelivery, notifyDelivered } from "@/lib/notifications";

/**
 * Delivery lifecycle, after confirmation:
 *
 *   CONFIRMED --(restaurant dispatches)--> OUT_FOR_DELIVERY --(delivered)--> DELIVERED
 *
 * A restaurant marks "out for delivery" and "delivered" manually. As a
 * safety net (a restaurant could otherwise just never click "delivered" to
 * indefinitely stall a customer's ability to dispute), an order left
 * OUT_FOR_DELIVERY for too long auto-completes — see autoCompleteDeliveries().
 *
 * DELIVERED starts a payout-eligibility clock (PAYOUT_GRACE_PERIOD_HOURS).
 * A customer can report a problem any time from dispatch up to that
 * deadline; doing so clears payoutEligibleAt so the (future) Stripe payout
 * job won't pick the order up. No dispute in that window = paid
 * automatically. This mirrors how most marketplaces (eBay, Amazon) default
 * to trusting the seller but give the buyer a time-boxed override.
 */

export const AUTO_DELIVER_AFTER_HOURS = 3;
export const PAYOUT_GRACE_PERIOD_HOURS = 24;

export class OrderStatusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderStatusError";
  }
}

export class NotAuthorizedError extends Error {
  constructor(message = "Not authorized for this order") {
    super(message);
    this.name = "NotAuthorizedError";
  }
}

/** Restaurant owner or the order's assigned driver dispatches the order. */
export async function markOutForDelivery(orderId: string, userId: string) {
  const order = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { restaurant: true },
    });
    if (order.restaurant.ownerId !== userId && order.driverId !== userId) throw new NotAuthorizedError();
    if (order.status !== OrderStatus.CONFIRMED) {
      throw new OrderStatusError(`Order is "${order.status}", not confirmed — can't dispatch it.`);
    }

    return tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.OUT_FOR_DELIVERY, outForDeliveryAt: new Date() },
    });
  });

  void notifyOutForDelivery(orderId);
  return order;
}

/** Restaurant owner or the order's assigned driver marks delivered. Starts the payout-eligibility clock. */
export async function markDelivered(orderId: string, userId: string) {
  const order = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { restaurant: true },
    });
    if (order.restaurant.ownerId !== userId && order.driverId !== userId) throw new NotAuthorizedError();
    if (order.status !== OrderStatus.OUT_FOR_DELIVERY) {
      throw new OrderStatusError(`Order is "${order.status}", not out for delivery yet.`);
    }

    const now = new Date();
    return tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.DELIVERED,
        deliveredAt: now,
        payoutEligibleAt: new Date(now.getTime() + PAYOUT_GRACE_PERIOD_HOURS * 60 * 60 * 1000),
      },
    });
  });

  void notifyDelivered(orderId);
  return order;
}

/**
 * Customer reports a problem. Valid from the moment an order is dispatched
 * up until the payout grace period runs out after delivery — after that,
 * the payout may have already gone out (a later dispute at that point is a
 * different, harder problem — see the "aggregate output" note in the
 * README on Stripe Connect reversals).
 */
export async function reportProblem(orderId: string, customerId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.customerId !== customerId) throw new NotAuthorizedError();

    const reportableStatuses: OrderStatus[] = [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED];
    if (!reportableStatuses.includes(order.status)) {
      throw new OrderStatusError(`Can't report a problem on an order that's "${order.status}".`);
    }
    if (order.payoutEligibleAt && order.payoutEligibleAt < new Date()) {
      throw new OrderStatusError("The window to report a problem on this order has passed.");
    }
    if (order.disputedAt) {
      throw new OrderStatusError("A problem has already been reported on this order.");
    }

    return tx.order.update({
      where: { id: orderId },
      data: {
        disputedAt: new Date(),
        disputeReason: reason,
        payoutEligibleAt: null, // pulls it out of the payout queue
      },
    });
  });
}

/**
 * Safety-net sweep: an order stuck OUT_FOR_DELIVERY for too long (restaurant
 * never clicked "delivered") auto-completes so the customer isn't left
 * unable to ever report a problem or see closure. Intended to run
 * alongside expireStaleOrders() in the same worker/cron.
 */
export async function autoCompleteDeliveries(): Promise<number> {
  const cutoff = new Date(Date.now() - AUTO_DELIVER_AFTER_HOURS * 60 * 60 * 1000);

  const stuck = await prisma.order.findMany({
    where: { status: OrderStatus.OUT_FOR_DELIVERY, outForDeliveryAt: { lt: cutoff } },
    select: { id: true },
  });

  for (const { id } of stuck) {
    const completed = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id } });
      if (!order || order.status !== OrderStatus.OUT_FOR_DELIVERY) return null;

      const now = new Date();
      return tx.order.update({
        where: { id },
        data: {
          status: OrderStatus.DELIVERED,
          deliveredAt: now,
          payoutEligibleAt: new Date(now.getTime() + PAYOUT_GRACE_PERIOD_HOURS * 60 * 60 * 1000),
        },
      });
    });

    if (completed) void notifyDelivered(id);
  }

  return stuck.length;
}
