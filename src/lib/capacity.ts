import { prisma } from "@/lib/db";
import { Prisma, OrderStatus } from "@prisma/client";
import { chargeOrderOnConfirm, computePayoutSplit, PaymentRequiresActionError } from "@/lib/payments";
import { applyPromoCode } from "@/lib/promotions";
import { notifyOrderPlaced, notifyOrderConfirmed, notifyOrderDeclined, notifyPaymentActionRequired, notifyOrderExpired } from "@/lib/notifications";
import { geocodeAddress } from "@/lib/geocoding";
import { distanceKm } from "@/lib/geo";

/**
 * The capacity engine.
 *
 * The one rule that matters: two customers must never be able to book the
 * same last delivery slot. We get that guarantee from a single atomic SQL
 * UPDATE — `bookedCount = bookedCount + 1 WHERE bookedCount < capacity` —
 * rather than "read count, check in JS, then write", which would have a
 * race condition under concurrent requests.
 */

export const CONFIRMATION_WINDOW_MINUTES = 30;
// How long a customer has to complete 3D Secure after the restaurant
// accepted but the charge needed extra verification. See
// lib/payment-actions.ts.
export const PAYMENT_ACTION_WINDOW_MINUTES = 30;
export const DELIVERY_FEE_CENTS = 300; // flat £3 for this MVP — vary by distance/restaurant later
export const SUBSCRIPTION_DISCOUNT_PERCENT = 5; // + free delivery; see src/lib/subscriptions.ts

export class SlotFullError extends Error {
  constructor() {
    super("This delivery slot is fully booked.");
    this.name = "SlotFullError";
  }
}

export class SlotClosedError extends Error {
  constructor() {
    super("The ordering cutoff for this slot has passed.");
    this.name = "SlotClosedError";
  }
}

export class OrderNotPendingError extends Error {
  constructor(status: string) {
    super(`Order is "${status}", not awaiting confirmation.`);
    this.name = "OrderNotPendingError";
  }
}

export class InvalidModifierSelectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidModifierSelectionError";
  }
}

/**
 * Atomically reserve one spot on a slot. Returns true if it succeeded,
 * false if the slot was already full. Must be called inside a transaction
 * that also creates the Order row, so a crash between the two never leaves
 * an orphaned reservation.
 *
 * Prisma's query builder can't express "bookedCount < capacity" inside
 * updateMany's WHERE clause (it can't compare two columns against each
 * other), so this uses a small raw SQL statement instead — still inside the
 * caller's transaction, so it's still atomic and isolated from other
 * concurrent reservations.
 */
async function reserveSlot(tx: Prisma.TransactionClient, slotId: string): Promise<boolean> {
  const rows: { id: string }[] = await tx.$queryRaw`
    UPDATE "DeliverySlot"
    SET "bookedCount" = "bookedCount" + 1
    WHERE "id" = ${slotId} AND "bookedCount" < "capacity"
    RETURNING "id"
  `;
  return rows.length === 1;
}

export async function releaseSlot(tx: Prisma.TransactionClient, slotId: string): Promise<void> {
  await tx.deliverySlot.update({
    where: { id: slotId },
    data: { bookedCount: { decrement: 1 } },
  });
}

export type CreateOrderInput = {
  customerId: string;
  restaurantId: string;
  slotId: string;
  deliveryAddress: string;
  notes?: string;
  stripePaymentMethodId: string;
  promoCode?: string;
  items: {
    menuItemId: string;
    quantity: number;
    notes?: string;
    selectedOptionIds?: string[];
  }[];
};

export class RestaurantNotApprovedError extends Error {
  constructor() {
    super("This restaurant isn't currently accepting orders.");
    this.name = "RestaurantNotApprovedError";
  }
}

export class DeliveryOutOfRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeliveryOutOfRangeError";
  }
}

