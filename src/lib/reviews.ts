import { prisma } from "@/lib/db";

export class NotAuthorizedError extends Error {
  constructor(message = "Not authorized for this order") {
    super(message);
    this.name = "NotAuthorizedError";
  }
}

export class ReviewNotAllowedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewNotAllowedError";
  }
}

export type CreateReviewInput = {
  orderId: string;
  customerId: string;
  rating: number; // 1-5, validated at the API boundary too
  comment?: string;
};

export async function createReview(input: CreateReviewInput) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: input.orderId },
    include: { review: true },
  });

  if (order.customerId !== input.customerId) throw new NotAuthorizedError();
  if (order.status !== "DELIVERED") {
    throw new ReviewNotAllowedError("You can only review an order after it's been delivered.");
  }
  if (order.review) {
    throw new ReviewNotAllowedError("You've already reviewed this order.");
  }

  return prisma.$transaction(async (tx) => {
    const review = await tx.review.create({
      data: {
        orderId: order.id,
        customerId: input.customerId,
        restaurantId: order.restaurantId,
        rating: input.rating,
        comment: input.comment,
      },
    });

    // Recompute from scratch rather than incrementally averaging — review
    // volume per restaurant is small enough that this is cheap, and it
    // avoids any drift between a cached running average and reality.
    const agg = await tx.review.aggregate({
      where: { restaurantId: order.restaurantId },
      _avg: { rating: true },
      _count: { _all: true },
    });

    await tx.restaurant.update({
      where: { id: order.restaurantId },
      data: {
        averageRating: agg._avg.rating,
        reviewCount: agg._count._all,
      },
    });

    return review;
  });
}
