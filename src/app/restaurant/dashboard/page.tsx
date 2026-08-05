import { redirect } from "next/navigation";
import Link from "next/link";
import { TrendingUp, CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { getTopDishes } from "@/lib/restaurant-dashboard-stats";
import { DashboardClient } from "./dashboard-client";
import { PaySignupFeeButton } from "./pay-signup-fee-button";
import { PauseOrdersToggle } from "./pause-orders-toggle";
import { StarDisplay } from "@/app/components/stars";
import { SIGNUP_FEE_CENTS } from "@/lib/restaurant-fees";

export default async function RestaurantDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ signupFeePaid?: string }>;
}) {
  const { signupFeePaid } = await searchParams;
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (user.role !== "RESTAURANT_OWNER") redirect("/");

  const restaurant = await prisma.restaurant.findFirst({ where: { ownerId: user.id } });

  if (!restaurant) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 w-full">
        <p className="text-sm text-gray-500">
          No restaurant is linked to this account yet.
        </p>
      </main>
    );
  }

  const [availableItemCount, openSlotCount, totalOrderCount, topDishes] = await Promise.all([
    prisma.menuItem.count({ where: { restaurantId: restaurant.id, isAvailable: true } }),
    prisma.deliverySlot.count({
      where: {
        restaurantId: restaurant.id,
        date: { gte: new Date(new Date().toDateString()) },
        cutoffAt: { gt: new Date() },
      },
    }),
    prisma.order.count({
      where: { restaurantId: restaurant.id, status: { in: ["CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"] } },
    }),
    getTopDishes(restaurant.id),
  ]);

  const isSetupComplete = availableItemCount > 0 && openSlotCount > 0;
  const hasPaidSignupFee = Boolean(restaurant.signupFeePaidAt);
  const isApproved = restaurant.approvalStatus === "APPROVED";
  const isLive = isSetupComplete && isApproved && hasPaidSignupFee;

  // Every real requirement to actually be found and paid, in the order
  // they naturally happen — not just the two (menu, delivery days) that
  // used to be the only things inside a checklist at all, with location/
  // payouts/approval/the signup fee each fragmented into their own
  // separately-colored alert box instead. One consolidated widget instead
  // of five inconsistent ones is the actual "professional" fix here, not
  // a visual restyle of boxes that shouldn't have been five boxes.
  const steps = [
    {
      done: availableItemCount > 0,
      label: "Add menu items",
      detail: availableItemCount > 0 ? `${availableItemCount} available` : null,
      href: "/restaurant/menu",
    },
    {
      done: openSlotCount > 0,
      label: "Set up delivery days",
      detail: openSlotCount > 0 ? `${openSlotCount} open` : null,
      href: "/restaurant/deliveries",
    },
    {
      done: restaurant.latitude !== null,
      label: "Set your location",
      detail: null,
      href: "/restaurant/location",
    },
    {
      done: restaurant.stripeOnboardingComplete,
      label: "Connect payouts",
      detail: null,
      href: "/restaurant/payouts",
    },
    {
      done: isApproved,
      label: "Get approved by Pre-Meal",
      detail: isApproved ? null : "We review new restaurants before they go live",
      href: null, // nothing to click — this one's on us, not the owner
    },
    {
      done: hasPaidSignupFee,
      label: "Pay the one-time signup fee",
      detail: hasPaidSignupFee ? null : `£${(SIGNUP_FEE_CENTS / 100).toFixed(0)}, once — not recurring`,
      href: null, // handled by the PaySignupFeeButton below, once approved
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 py-10 w-full">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-2xl font-semibold">{restaurant.name}</h1>
        <span
          className={`text-xs px-2 py-0.5 rounded ${
            isLive ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {isLive ? "Live" : "Not visible to customers yet"}
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Respond within 30 minutes — unanswered orders auto-decline and refund automatically.
      </p>

      <PauseOrdersToggle initialIsActive={restaurant.isActive} />

      {/* Real stats only — menu size, real order count, real rating. No
          "followers/subscriptions" — no social/follow feature exists. */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-stone-900">{availableItemCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Menu items</p>
        </div>
        <div className="border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-stone-900">{totalOrderCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Orders received</p>
        </div>
        <div className="border border-gray-200 rounded-xl p-4 text-center">
          {restaurant.averageRating !== null ? (
            <>
              <div className="flex items-center justify-center gap-1">
                <p className="text-2xl font-bold text-stone-900">{restaurant.averageRating.toFixed(1)}</p>
              </div>
              <div className="flex justify-center mt-0.5">
                <StarDisplay rating={restaurant.averageRating} />
              </div>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-stone-300">—</p>
              <p className="text-xs text-gray-400 mt-0.5">No reviews yet</p>
            </>
          )}
        </div>
      </div>

      {/* Rejection stays its own distinct alert, deliberately not folded
          into the checklist below — it's a real problem needing the
          owner's attention, not a step waiting to be checked off. */}
      {/* Cross-checked against the real signupFeePaidAt field, not just
          the redirect param on its own — the webhook that actually marks
          payment as received is a separate, asynchronous request from
          this redirect, so there's a real (if usually brief) window
          where a customer could land back here before it's caught up.
          Claiming success before that's confirmed would be a false
          promise, not a nicety. */}
      {signupFeePaid === "1" && hasPaidSignupFee && (
        <div className="border border-green-200 bg-green-50 rounded-xl p-4 mb-6">
          <p className="text-sm font-medium text-green-800">Payment received — you&apos;re all set.</p>
        </div>
      )}
      {signupFeePaid === "1" && !hasPaidSignupFee && (
        <div className="border border-stone-200 bg-stone-50 rounded-xl p-4 mb-6">
          <p className="text-sm text-stone-600">
            Confirming your payment — this usually takes a few seconds. Refresh if this doesn&apos;t update shortly.
          </p>
        </div>
      )}

      {restaurant.approvalStatus === "REJECTED" && (
        <div className="border border-red-200 bg-red-50 rounded-xl p-4 mb-6">
          <p className="text-sm font-medium text-red-800 mb-1">Your application wasn&apos;t approved</p>
          {restaurant.approvalNote && <p className="text-sm text-red-700">{restaurant.approvalNote}</p>}
        </div>
      )}

      {/* One consolidated checklist — everything that used to be five
          separately-colored boxes (pending-approval, approved-but-unpaid,
          finish-setup, no-location, no-payouts) is now one consistent
          list of real steps, each backed by the same data those boxes
          used to check individually. Disappears entirely once every step
          is actually done — an onboarding checklist that never goes away
          for an established restaurant is clutter, not help. */}
      {!allDone && restaurant.approvalStatus !== "REJECTED" && (
        <div className="border border-stone-200 rounded-2xl p-5 mb-8 bg-white">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold text-stone-900">Get ready to go live</p>
            <p className="text-xs text-stone-400">
              {doneCount} of {steps.length} done
            </p>
          </div>
          <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden mb-5">
            <div
              className="h-full bg-orange-600 rounded-full transition-all"
              style={{ width: `${(doneCount / steps.length) * 100}%` }}
            />
          </div>

          <div className="flex flex-col gap-3">
            {steps.map((step) => (
              <div key={step.label} className="flex items-center gap-3">
                {step.done ? (
                  <CheckCircle2 size={20} className="text-green-600 shrink-0" strokeWidth={2} />
                ) : (
                  <Circle size={20} className="text-stone-300 shrink-0" strokeWidth={2} />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${step.done ? "text-stone-400 line-through" : "text-stone-900 font-medium"}`}>
                    {step.label}
                  </p>
                  {step.detail && <p className="text-xs text-stone-400">{step.detail}</p>}
                </div>
                {step.href && !step.done && (
                  <Link
                    href={step.href}
                    className="text-xs text-orange-600 font-medium shrink-0 flex items-center gap-0.5 hover:text-orange-700 py-2 px-1"
                  >
                    Go <ArrowRight size={12} strokeWidth={2} />
                  </Link>
                )}
              </div>
            ))}
          </div>

          {/* The one step with a real action beyond "go to another page"
              — paying the signup fee happens right here, once approved. */}
          {isApproved && !hasPaidSignupFee && (
            <div className="mt-5 pt-5 border-t border-stone-100">
              <PaySignupFeeButton feeCents={SIGNUP_FEE_CENTS} />
            </div>
          )}
        </div>
      )}

      <div className="flex gap-4 mb-8 text-sm">
        <Link href="/restaurant/menu" className="text-gray-500 hover:text-gray-700">
          Manage menu
        </Link>
        <Link href="/restaurant/deliveries" className="text-gray-500 hover:text-gray-700">
          Manage deliveries
        </Link>
        <Link href="/restaurant/location" className="text-gray-500 hover:text-gray-700">
          Manage location
        </Link>
        <Link href="/restaurant/payouts" className="text-gray-500 hover:text-gray-700">
          Payouts
        </Link>
      </div>

      {topDishes.length > 0 && (
        <div className="border border-gray-200 rounded-2xl p-5 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-orange-600" strokeWidth={1.75} />
            <h2 className="font-semibold text-stone-900">Your top dishes</h2>
          </div>
          <div className="flex flex-col gap-3">
            {topDishes.map((dish, i) => (
              <div key={dish.name} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-orange-50 text-orange-600 text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <p className="text-sm font-medium text-stone-900 flex-1 truncate">{dish.name}</p>
                <p className="text-xs text-stone-500 shrink-0">{dish.timesOrdered} ordered</p>
                <p className="text-sm text-stone-900 font-medium shrink-0 w-16 text-right">
                  {formatMoney(dish.revenueCents)}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-stone-400 mt-4">
            From completed orders. Revenue is base item price only, not including paid add-ons.
          </p>
        </div>
      )}

      <DashboardClient restaurantId={restaurant.id} />
    </main>
  );
}
