import { prisma } from "@/lib/db";
import type { Prisma, PromoCode } from "@prisma/client";

export class PromoCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromoCodeError";
  }
}

function computeDiscount(promo: PromoCode, subtotalCents: number): number {
  if (promo.discountType === "PERCENTAGE") {
    const raw = Math.round((subtotalCents * promo.discountValue) / 100);
    return promo.maxDiscountCents ? Math.min(raw, promo.maxDiscountCents) : raw;
  }
  // FIXED_AMOUNT — never discount more than the subtotal itself.
  return Math.min(promo.discountValue, subtotalCents);
}

async function validate(
  promo: PromoCode | null,
  { restaurantId, subtotalCents, customerId }: { restaurantId: string; subtotalCents: number; customerId: string },
  tx: Prisma.TransactionClient | typeof prisma
): Promise<void> {
  if (!promo) throw new PromoCodeError("That code isn't valid.");
  if (!promo.isActive) throw new PromoCodeError("That code is no longer active.");
  if (promo.restaurantId && promo.restaurantId !== restaurantId) {
    throw new PromoCodeError("That code isn't valid at this restaurant.");
  }
  const now = new Date();
  if (promo.validFrom && promo.validFrom > now) throw new PromoCodeError("That code isn't active yet.");
  if (promo.validUntil && promo.validUntil < now) throw new PromoCodeError("That code has expired.");
  if (promo.minOrderCents && subtotalCents < promo.minOrderCents) {
    throw new PromoCodeError(`This code needs a minimum order of £${(promo.minOrderCents / 100).toFixed(2)}.`);
  }

  const customerUses = await tx.promoRedemption.count({
    where: { promoCodeId: promo.id, customerId },
  });
  if (customerUses >= promo.maxRedemptionsPerCustomer) {
    throw new PromoCodeError("You've already used this code.");
  }
}

/** Read-only preview for the checkout UI — never mutates redemption counts. */
export async function previewPromoCode(input: {
  code: string;
  restaurantId: string;
  subtotalCents: number;
  customerId: string;
}): Promise<{ discountCents: number; description: string | null }> {
  const promo = await prisma.promoCode.findUnique({ where: { code: input.code.trim().toUpperCase() } });
  await validate(promo, input, prisma);
  // validate() throws if promo is null, so it's non-null past this point.
  const discountCents = computeDiscount(promo!, input.subtotalCents);
  return { discountCents, description: promo!.description };
}

/**
 * Applies a promo code inside the caller's order-creation transaction.
 * Re-validates everything from scratch — the preview above is UX only,
 * never authoritative — and atomically claims one redemption slot with the
 * same "single UPDATE with a WHERE guard" pattern reserveSlot() uses for
 * delivery capacity, so two concurrent checkouts can't both slip past
 * maxRedemptions.
 */
export async function applyPromoCode(
  tx: Prisma.TransactionClient,
  input: { code: string; restaurantId: string; subtotalCents: number; customerId: string; orderId: string }
): Promise<{ promoCodeId: string; discountCents: number }> {
  const normalizedCode = input.code.trim().toUpperCase();
  const promo = await tx.promoCode.findUnique({ where: { code: normalizedCode } });
  await validate(promo, input, tx);

  const claimed: { id: string }[] = await tx.$queryRaw`
    UPDATE "PromoCode"
    SET "redemptionCount" = "redemptionCount" + 1
    WHERE "id" = ${promo!.id} AND ("maxRedemptions" IS NULL OR "redemptionCount" < "maxRedemptions")
    RETURNING "id"
  `;
  if (claimed.length === 0) {
    throw new PromoCodeError("That code has reached its redemption limit.");
  }

  const discountCents = computeDiscount(promo!, input.subtotalCents);

  await tx.promoRedemption.create({
    data: {
      promoCodeId: promo!.id,
      customerId: input.customerId,
      orderId: input.orderId,
      discountCents,
    },
  });

  return { promoCodeId: promo!.id, discountCents };
}
