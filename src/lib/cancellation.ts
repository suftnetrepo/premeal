import { prisma } from "@/lib/db";
import { OrderStatus } from "@prisma/client";
import { releaseSlot } from "@/lib/capacity";
import { refundOrder } from "@/lib/payments";
import { notifyOrderCancelled } from "@/lib/notifications";

export class NotAuthorizedError extends Error {
  constructor(message = "Not authorized for this order") {
    super(message);
    this.name = "NotAuthorizedError";
  }
}

export class CannotCancelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CannotCancelError";
  }
}

// Cancellable right up until the restaurant actually dispatches it. No
// partial-refund/store-credit tiers like the original spec's 48h/24h
// windows — this is a simpler "free before charged, full refund after,
// blocked once it's out the door" policy. See README for the tradeoff.
const CANCELLABLE_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING_CONFIRMATION,
  OrderStatus.PAYMENT_ACTION_REQUIRED,
  OrderStatus.CONFIRMED,
];

export async function cancelOrder(orderId: string, customerId: string) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.customerId !== customerId) throw new NotAuthorizedError();

  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    throw new CannotCancelError(
      order.status === OrderStatus.OUT_FOR_DELIVERY || order.status === OrderStatus.DELIVERED
        ? "This order is already out for delivery — use \"report a problem\" instead if something's wrong."
        : `This order is already "${order.status.toLowerCase()}" and can't be cancelled.`
    );
  }

  // Was it ever actually charged? Only CONFIRMED (and anything that came
  // after it, but those are excluded above) means a real charge happened.
  const wasCharged = order.status === OrderStatus.CONFIRMED && order.stripePaymentIntentId;

  let refundId: string | null = null;
  if (wasCharged) {
    // Do the refund before touching the DB — if Stripe rejects it, the
    // order should stay exactly as it was, not end up cancelled with no
    // refund actually issued.
    refundId = await refundOrder(order);
  }

  const cancelled = await prisma.$transaction(async (tx) => {
    const fresh = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (!CANCELLABLE_STATUSES.includes(fresh.status)) {
      // Status changed in the (small) window while we were talking to
      // Stripe — e.g. the restaurant dispatched it a moment ago. The
      // refund above (if any) already went through regardless; that's the
      // safer failure mode compared to charging ahead with a DB update
      // that contradicts what actually happened.
      throw new CannotCancelError("This order's status changed while your cancellation was processing.");
    }

    // Cancelling always frees the slot back up, regardless of which state
    // the order was cancelled from — one fewer meal for the restaurant to
    // prepare means one more spot open for someone else to book.
    await releaseSlot(tx, fresh.slotId);

    return tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        ...(refundId ? { stripeRefundId: refundId, refundedAt: new Date() } : {}),
      },
    });
  });

  void notifyOrderCancelled(orderId);
  return cancelled;
}

// A restaurant backing out only makes sense once they've already accepted
// an order — before that, "Decline" already covers "no". Same cutoff as
// the customer side: once it's actually out the door, this isn't the
// right tool anymore.
const RESTAURANT_CANCELLABLE_STATUSES: OrderStatus[] = [OrderStatus.CONFIRMED];

export async function restaurantCancelOrder(orderId: string, ownerId: string, reason: string) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { restaurant: true },
  });
  if (order.restaurant.ownerId !== ownerId) throw new NotAuthorizedError();

  if (!RESTAURANT_CANCELLABLE_STATUSES.includes(order.status)) {
    throw new CannotCancelError(
      order.status === OrderStatus.PENDING_CONFIRMATION || order.status === OrderStatus.PAYMENT_ACTION_REQUIRED
        ? "Use \"Decline\" instead — this order hasn't been accepted yet."
        : order.status === OrderStatus.OUT_FOR_DELIVERY || order.status === OrderStatus.DELIVERED
          ? "This order is already out for delivery and can't be cancelled from here."
          : `This order is already "${order.status.toLowerCase()}" and can't be cancelled.`
    );
  }

  // A confirmed order was definitely charged — always refund in full.
  const refundId = await refundOrder(order);

  const cancelled = await prisma.$transaction(async (tx) => {
    const fresh = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (!RESTAURANT_CANCELLABLE_STATUSES.includes(fresh.status)) {
      throw new CannotCancelError("This order's status changed while your cancellation was processing.");
    }

    await releaseSlot(tx, fresh.slotId);

    return tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledByRestaurant: true,
        restaurantCancelReason: reason,
        stripeRefundId: refundId,
        refundedAt: new Date(),
      },
    });
  });

  void notifyOrderCancelled(orderId);
  return cancelled;
}