export async function createOrder(input: CreateOrderInput) {
  // Delivery radius is only checked at search time today — this closes
  // that gap by re-verifying at the moment an order actually happens,
  // which is the point that actually matters. Deliberately outside the
  // transaction below: geocoding is a slow external network call, and
  // slow calls don't belong inside a Postgres transaction (same reasoning
  // as the Stripe charge in confirmOrder()).
  const restaurantForRadiusCheck = await prisma.restaurant.findUniqueOrThrow({
    where: { id: input.restaurantId },
  });
  if (
    restaurantForRadiusCheck.latitude !== null &&
    restaurantForRadiusCheck.longitude !== null &&
    restaurantForRadiusCheck.deliveryRadiusKm !== null
  ) {
    const geocoded = await geocodeAddress(input.deliveryAddress);
    if (!geocoded) {
      console.warn(
        `[radius-check] Could not geocode "${input.deliveryAddress}" for an order at ${restaurantForRadiusCheck.name}`
      );
      throw new DeliveryOutOfRangeError(
        "We couldn't verify that address. Please check it and try again, or pick a different one."
      );
    }
    const distance = distanceKm(
      restaurantForRadiusCheck.latitude,
      restaurantForRadiusCheck.longitude,
      geocoded.latitude,
      geocoded.longitude
    );
    // Logged every time, not just on failure — the pass case is just as
    // useful for spotting a wrong-looking distance before it becomes a
    // support question, and this is cheap (one log line, no extra call).
    console.log(
      `[radius-check] ${restaurantForRadiusCheck.name} ` +
        `(${restaurantForRadiusCheck.latitude}, ${restaurantForRadiusCheck.longitude}, radius ${restaurantForRadiusCheck.deliveryRadiusKm}km) ` +
        `vs "${input.deliveryAddress}" -> resolved to "${geocoded.formattedAddress}" ` +
        `(${geocoded.latitude}, ${geocoded.longitude}) — ${distance.toFixed(2)}km ` +
        (distance > restaurantForRadiusCheck.deliveryRadiusKm ? "REJECTED" : "OK")
    );
    if (distance > restaurantForRadiusCheck.deliveryRadiusKm) {
      throw new DeliveryOutOfRangeError(
        `${restaurantForRadiusCheck.name} doesn't deliver to that address — it's outside their delivery area.`
      );
    }
  }
  // A restaurant with no location set has no radius to enforce — nothing
  // to check against, so no claim was ever made about a delivery area.

  const order = await prisma.$transaction(async (tx) => {
    const restaurant = await tx.restaurant.findUniqueOrThrow({ where: { id: input.restaurantId } });
    if (restaurant.approvalStatus !== "APPROVED" || !restaurant.signupFeePaidAt) {
      throw new RestaurantNotApprovedError();
    }

    const slot = await tx.deliverySlot.findUniqueOrThrow({ where: { id: input.slotId } });

    if (slot.cutoffAt < new Date()) {
      throw new SlotClosedError();
    }

    const reserved = await reserveSlot(tx, input.slotId);
    if (!reserved) {
      throw new SlotFullError();
    }

    const menuItems = await tx.menuItem.findMany({
      where: { id: { in: input.items.map((i) => i.menuItemId) } },
      include: { modifierGroups: { include: { options: true } } },
    });

    let subtotalCents = 0;
    const orderItemsData = input.items.map((item) => {
      const menuItem = menuItems.find((m) => m.id === item.menuItemId);
      if (!menuItem) throw new Error(`Menu item ${item.menuItemId} not found`);

      const selectedIds = new Set(item.selectedOptionIds ?? []);
      const allOptions = menuItem.modifierGroups.flatMap((g) => g.options);
      const selectedOptions = allOptions.filter((o) => selectedIds.has(o.id));

      // Validate every group's selection count is within [minSelect, maxSelect],
      // and that every selected option actually belongs to this menu item
      // (a client could otherwise send an option ID scraped from a
      // different restaurant's menu).
      for (const group of menuItem.modifierGroups) {
        const countInGroup = selectedOptions.filter((o) => o.groupId === group.id).length;
        if (countInGroup < group.minSelect || countInGroup > group.maxSelect) {
          throw new InvalidModifierSelectionError(
            `"${menuItem.name}": choose ${
              group.minSelect === group.maxSelect
                ? group.minSelect
                : `${group.minSelect}-${group.maxSelect}`
            } option(s) for "${group.name}".`
          );
        }
      }
      if (selectedOptions.length !== selectedIds.size) {
        throw new InvalidModifierSelectionError(`"${menuItem.name}": one or more selected options are invalid.`);
      }

      const modifiersTotalCents = selectedOptions.reduce((sum, o) => sum + o.priceDeltaCents, 0);
      subtotalCents += (menuItem.priceCents + modifiersTotalCents) * item.quantity;

      return {
        menuItemId: menuItem.id,
        nameSnapshot: menuItem.name,
        priceCents: menuItem.priceCents,
        quantity: item.quantity,
        notes: item.notes,
        modifiers: {
          create: selectedOptions.map((o) => ({
            groupName: menuItem.modifierGroups.find((g) => g.id === o.groupId)!.name,
            optionName: o.name,
            priceDeltaCents: o.priceDeltaCents,
          })),
        },
      };
    });

    const confirmationDeadline = new Date(Date.now() + CONFIRMATION_WINDOW_MINUTES * 60_000);

    // Subscription benefit (free delivery + 5% off) and a promo code
    // deliberately don't stack — a promo code, if provided, takes
    // precedence. Subscription math can happen up front since it doesn't
    // need the order to exist yet (unlike a promo code — see below).
    const willUsePromo = Boolean(input.promoCode);
    const subscription = willUsePromo
      ? null
      : await tx.subscription.findUnique({ where: { userId: input.customerId } });
    const hasActiveSubscription = subscription?.status === "ACTIVE";

    const deliveryFeeCents = hasActiveSubscription ? 0 : DELIVERY_FEE_CENTS;
    const subscriptionDiscountCents = hasActiveSubscription
      ? Math.round((subtotalCents * SUBSCRIPTION_DISCOUNT_PERCENT) / 100)
      : 0;

    const order = await tx.order.create({
      data: {
        customerId: input.customerId,
        restaurantId: input.restaurantId,
        slotId: input.slotId,
        status: OrderStatus.PENDING_CONFIRMATION,
        subtotalCents,
        deliveryFeeCents,
        discountCents: subscriptionDiscountCents,
        totalCents: subtotalCents + deliveryFeeCents - subscriptionDiscountCents,
        subscriptionBenefitApplied: hasActiveSubscription,
        deliveryAddress: input.deliveryAddress,
        notes: input.notes,
        confirmationDeadline,
        stripePaymentMethodId: input.stripePaymentMethodId,
        items: { create: orderItemsData },
      },
      include: { items: { include: { modifiers: true } }, restaurant: true, slot: true },
    });

    // A promo code needs the order to exist first — PromoRedemption has a
    // required, unique orderId. So: create the order above with a
    // provisional total, then patch it here if a code was provided. If the
    // code turns out to be invalid, this throws and the whole transaction
    // (including the order creation above) rolls back.
    if (input.promoCode) {
      const { promoCodeId, discountCents } = await applyPromoCode(tx, {
        code: input.promoCode,
        restaurantId: input.restaurantId,
        subtotalCents,
        customerId: input.customerId,
        orderId: order.id,
      });

      return tx.order.update({
        where: { id: order.id },
        data: {
          promoCodeId,
          discountCents,
          totalCents: subtotalCents + deliveryFeeCents - discountCents,
        },
        include: { items: { include: { modifiers: true } }, restaurant: true, slot: true },
      });
    }

    return order;
  });

  void notifyOrderPlaced(order.id);
  return order;
}

