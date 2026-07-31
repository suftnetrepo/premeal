import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getCurrentUser, clearSessionCookie, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { unexpectedErrorResponse } from "@/lib/api-errors";

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // A subscription is fully the customer's own — nothing else
      // depends on it existing, so it's safe to actually delete rather
      // than anonymize, regardless of which path this account takes
      // below. Has to happen first: Subscription.user has no onDelete
      // set (defaults to RESTRICT), so it would otherwise block
      // whichever branch runs next.
      await tx.subscription.deleteMany({ where: { userId: user.id } });

      // Everything below has a real other party attached to it — a
      // restaurant's own order history, a review a restaurant may have
      // responded to, a driver association a restaurant manages. Order,
      // Review, and PromoRedemption's customer relations are all RESTRICT
      // (no onDelete configured), by design: a customer deleting their
      // account shouldn't silently erase a restaurant's own transaction
      // records. RestaurantDriver/Order's driver relations are checked
      // too — unlikely for a normal customer, but not impossible if the
      // same account ever held a DRIVER role.
      const [orderCount, reviewCount, redemptionCount, driverOrderCount, driverAssocCount] = await Promise.all([
        tx.order.count({ where: { customerId: user.id } }),
        tx.review.count({ where: { customerId: user.id } }),
        tx.promoRedemption.count({ where: { customerId: user.id } }),
        tx.order.count({ where: { driverId: user.id } }),
        tx.restaurantDriver.count({ where: { driverId: user.id } }),
      ]);
      // Restaurant.ownerId is a required, RESTRICT relation too — not
      // checked here on purpose. This endpoint's only real caller today
      // is the mobile app, which always signs up as CUSTOMER (see
      // src/api/auth.ts's signup(): role is hardcoded, never owner). If
      // a RESTAURANT_OWNER account ever hits this endpoint — a future
      // web-side "delete my account" feature, say — the transaction
      // below fails safely (atomic rollback, nothing corrupted), just
      // with a generic error rather than a clear explanation. Add an
      // owned-restaurant check here before reusing this endpoint from
      // anywhere owners can reach.
      const hasRealHistory = orderCount + reviewCount + redemptionCount + driverOrderCount + driverAssocCount > 0;

      if (!hasRealHistory) {
        // Nothing else references this user at all — a genuine, complete
        // delete. Addresses cascade automatically (Address.user is
        // onDelete: Cascade).
        await tx.user.delete({ where: { id: user.id } });
        return;
      }

      // Real history exists — anonymize instead of deleting the row.
      // This is the actual, meaningful part of "delete my account": the
      // personally-identifying data is genuinely gone (name, email,
      // password), the account can never be logged into again, but the
      // order itself still shows a real (if anonymous) customer on the
      // restaurant's side, instead of a foreign-key crash or a silently
      // vanished transaction.
      await tx.address.deleteMany({ where: { userId: user.id } });
      await tx.user.update({
        where: { id: user.id },
        data: {
          name: "Deleted user",
          email: `deleted-${user.id}@premeal.invalid`,
          // A random, never-derivable hash — not a blank/predictable
          // value — so there is no possible password that logs into
          // this account again.
          passwordHash: await hashPassword(randomBytes(32).toString("hex")),
          stripeCustomerId: null,
          emailVerifiedAt: null,
          emailVerificationTokenHash: null,
          emailVerificationTokenExpiresAt: null,
          passwordResetTokenHash: null,
          passwordResetTokenExpiresAt: null,
          sessionVersion: { increment: 1 }, // invalidates any other active sessions immediately
        },
      });
    });

    await clearSessionCookie();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return unexpectedErrorResponse(err, "Could not delete account");
  }
}
