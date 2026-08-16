import { prisma } from "@/lib/db";
import { refundOrder, RefundFailedError } from "@/lib/payments";
import {
  notifyRestaurantApproved,
  notifyRestaurantRejected,
  notifyDisputeResolved,
  notifyHygieneCertificateVerified,
  notifyHygieneCertificateRejected,
} from "@/lib/notifications";

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class AlreadyResolvedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AlreadyResolvedError";
  }
}

export class FoodSafetyIncompleteError extends Error {
  constructor(message = "This restaurant hasn't completed food safety compliance yet.") {
    super(message);
    this.name = "FoodSafetyIncompleteError";
  }
}

export class HygieneCertificateNotPendingError extends Error {
  constructor(message = "This certificate isn't awaiting review — it may have already been decided, or never submitted.") {
    super(message);
    this.name = "HygieneCertificateNotPendingError";
  }
}

export async function approveRestaurant(restaurantId: string) {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant) throw new NotFoundError("Restaurant not found");

  // Mandatory, no exceptions — a restaurant can't be approved without both
  // the local-authority registration document and the acknowledged legal
  // checkbox on file. Both are always written together (see
  // POST /api/restaurant/food-safety), so checking both here is
  // belt-and-suspenders against the one, not a real independent gate.
  if (!restaurant.foodSafetyAcknowledgedAt || !restaurant.foodSafetyDocumentUrl) {
    throw new FoodSafetyIncompleteError();
  }

  const updated = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { approvalStatus: "APPROVED", approvalNote: null },
  });
  void notifyRestaurantApproved(restaurantId);
  return updated;
}

export async function rejectRestaurant(restaurantId: string, note: string) {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant) throw new NotFoundError("Restaurant not found");

  const updated = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { approvalStatus: "REJECTED", approvalNote: note },
  });
  void notifyRestaurantRejected(restaurantId);
  return updated;
}

/**
 * The hygiene certificate queue, unlike restaurant approval, isn't scoped
 * to new signups — a restaurant can submit one at any point in its life,
 * long after being approved and live. verify/reject both guard on the
 * certificate actually being PENDING right now: there's nothing
 * meaningful to decide on one that was never submitted (status null) or
 * one whose current submission has already been decided.
 */
export async function verifyHygieneCertificate(restaurantId: string) {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant) throw new NotFoundError("Restaurant not found");
  if (restaurant.hygieneCertificateStatus !== "PENDING") throw new HygieneCertificateNotPendingError();

  const updated = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      hygieneCertificateStatus: "VERIFIED",
      hygieneCertificateVerifiedAt: new Date(),
      hygieneCertificateRejectionReason: null,
    },
  });
  void notifyHygieneCertificateVerified(restaurantId);
  return updated;
}

export async function rejectHygieneCertificate(restaurantId: string, reason: string) {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant) throw new NotFoundError("Restaurant not found");
  if (restaurant.hygieneCertificateStatus !== "PENDING") throw new HygieneCertificateNotPendingError();

  const updated = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      hygieneCertificateStatus: "REJECTED",
      hygieneCertificateVerifiedAt: null,
      hygieneCertificateRejectionReason: reason,
    },
  });
  void notifyHygieneCertificateRejected(restaurantId);
  return updated;
}

export type DisputeResolution = "release_payout" | "refund";

/**
 * Resolves a customer's "report a problem" dispute one of two ways:
 *  - "release_payout": sides with the restaurant — clears the dispute and
 *    sets payoutEligibleAt back to now, so the next payout sweep pays them.
 *  - "refund": sides with the customer — issues a real Stripe refund.
 *    payoutEligibleAt is deliberately left null (it already is, from
 *    reportProblem()) so the restaurant is never paid for this order.
 * Either way the dispute is marked resolved so it drops off the open list.
 */
export async function resolveDispute(orderId: string, resolution: DisputeResolution, adminNote?: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new NotFoundError("Order not found");
  if (!order.disputedAt) throw new AlreadyResolvedError("This order doesn't have an open dispute.");
  if (order.disputeResolvedAt) throw new AlreadyResolvedError("This dispute has already been resolved.");

  if (resolution === "release_payout") {
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        disputeResolvedAt: new Date(),
        disputeResolution: adminNote ? `Payout released: ${adminNote}` : "Payout released",
        payoutEligibleAt: new Date(),
      },
    });
    void notifyDisputeResolved(orderId);
    return updated;
  }

  // resolution === "refund"
  try {
    const refundId = await refundOrder(order);
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        disputeResolvedAt: new Date(),
        disputeResolution: adminNote ? `Refunded: ${adminNote}` : "Refunded",
        stripeRefundId: refundId,
        refundedAt: new Date(),
      },
    });
    void notifyDisputeResolved(orderId);
    return updated;
  } catch (err) {
    if (err instanceof RefundFailedError) throw err;
    throw new RefundFailedError("Could not process the refund.");
  }
}

export async function getOverviewStats() {
  const now = new Date();
  const startOfToday = new Date(now.toDateString());
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    ordersToday,
    ordersThisWeek,
    ordersThisMonth,
    pendingApprovals,
    openDisputes,
    pendingCertificates,
    revenueAgg,
    signupFeeAgg,
    topRestaurants,
  ] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.order.count({ where: { createdAt: { gte: startOfWeek } } }),
    prisma.order.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.restaurant.count({ where: { approvalStatus: "PENDING" } }),
    prisma.order.count({ where: { disputedAt: { not: null }, disputeResolvedAt: null } }),
    prisma.restaurant.count({ where: { hygieneCertificateStatus: "PENDING" } }),
    prisma.order.aggregate({
      where: { status: "DELIVERED", platformFeeCents: { not: null } },
      _sum: { platformFeeCents: true },
    }),
    prisma.restaurant.aggregate({
      where: { signupFeeCents: { not: null } },
      _sum: { signupFeeCents: true },
    }),
    prisma.order.groupBy({
      by: ["restaurantId"],
      where: { status: { in: ["CONFIRMED", "OUT_FOR_DELIVERY", "DELIVERED"] } },
      _count: { _all: true },
      orderBy: { _count: { restaurantId: "desc" } },
      take: 5,
    }),
  ]);

  const restaurantIds = topRestaurants.map((t) => t.restaurantId);
  const restaurants = await prisma.restaurant.findMany({
    where: { id: { in: restaurantIds } },
    select: { id: true, name: true },
  });
  const restaurantNames = new Map(restaurants.map((r) => [r.id, r.name]));

  return {
    ordersToday,
    ordersThisWeek,
    ordersThisMonth,
    pendingApprovals,
    openDisputes,
    pendingCertificates,
    platformRevenueCents: revenueAgg._sum.platformFeeCents ?? 0,
    signupFeeRevenueCents: signupFeeAgg._sum.signupFeeCents ?? 0,
    topRestaurants: topRestaurants.map((t) => ({
      id: t.restaurantId,
      name: restaurantNames.get(t.restaurantId) ?? "Unknown",
      orderCount: t._count._all,
    })),
  };
}