/**
 * Restaurant accepts. This is the moment the card is actually charged.
 *
 * The Stripe call itself happens outside any DB transaction (network calls
 * don't belong inside a Postgres transaction — they're slow and would hold
 * locks). That creates one edge case worth handling explicitly: if the
 * order's status changes for some other reason (e.g. the 30-minute expiry
 * sweep runs) in the moment between us checking it and the charge actually
 * completing, we could end up having charged a card for an order that's no
 * longer confirmable. That's rare but not impossible, so it's detected and
 * surfaced loudly (needs a manual refund) rather than silently ignored.
 */
export async function confirmOrder(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });

  if (order.status !== OrderStatus.PENDING_CONFIRMATION) {
    throw new OrderNotPendingError(order.status);
  }
  if (order.confirmationDeadline < new Date()) {
    throw new Error("Confirmation window has already expired for this order.");
  }

  let paymentIntentId: string;
  try {
    paymentIntentId = await chargeOrderOnConfirm(order);
  } catch (err) {
    if (err instanceof PaymentRequiresActionError) {
      // Not a failure — the restaurant's "accept" still stands, the card
      // just needs the customer to approve it (3D Secure). Keep the slot
      // reserved and give the customer a window to complete it; see
      // expirePaymentActions() for what happens if they don't.
      await prisma.$transaction(async (tx) => {
        const fresh = await tx.order.findUnique({ where: { id: orderId } });
        if (!fresh || fresh.status !== OrderStatus.PENDING_CONFIRMATION) return;
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.PAYMENT_ACTION_REQUIRED,
            stripePaymentIntentId: err.paymentIntentId,
            paymentActionDeadline: new Date(Date.now() + PAYMENT_ACTION_WINDOW_MINUTES * 60_000),
          },
        });
      });
      void notifyPaymentActionRequired(orderId);
      throw err;
    }

    // Payment failed outright (card declined, etc.) — treat it like the
    // restaurant declining: release the slot, no charge went through so
    // nothing to refund, but record *why* separately from a real
    // restaurant decline.
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.order.findUnique({ where: { id: orderId } });
      if (!fresh || fresh.status !== OrderStatus.PENDING_CONFIRMATION) return;
      await releaseSlot(tx, fresh.slotId);
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.DECLINED,
          declinedAt: new Date(),
          failureReason: err instanceof Error ? err.message : "Payment failed",
        },
      });
    });
    void notifyOrderDeclined(orderId);
    throw err;
  }

  const confirmed = await prisma.$transaction(async (tx) => {
    const fresh = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (fresh.status !== OrderStatus.PENDING_CONFIRMATION) {
      // The card was already charged above, but the order can no longer be
      // confirmed — an orphaned charge. This should be very rare (see
      // comment above); surfacing it loudly is safer than losing track of
      // real money silently.
      throw new Error(
        `Order ${orderId} was charged (PaymentIntent ${paymentIntentId}) but its status had already ` +
          `changed to ${fresh.status}. This charge needs a manual refund — it was not applied.`
      );
    }

    const { platformFeeCents, restaurantPayoutCents } = computePayoutSplit(fresh);

    return tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CONFIRMED,
        confirmedAt: new Date(),
        stripePaymentIntentId: paymentIntentId,
        platformFeeCents,
        restaurantPayoutCents,
      },
    });
  });

  void notifyOrderConfirmed(orderId);
  return confirmed;
}

