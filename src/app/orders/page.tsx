import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney, formatDate } from "@/lib/format";
import { Pagination } from "@/app/components/pagination";
import type { OrderStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const statusStyles: Record<string, string> = {
  PENDING_CONFIRMATION: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  OUT_FOR_DELIVERY: "bg-blue-100 text-blue-700",
  DELIVERED: "bg-green-100 text-green-700",
  DECLINED: "bg-red-100 text-red-700",
  EXPIRED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-600",
};

const statusLabels: Record<string, string> = {
  PENDING_CONFIRMATION: "Awaiting confirmation",
  CONFIRMED: "Confirmed",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  DECLINED: "Declined",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

// Same filter set as /restaurant/orders, for consistency between the two
// order-history views — status only here, deliberately no date filter to
// match (a customer's own order list is naturally much shorter than a
// restaurant's, so the extra filter dimension isn't earning its keep the
// way it does on the restaurant side).
const FILTERS: { label: string; value: OrderStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Awaiting confirmation", value: "PENDING_CONFIRMATION" },
  { label: "Confirmed", value: "CONFIRMED" },
  { label: "Out for delivery", value: "OUT_FOR_DELIVERY" },
  { label: "Delivered", value: "DELIVERED" },
  { label: "Declined/expired", value: "DECLINED" },
];

export default async function OrderHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { page, status } = await searchParams;
  const currentPage = Math.max(1, parseInt(page ?? "1", 10) || 1);
  const activeFilter = status ?? "ALL";

  const statusWhere =
    activeFilter === "ALL"
      ? {}
      : activeFilter === "DECLINED"
        ? { status: { in: ["DECLINED", "EXPIRED"] as OrderStatus[] } }
        : { status: activeFilter as OrderStatus };

  const where = { customerId: user.id, ...statusWhere };

  const [totalCount, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: { items: true, restaurant: true, slot: true },
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // `null` means "explicitly clear this filter," distinguishable from a
  // key simply not being passed (which means "leave it as-is") — the
  // exact ambiguity that broke the equivalent logic on /restaurant/orders
  // before it was fixed. Only one filter here, but kept the same pattern
  // rather than a simpler-looking version that could reintroduce it.
  function buildFilterHref(overrides: { status?: string | null }) {
    const params = new URLSearchParams();
    const nextStatus = overrides.status === null ? undefined : (overrides.status ?? status);
    if (nextStatus) params.set("status", nextStatus);
    const qs = params.toString();
    return qs ? `/orders?${qs}` : "/orders";
  }

  function buildPageHref(targetPage: number) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return qs ? `/orders?${qs}` : "/orders";
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 w-full">
      <h1 className="text-2xl font-semibold mb-1">Your orders</h1>
      <p className="text-sm text-gray-500 mb-6">Everything you&apos;ve ordered through Pre-Meal.</p>

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6 pb-1">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={buildFilterHref({ status: f.value === "ALL" ? null : f.value })}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full border ${
              activeFilter === f.value ? "bg-stone-900 text-white border-stone-900" : "border-stone-200 text-stone-600"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {orders.map((order) => (
          <Link
            key={order.id}
            href={`/orders/${order.id}`}
            className="block border border-gray-200 rounded-xl p-4 hover:border-orange-300 transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <p className="font-medium text-sm">{order.restaurant.name}</p>
              <span className={`text-xs px-2 py-0.5 rounded ${statusStyles[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                {statusLabels[order.status] ?? order.status}
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              {formatDate(order.slot.date)} · {order.slot.windowStart}–{order.slot.windowEnd} · ordered{" "}
              {formatDate(order.createdAt)}
            </p>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 truncate pr-4">
                {order.items.map((i) => `${i.nameSnapshot} ×${i.quantity}`).join(" · ")}
              </p>
              <p className="text-sm font-medium shrink-0">{formatMoney(order.totalCents)}</p>
            </div>
          </Link>
        ))}
        {orders.length === 0 && (
          <p className="text-sm text-gray-500">
            {activeFilter === "ALL" ? (
              <>No orders yet — <Link href="/" className="text-orange-600">browse restaurants</Link> to get started.</>
            ) : (
              "No orders match this filter."
            )}
          </p>
        )}
      </div>

      <Pagination currentPage={currentPage} totalPages={totalPages} buildHref={buildPageHref} />
    </main>
  );
}
