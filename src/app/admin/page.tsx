import { redirect } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  Store,
  ShoppingBag,
  CalendarDays,
  CalendarRange,
  Percent,
  Wallet,
  TrendingUp,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getOverviewStats } from "@/lib/admin";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");

  const stats = await getOverviewStats();

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 py-10 w-full">
      <h1 className="text-3xl font-black tracking-tight text-stone-900 mb-1">Admin overview</h1>
      <p className="text-stone-500 mb-8">Platform-wide activity at a glance.</p>

      {(stats.pendingApprovals > 0 || stats.openDisputes > 0) && (
        <div className="flex flex-col gap-2 mb-8">
          {stats.pendingApprovals > 0 && (
            <Link
              href="/admin/restaurants?status=PENDING"
              className="flex items-center gap-3 border border-amber-200 bg-amber-50 rounded-2xl p-4 hover:bg-amber-100/60 transition-colors"
            >
              <span className="w-9 h-9 rounded-full bg-white text-amber-600 flex items-center justify-center shrink-0">
                <Store size={18} strokeWidth={1.75} />
              </span>
              <p className="text-sm text-amber-800 flex-1">
                {stats.pendingApprovals} restaurant{stats.pendingApprovals === 1 ? "" : "s"} waiting for approval
              </p>
              <span className="text-sm text-amber-700 font-medium shrink-0">Review →</span>
            </Link>
          )}
          {stats.openDisputes > 0 && (
            <Link
              href="/admin/disputes"
              className="flex items-center gap-3 border border-red-200 bg-red-50 rounded-2xl p-4 hover:bg-red-100/60 transition-colors"
            >
              <span className="w-9 h-9 rounded-full bg-white text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} strokeWidth={1.75} />
              </span>
              <p className="text-sm text-red-800 flex-1">
                {stats.openDisputes} open dispute{stats.openDisputes === 1 ? "" : "s"}
              </p>
              <span className="text-sm text-red-700 font-medium shrink-0">Review →</span>
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-10">
        {[
          { label: "Orders today", value: stats.ordersToday, icon: ShoppingBag },
          { label: "Orders this week", value: stats.ordersThisWeek, icon: CalendarDays },
          { label: "Orders this month", value: stats.ordersThisMonth, icon: CalendarRange },
          { label: "Commission revenue", value: formatMoney(stats.platformRevenueCents), icon: Percent },
          { label: "Signup fee revenue", value: formatMoney(stats.signupFeeRevenueCents), icon: Wallet },
        ].map((stat) => (
          <div key={stat.label} className="border border-stone-200 rounded-2xl p-4 bg-white">
            <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center mb-2">
              <stat.icon size={15} strokeWidth={1.75} />
            </div>
            <p className="text-xs text-stone-500 mb-0.5">{stat.label}</p>
            <p className="text-xl font-bold text-stone-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="border border-stone-200 rounded-2xl p-5 mb-8 bg-white">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-orange-600" strokeWidth={1.75} />
          <h2 className="font-semibold text-stone-900">Top restaurants by order volume</h2>
        </div>
        <div className="flex flex-col gap-3">
          {stats.topRestaurants.map((r, i) => (
            <div key={r.id} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-orange-50 text-orange-600 text-xs font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <p className="text-sm font-medium text-stone-900 flex-1 truncate">{r.name}</p>
              <p className="text-xs text-stone-500 shrink-0">{r.orderCount} orders</p>
            </div>
          ))}
          {stats.topRestaurants.length === 0 && <p className="text-sm text-stone-400">No orders yet.</p>}
        </div>
      </div>

      <div className="flex gap-3 text-sm">
        <Link
          href="/admin/restaurants"
          className="text-orange-600 font-medium border border-orange-200 bg-orange-50 rounded-full px-4 py-2 hover:bg-orange-100 transition-colors"
        >
          Manage restaurants
        </Link>
        <Link
          href="/admin/disputes"
          className="text-orange-600 font-medium border border-orange-200 bg-orange-50 rounded-full px-4 py-2 hover:bg-orange-100 transition-colors"
        >
          Manage disputes
        </Link>
      </div>
    </main>
  );
}