/** Restaurant declines. No charge has happened, so there's nothing to refund. */
export async function declineOrder(orderId: string) {
  const declined = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.status !== OrderStatus.PENDING_CONFIRMATION) {
      throw new OrderNotPendingError(order.status);
    }

    await releaseSlot(tx, order.slotId);

    return tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.DECLINED, declinedAt: new Date() },
    });
  });

  void notifyOrderDeclined(orderId);
  return declined;
}

/**
 * Sweeps orders whose 30-minute window ran out with no restaurant response.
 * In production this runs on a schedule (Vercel Cron, a queue consumer, a
 * worker process — see scripts/expire-orders-worker.ts for a dev stand-in).
 * It is intentionally safe to call this repeatedly / concurrently.
 */
export async function expireStaleOrders(): Promise<number> {
  const stale = await prisma.order.findMany({
    where: {
      status: OrderStatus.PENDING_CONFIRMATION,
      confirmationDeadline: { lt: new Date() },
    },
    select: { id: true },
  });

  for (const { id } of stale) {
    const expired = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id } });
      // Re-check status inside the transaction in case it was just
      // confirmed/declined a moment ago by the restaurant.
      if (!order || order.status !== OrderStatus.PENDING_CONFIRMATION) return null;

      await releaseSlot(tx, order.slotId);
      return tx.order.update({
        where: { id },
        data: { status: OrderStatus.EXPIRED, expiredAt: new Date() },
      });
    });

    if (expired) void notifyOrderExpired(id);
  }

  return stale.length;
}
