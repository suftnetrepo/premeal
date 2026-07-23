import { redirect } from "next/navigation";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { getTopDishes } from "@/lib/restaurant-dashboard-stats";
import { DashboardClient } from "./dashboard-client";
import { PaySignupFeeButton } from "./pay-signup-fee-button";
import { StarDisplay } from "@/app/components/stars";
import { SIGNUP_FEE_CENTS } from "@/lib/restaurant-fees";

export default async function RestaurantDashboardPage() {
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
  const isLive = isSetupComplete && restaurant.approvalStatus === "APPROVED" && hasPaidSignupFee;

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

      {restaurant.approvalStatus === "REJECTED" && (
        <div className="border border-red-200 bg-red-50 rounded-xl p-4 mb-4">
          <p className="text-sm font-medium text-red-800 mb-1">Your application wasn&apos;t approved</p>
          {restaurant.approvalNote && <p className="text-sm text-red-700">{restaurant.approvalNote}</p>}
        </div>
      )}

      {restaurant.approvalStatus === "PENDING" && (
        <div className="border border-gray-200 bg-gray-50 rounded-xl p-4 mb-4">
          <p className="text-sm text-gray-600">
            Waiting on admin approval. You can get your menu and delivery days ready in the meantime — the
            signup fee opens up once you&apos;re approved.
          </p>
        </div>
      )}

      {restaurant.approvalStatus === "APPROVED" && !hasPaidSignupFee && (
        <div className="border border-orange-200 bg-orange-50 rounded-xl p-4 mb-4">
          <p className="text-sm font-medium text-orange-800 mb-1">You&apos;re approved — pay your signup fee to go live</p>
          <p className="text-sm text-orange-700 mb-3">
            A flat {"£50"}, charged once — not recurring, and not tied to sales. After this, the only ongoing
            cost is the 12% commission on orders you actually receive.
          </p>
          <PaySignupFeeButton feeCents={SIGNUP_FEE_CENTS} />
        </div>
      )}

      {!isSetupComplete && (
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 mb-8">
          <p className="text-sm font-medium text-amber-800 mb-2">Finish setup to go live</p>
          <ul className="text-sm flex flex-col gap-1.5">
            <li className="flex items-center gap-2">
              <span>{availableItemCount > 0 ? "✅" : "⬜️"}</span>
              <Link href="/restaurant/menu" className="text-orange-700 underline">
                Add menu items
              </Link>
              {availableItemCount > 0 && (
                <span className="text-gray-500">({availableItemCount} available)</span>
              )}
            </li>
            <li className="flex items-center gap-2">
              <span>{openSlotCount > 0 ? "✅" : "⬜️"}</span>
              <Link href="/restaurant/deliveries" className="text-orange-700 underline">
                Set up delivery days
              </Link>
              {openSlotCount > 0 && <span className="text-gray-500">({openSlotCount} open)</span>}
            </li>
          </ul>
        </div>
      )}

      {isLive && !restaurant.latitude && (
        <div className="border border-gray-200 bg-gray-50 rounded-xl p-4 mb-4 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Add your address and delivery radius so nearby customers searching can find you.
          </p>
          <Link href="/restaurant/location" className="text-sm text-orange-600 shrink-0 ml-3">
            Set location →
          </Link>
        </div>
      )}

      {isLive && !restaurant.stripeOnboardingComplete && (
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 mb-8 flex items-center justify-between">
          <p className="text-sm text-amber-800">
            You can take orders, but payouts aren&apos;t set up — you won&apos;t get paid until this is done.
          </p>
          <Link href="/restaurant/payouts" className="text-sm text-orange-700 font-medium shrink-0 ml-3">
            Set up payouts →
          </Link>
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
