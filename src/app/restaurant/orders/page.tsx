import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import type { OrderStatus } from "@prisma/client";
import { ClipboardList } from "lucide-react";
import { OrderHistoryList } from "./order-history-list";

export const dynamic = "force-dynamic";

const FILTERS: { label: string; value: OrderStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Awaiting response", value: "PENDING_CONFIRMATION" },
  { label: "Confirmed", value: "CONFIRMED" },
  { label: "Out for delivery", value: "OUT_FOR_DELIVERY" },
  { label: "Delivered", value: "DELIVERED" },
  { label: "Declined/expired", value: "DECLINED" },
];

// Slots are created with local-timezone midnight (see dateAtMidnight()
// in src/app/api/restaurant/slots/route.ts, which uses .setHours(0,0,0,0)
// — the server's local time, not UTC). Parsing a bare "YYYY-MM-DD" string
// with `new Date(...)` instead always means UTC midnight per the ISO
// spec — on a server that isn't running in UTC, those are two different
// timestamps for what's supposed to be the same calendar day, which is
// exactly why the date filter matched nothing despite a real order
// existing on that exact date. Every date key/comparison here has to use
// the same local-timezone convention slot creation already uses.
function toDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateKeyToRange(key: string): { start: Date; end: Date } {
  const [year, month, day] = key.split("-").map(Number);
  return {
    start: new Date(year, month - 1, day),
    end: new Date(year, month - 1, day + 1),
  };
}

export default async function RestaurantOrderHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; date?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "RESTAURANT_OWNER") redirect("/");

  const restaurant = await prisma.restaurant.findFirst({ where: { ownerId: user.id } });
  if (!restaurant) redirect("/restaurant/dashboard");

  const { status, date } = await searchParams;
  const activeFilter = status ?? "ALL";
  const activeDate = date ?? "ALL";

  const statusWhere =
    activeFilter === "ALL"
      ? {}
      : activeFilter === "DECLINED"
        ? { status: { in: ["DECLINED", "EXPIRED"] as OrderStatus[] } }
        : { status: activeFilter as OrderStatus };

  // A range covering the whole calendar day, not an exact-equality match
  // — tolerant of any time-of-day component regardless of the server's
  // timezone, rather than depending on getting that exactly right.
  const dateWhere =
    activeDate === "ALL"
      ? {}
      : { slot: { date: { gte: dateKeyToRange(activeDate).start, lt: dateKeyToRange(activeDate).end } } };

  // Real delivery dates that actually have orders, not a decorative
  // calendar picker — same principle as the cuisine chips on the
  // homepage being computed from what's actually available. Sourced
  // independent of the current status filter, so switching status never
  // makes a date option disappear out from under you mid-browse.
  const slotDates = await prisma.order.findMany({
    where: { restaurantId: restaurant.id },
    select: { slot: { select: { date: true } } },
    orderBy: { slot: { date: "desc" } },
    take: 500,
  });
  const availableDates = Array.from(
    new Map<string, Date>(slotDates.map((o) => [toDateKey(o.slot.date), o.slot.date])).values()
  );

  // Full detail, not just the summary the list itself needs — the drawer
  // shows everything from here, no second fetch when an order is opened.
  const orders = await prisma.order.findMany({
    where: { restaurantId: restaurant.id, ...statusWhere, ...dateWhere },
    include: {
      items: { include: { modifiers: true } },
      customer: true,
      slot: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  function buildHref(overrides: { status?: string; date?: string }) {
    const params = new URLSearchParams();
    const nextStatus = overrides.status ?? status;
    const nextDate = overrides.date ?? date;
    if (nextStatus) params.set("status", nextStatus);
    if (nextDate) params.set("date", nextDate);
    const qs = params.toString();
    return qs ? `/restaurant/orders?${qs}` : "/restaurant/orders";
  }

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 py-10 w-full">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
          <ClipboardList size={16} strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-black tracking-tight text-stone-900">Order history</h1>
      </div>
      <p className="text-sm text-stone-500 mb-6">{restaurant.name} — all orders received.</p>

      <div className="flex gap-2 overflow-x-auto mb-3 pb-1">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={buildHref({ status: f.value === "ALL" ? undefined : f.value })}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full border ${
              activeFilter === f.value ? "bg-stone-900 text-white border-stone-900" : "border-stone-200 text-stone-600"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {availableDates.length > 0 && (
        <div className="flex gap-2 overflow-x-auto mb-6 pb-1">
          <Link
            href={buildHref({ date: undefined })}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full border ${
              activeDate === "ALL" ? "bg-orange-50 text-orange-700 border-orange-200" : "border-stone-200 text-stone-500"
            }`}
          >
            All dates
          </Link>
          {availableDates.map((d) => {
            const iso = toDateKey(d);
            return (
              <Link
                key={iso}
                href={buildHref({ date: iso })}
                className={`shrink-0 text-xs px-3 py-1.5 rounded-full border ${
                  activeDate === iso ? "bg-orange-50 text-orange-700 border-orange-200" : "border-stone-200 text-stone-500"
                }`}
              >
                {formatDate(d)}
              </Link>
            );
          })}
        </div>
      )}

      <OrderHistoryList orders={orders} restaurantName={restaurant.name} />
    </main>
  );
}
